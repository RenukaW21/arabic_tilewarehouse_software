'use strict';

const OpenAI = require('openai');
const { query } = require('../../config/db');
const { isWarehouseScopedRole } = require('../../utils/warehouseScope');

// ─── OpenAI Client ────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
// Key = `${tenantId}_${userId}_${normalizedQuery}` — per-user so role/warehouse
// scoping is respected.
const memoryCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Instant Greetings ────────────────────────────────────────────────────────
const GREETINGS = new Set([
  'hi', 'hello', 'hey', 'hii', 'helo',
  'namaste', 'salam', 'as-salamu alaykum', 'assalamualaikum',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalize(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getFromCache(key) {
  if (!memoryCache.has(key)) return null;
  const { answer, cachedAt } = memoryCache.get(key);
  if (Date.now() - cachedAt > CACHE_TTL_MS) { memoryCache.delete(key); return null; }
  return answer;
}

function saveToCache(key, answer) {
  memoryCache.set(key, { answer, cachedAt: Date.now() });
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aBigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    aBigrams.set(bg, (aBigrams.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    if (aBigrams.has(bg) && aBigrams.get(bg) > 0) {
      intersection++;
      aBigrams.set(bg, aBigrams.get(bg) - 1);
    }
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

async function fuzzySearchDB(normalizedQuery, tid) {
  const keywords = normalizedQuery.split(' ').filter((w) => w.length > 2);
  if (!keywords.length) return [];
  const likeClauses = keywords.map(() => 'LOWER(question) LIKE ?').join(' OR ');
  const params = [...keywords.map((w) => `%${w}%`), tid];
  return query(
    `SELECT id, question, answer, hit_count
     FROM ai_chat_history
     WHERE (${likeClauses}) AND tenant_id = ?
     ORDER BY updated_at DESC
     LIMIT 3`,
    params
  );
}

async function saveOrUpdateDB(userQuery, normalizedQuery, answer, tid) {
  try {
    const rows = await fuzzySearchDB(normalizedQuery, tid);
    for (const row of rows) {
      const similarity = diceCoefficient(normalizedQuery, normalize(row.question));
      if (similarity >= 0.80) {
        await query(
          `UPDATE ai_chat_history SET hit_count = hit_count + 1, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [row.id, tid]
        );
        return;
      }
    }
    await query(
      `INSERT INTO ai_chat_history (question, answer, tenant_id) VALUES (?, ?, ?)`,
      [userQuery, answer, tid]
    );
  } catch (err) {
    console.error('[AI Cache] DB save error:', err.message);
  }
}

// ─── Resolve tenant UUID ──────────────────────────────────────────────────────
async function resolveTenantId(tenantId) {
  if (tenantId && typeof tenantId === 'string' && tenantId.includes('-')) return tenantId;
  try {
    const rows = await query('SELECT DISTINCT tenant_id FROM products LIMIT 1');
    if (rows?.length) return rows[0].tenant_id;
  } catch (_) { }
  try {
    const rows = await query('SELECT id FROM tenants LIMIT 1');
    if (rows?.length) return rows[0].id;
  } catch (_) { }
  return tenantId;
}

// ─── Fetch user profile (warehouse + supervisor contact) ─────────────────────
async function fetchUserProfile(userId, tenantId) {
  if (!userId) return { warehouseId: null, warehouseName: null, supervisorName: null, supervisorEmail: null };
  try {
    const rows = await query(
      `SELECT u.warehouse_id, w.name AS warehouse_name
       FROM users u
       LEFT JOIN warehouses w ON w.id = u.warehouse_id AND w.tenant_id = u.tenant_id
       WHERE u.id = ? AND u.tenant_id = ?`,
      [userId, tenantId]
    );
    if (!rows.length) return { warehouseId: null, warehouseName: null, supervisorName: null, supervisorEmail: null };

    const warehouseId = rows[0].warehouse_id ?? null;
    const warehouseName = rows[0].warehouse_name ?? null;

    // Find the supervisor/manager for this warehouse
    let supervisorName = null;
    let supervisorEmail = null;
    if (warehouseId) {
      const mgr = await query(
        `SELECT name, email FROM users
         WHERE tenant_id = ? AND warehouse_id = ?
           AND role IN ('warehouse_manager', 'supervisor', 'admin')
           AND is_active = 1
         ORDER BY FIELD(role, 'supervisor', 'warehouse_manager', 'admin')
         LIMIT 1`,
        [tenantId, warehouseId]
      );
      if (mgr.length) {
        supervisorName = mgr[0].name;
        supervisorEmail = mgr[0].email;
      }
    }

    return { warehouseId, warehouseName, supervisorName, supervisorEmail };
  } catch (err) {
    console.error('[AI] fetchUserProfile error:', err.message);
    return { warehouseId: null, warehouseName: null, supervisorName: null, supervisorEmail: null };
  }
}

// ─── Warehouse Context Builder ────────────────────────────────────────────────
// warehouseId = null  → fetch all warehouses (admin/super_admin)
// warehouseId = uuid  → restrict to that warehouse only
async function buildWarehouseContext(tid, warehouseId = null) {
  const whFilter = warehouseId ? 'AND ss.warehouse_id = ?' : '';
  const locFilter = warehouseId ? 'AND r.warehouse_id = ?' : '';
  const locParams = warehouseId ? [tid, warehouseId] : [tid];

  const [stockRows, lowStockRows, locationRows] = await Promise.all([
    query(
      `SELECT p.name, p.code AS sku,
              COALESCE(SUM(ss.total_boxes), 0) AS stock
       FROM products p
       LEFT JOIN stock_summary ss
         ON ss.product_id = p.id AND ss.tenant_id = p.tenant_id ${whFilter}
       WHERE p.tenant_id = ?
       GROUP BY p.id, p.name, p.code
       ORDER BY stock DESC
       LIMIT 20`,
      [...(warehouseId ? [warehouseId] : []), tid]
    ),
    query(
      `SELECT p.name,
              COALESCE(SUM(ss.total_boxes), 0) AS stock,
              p.reorder_level_boxes
       FROM products p
       LEFT JOIN stock_summary ss
         ON ss.product_id = p.id AND ss.tenant_id = p.tenant_id ${whFilter}
       WHERE p.tenant_id = ?
       GROUP BY p.id, p.name, p.reorder_level_boxes
       HAVING stock <= GREATEST(COALESCE(p.reorder_level_boxes, 0), 5)
       ORDER BY stock ASC
       LIMIT 10`,
      [...(warehouseId ? [warehouseId] : []), tid]
    ),
    query(
      `SELECT p.name AS product,
              w.name AS warehouse,
              r.name AS rack,
              pr.boxes_stored AS boxes
       FROM product_racks pr
       JOIN products p   ON p.id  = pr.product_id
       JOIN racks r      ON r.id  = pr.rack_id
       JOIN warehouses w ON w.id  = r.warehouse_id
       WHERE pr.tenant_id = ? ${locFilter}
       ORDER BY pr.boxes_stored DESC
       LIMIT 20`,
      locParams
    ),
  ]);

  const stockContext = stockRows.length
    ? stockRows.map((r) => `• ${r.name} (SKU: ${r.sku}) – ${r.stock} boxes`).join('\n')
    : 'No stock data available.';

  const lowStockContext = lowStockRows.length
    ? lowStockRows.map((r) => `• ${r.name} – ${r.stock} boxes (reorder: ${r.reorder_level_boxes ?? 0})`).join('\n')
    : 'None — all products are well-stocked.';

  const locationContext = locationRows.length
    ? locationRows.map((r) => `• ${r.product} → ${r.warehouse}, Rack "${r.rack}" (${r.boxes} boxes)`).join('\n')
    : 'No rack assignments recorded yet.';

  return { stockContext, lowStockContext, locationContext };
}

// ─── Role-aware system prompt builder ────────────────────────────────────────
function buildRoleSystemPrompt(role, warehouseName, supervisorContact) {
  const wh = warehouseName ? `"${warehouseName}"` : 'your assigned warehouse(s)';
  const sup = supervisorContact ?? 'your Supervisor or Admin';

  // Shared footer applied to every role block
  const footer = `
LANGUAGE RULE: Always reply in the same language the user writes in (English or Arabic).
ACCURACY RULE: Never assume or guess numbers — only use the live data provided to you.
DATA RULE: Only show data from ${wh}. If asked about other warehouses, say "You only have access to ${wh}."`.trim();

  const denied = (contact) =>
    `If the user asks to do something outside their permissions, respond exactly:\n"You don't have permission to do that. Please contact ${contact}."`;

  const roleBlocks = {

    // ── SUPER ADMIN ──────────────────────────────────────────────────────────
    super_admin: `
You are a WMS assistant for "Tiles WMS".
User role: SUPER ADMIN — full system access with no restrictions.
${footer}`.trim(),

    // ── ADMIN ────────────────────────────────────────────────────────────────
    admin: `
You are a WMS assistant for "Tiles WMS".
User role: ADMIN

Full access to all warehouses, modules, and reports — EXCEPT:
- Cannot manage tenants or billing
- Cannot delete audit logs

${footer}`.trim(),

    // ── WAREHOUSE MANAGER ────────────────────────────────────────────────────
    warehouse_manager: `
You are a WMS assistant for "Tiles WMS".
User role: MANAGER | Assigned warehouse: ${wh}

CAN DO:
- Inventory: View/update stock levels, monitor warehouse capacity
- Orders: View/create/edit, approve or reject purchase & sales orders
- GRN: Create/post, purchase & customer returns
- Dispatch: Schedule shipments, assign delivery staff, confirm dispatch
- Transfers & Adjustments: Create/approve between assigned warehouses
- Damage: Create/approve
- Reporting: Daily/weekly operational summaries, export reports
- View users only

CANNOT DO: Delete anything, edit posted GRN, manage users/roles, access settings, view other warehouses.

${denied(sup)}

${footer}`.trim(),

    // ── SUPERVISOR ───────────────────────────────────────────────────────────
    supervisor: `
You are a WMS assistant for "Tiles WMS".
User role: SUPERVISOR | Assigned warehouse: ${wh}

CAN DO:
- GRN: Create and post GRN, perform quality checks (approve/reject)
- Damage: Create and approve damage entries
- Picking/Packing: Assign picking/packing tasks to warehouse staff, mark tasks complete
- Workflow: Monitor inbound/outbound workflow and task queues
- Stock: View stock levels and rack locations in assigned warehouse

CANNOT DO:
- Approve or create purchase/sales orders
- Delete any records
- Export reports or access financial data
- Manage users or settings
- View data from other warehouses

${denied(sup)}

${footer}`.trim(),

    // ── SALES ────────────────────────────────────────────────────────────────
    sales: `
You are a WMS assistant for "Tiles WMS".
User role: SALES

CAN DO:
- Create and edit customer sales orders
- View customers and their order history
- View stock levels (read-only)
- View invoices related to sales orders

CANNOT DO:
- Approve or reject orders
- Access financial data (payments, GST reports, aging)
- Create/edit purchases, GRN, transfers, adjustments, or damage entries
- Delete anything or manage users/settings

${denied(sup)}

${footer}`.trim(),

    // ── WAREHOUSE STAFF ──────────────────────────────────────────────────────
    warehouse_staff: `
You are a WMS assistant for "Tiles WMS".
User role: WAREHOUSE STAFF | Assigned warehouse: ${wh}

CAN DO:
- GRN: Assist with unloading and put-away of received goods
- Picking: Execute picking tasks assigned by supervisor
- Packing: Complete packing tasks as assigned
- Dispatch: Assist with dispatch preparation and loading
- Customer Returns: Assist in receiving customer return items

CANNOT DO:
- Approve anything (orders, GRN, damage, adjustments)
- Create sales or purchase orders
- View or export reports
- Access financial data
- Manage users or settings
- View data from other warehouses

${denied(sup)}

${footer}`.trim(),

    // ── ACCOUNTANT ───────────────────────────────────────────────────────────
    accountant: `
You are a WMS assistant for "Tiles WMS".
User role: ACCOUNTANT

CAN DO:
- View purchase and sales orders (read-only)
- View and export invoices, credit notes, debit notes
- View payments received and made
- View GST reports, aging reports, stock valuation reports
- Export financial data

CANNOT DO:
- Create or edit any stock, inventory, orders, GRN, or transfers
- Delete anything
- Manage users, roles, or settings
- Modify stock levels or adjustments

${denied(sup)}

${footer}`.trim(),

    // ── VIEWER ───────────────────────────────────────────────────────────────
    viewer: `
You are a WMS assistant for "Tiles WMS".
User role: VIEWER — read-only access

CAN DO:
- View reports and analytics
- View stock levels and warehouse capacity
- View dashboards and summaries

CANNOT DO: Create, edit, approve, or delete anything in the system.

${denied(sup)}

${footer}`.trim(),

    // ── USER (legacy catch-all) ───────────────────────────────────────────────
    user: `
You are a WMS assistant for "Tiles WMS".
User role: USER — read-only access.

You can view stock levels and basic reports only.
${denied(sup)}

${footer}`.trim(),
  };

  return roleBlocks[role] ?? `
You are a WMS assistant for "Tiles WMS".
You have read-only access.
${denied(sup)}
${footer}`.trim();
}

// ─── WMS guide prompt (for how-to / setup questions) ─────────────────────────
const WMS_GUIDE_PROMPT = `You are an expert assistant for "Tiles WMS" — a Warehouse Management System for tiles/ceramics businesses.

━━━ SETUP ━━━
1. GST Config → Add company GSTIN, legal name, state, PAN, invoice prefix, fiscal year start.
2. Warehouses → Add warehouse (name, code, location, capacity in boxes). Each warehouse has racks.
3. Racks → Add racks inside warehouses. Set max capacity (boxes).
4. Users → Create users with roles: Super Admin, Admin, Warehouse Manager, Sales, Accountant, User.

━━━ MASTER DATA ━━━
5. Categories → Group products (Ceramic, Vitrified, Marble…).
6. Products → Add tile products: name, code, category, size, pieces/box, sqft/box, GST rate, MRP, reorder level.
7. Vendors → Suppliers from whom you purchase tiles.
8. Customers → Buyers to whom you sell.

━━━ PURCHASE FLOW ━━━
9. Purchase Orders (PO) → Draft → Confirm → Approve.
10. GRN → After PO approval, receive stock physically. Assign to a rack. Increases inventory.
11. Purchase Returns → Return goods to vendor. Reduces stock.

━━━ INVENTORY ━━━
12. Opening Stock → Add initial stock in Inventory Stock page.
13. Stock Transfers → Move stock between warehouses. Draft → Confirm (deducts source) → Receive (adds destination).
14. Stock Adjustments → Manual add/deduct with reason. Needs approval.
15. Damage Entries → Record damaged boxes. Reduces stock immediately.
16. Stock Counts → Physical count. Full / Cycle / Spot. Compare system vs counted.
17. Stock Ledger → Full transaction history per product/warehouse.

━━━ SALES FLOW ━━━
18. Sales Orders (SO) → Draft → Confirm (creates Pick List).
19. Pick Lists → Mark items as picked from racks.
20. Delivery Challans (DC) → Create from completed pick list → Dispatch (reduces stock + creates Invoice).
21. Invoices → Auto-created on DC dispatch or manually from confirmed SO.
22. Sales Returns → Customer returns → increases stock + creates Credit Note.

━━━ ACCOUNTS ━━━
23. Payments Received / Made → Record against invoices or POs.
24. Credit Notes / Debit Notes → Auto-created via returns, or manual.

━━━ REPORTS ━━━
25. GST Report → GSTR-1 style monthly tax summary.
26. Revenue Report → Monthly trends, top products, top customers.
27. Aging Report → Outstanding invoice aging (0-30, 31-60, 61-90, 90+ days).

━━━ ALERTS ━━━
28. Low Stock Alerts → Auto-triggered when stock drops below reorder level.

RULES:
- Give SHORT, PRECISE, step-by-step answers specific to this software.
- Use numbered steps or bullet points.
- Answer in the same language the user wrote in (English / Arabic).`;

// ─── Dynamic keywords (require real-time data) ────────────────────────────────
const DYNAMIC_KEYWORDS = [
  'stock', 'inventory', 'rack', 'how many', 'product', 'item', 'balance',
  'low', 'order', 'status', 'grn', 'location', 'where', 'assign', 'purchase',
  'sales', 'level', 'quantity', 'expire', 'damage', 'store', 'available',
  'transfer', 'adjustment', 'count',
];

// ─── Main Export ──────────────────────────────────────────────────────────────
exports.processAI = async (userQuery, tenantId, userContext = {}) => {
  const tid = await resolveTenantId(tenantId);
  const role = userContext.role ?? 'user';
  const name = userContext.name ?? '';

  if (!userQuery?.trim()) {
    return '⚠️ Please type a question so I can help you.';
  }

  const normalizedQuery = normalize(userQuery);

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (GREETINGS.has(normalizedQuery)) {
    const greeting = name ? `Hello, ${name}!` : 'Hello!';
    return `👋 ${greeting} I'm your Tiles WMS assistant. You're logged in as **${role.replace('_', ' ').toUpperCase()}**. How can I help you today?`;
  }

  // ── Fetch user's assigned warehouse ───────────────────────────────────────
  const { warehouseId, warehouseName, supervisorName, supervisorEmail } =
    await fetchUserProfile(userContext.userId, tid);

  // Build a human-readable supervisor contact string for permission-denied messages
  const supervisorContact = supervisorName
    ? (supervisorEmail ? `${supervisorName} (${supervisorEmail})` : supervisorName)
    : 'your Supervisor or Admin';

  // For managers, scope context to their warehouse; admins/super_admins see all
  const scopedWarehouseId = isWarehouseScopedRole(role) ? warehouseId : null;

  // ── Cache key (scoped per user so different managers see different data) ───
  const cacheKey = `${tid}_${userContext.userId ?? 'anon'}_${normalizedQuery}`;

  // ── Categorize question ────────────────────────────────────────────────────
  const isDynamic = DYNAMIC_KEYWORDS.some((kw) => normalizedQuery.includes(kw));

  // ── Static / how-to questions ─────────────────────────────────────────────
  if (!isDynamic) {
    // Check in-memory cache first (keyed per user)
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log('[AI] ✅ Cache hit (static).');
      return cached;
    }

    // Check DB fuzzy cache
    try {
      const dbRows = await fuzzySearchDB(normalizedQuery, tid);
      let bestMatch = null;
      let bestScore = 0;
      for (const row of dbRows) {
        const score = diceCoefficient(normalizedQuery, normalize(row.question));
        if (score > bestScore) { bestScore = score; bestMatch = row; }
      }
      if (bestMatch && bestScore >= 0.55) {
        console.log(`[AI] ✅ DB Cache hit (${(bestScore * 100).toFixed(0)}%).`);
        query(`UPDATE ai_chat_history SET hit_count = hit_count + 1, updated_at = NOW() WHERE id = ? AND tenant_id = ?`, [bestMatch.id, tid]).catch(() => { });
        return bestMatch.answer;
      }
    } catch (dbErr) {
      console.error('[AI Cache] DB error:', dbErr.message);
    }

    // Call OpenAI with WMS guide + role context
    console.log('[AI] 📖 Static/how-to question → OpenAI...');
    try {
      const roleBlock = buildRoleSystemPrompt(role, warehouseName, supervisorContact);
      const systemPrompt = `${roleBlock}\n\n${WMS_GUIDE_PROMPT}`;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        max_tokens: 450,
        temperature: 0.5,
      });
      console.log("Chatboat response", aiResponse);
      const answer = aiResponse.choices[0].message.content;
      saveToCache(cacheKey, answer);
      saveOrUpdateDB(userQuery, normalizedQuery, answer, tid).catch(() => { });
      return answer;
    } catch (err) {
      console.error('[AI] OpenAI static call failed:', err.message);
      return 'I am unable to answer right now. Please try again shortly or contact your administrator.';
    }
  }

  // ── Dynamic / data questions ───────────────────────────────────────────────
  console.log('[AI] 🤖 Dynamic question → fetching live data...');

  const { stockContext, lowStockContext, locationContext } =
    await buildWarehouseContext(tid, scopedWarehouseId);

  const roleBlock = buildRoleSystemPrompt(role, warehouseName, supervisorContact);
  const warehouseScope = scopedWarehouseId
    ? `DATA SCOPE: Only data from warehouse "${warehouseName}" is shown.`
    : 'DATA SCOPE: Data from all warehouses is shown.';

  const systemPrompt = `${roleBlock}

${warehouseScope}
Answer based ONLY on the live data below. Be concise (1-4 sentences or bullet points).
If data is not in the context, say "I don't have that data right now."

--- LIVE DATA ---
Stock Levels:
${stockContext}

Low Stock Alerts:
${lowStockContext}

Rack Locations:
${locationContext}
-----------------`;

  try {
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
      max_tokens: 350,
      temperature: 0.3,
    });

    return aiResponse.choices[0].message.content;
    // Note: dynamic answers are NOT cached — stock data changes frequently
  } catch (err) {
    console.error('[AI] OpenAI dynamic call failed:', err.message);
    return 'I am unable to retrieve live data right now. Please try again shortly.';
  }
};
