'use strict';

const OpenAI = require('openai');
const { query } = require('../../config/db');

// ─── OpenAI Client ────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── In-Memory Cache (Map) ────────────────────────────────────────────────────
// Key   = normalized query string
// Value = { answer: string, cachedAt: Date }
// TTL   = 30 minutes — after that we re-check DB so fresh data is served
const memoryCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Instant Greetings (no DB / no API) ──────────────────────────────────────
const GREETINGS = new Set([
  'hi', 'hello', 'hey', 'hii', 'helo',
  'namaste', 'salam', 'as-salamu alaykum', 'assalamualaikum',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Normalize a user query:
 *  - lowercase + trim
 *  - collapse multiple spaces into one
 *  - strip leading punctuation noise
 */
function normalize(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check in-memory cache. Returns cached answer or null.
 */
function getFromCache(key, tid) {
  const cacheKey = `${tid}_${key}`;
  if (!memoryCache.has(cacheKey)) return null;
  const { answer, cachedAt } = memoryCache.get(cacheKey);
  if (Date.now() - cachedAt > CACHE_TTL_MS) {
    memoryCache.delete(cacheKey); // expired
    return null;
  }
  return answer;
}

/**
 * Save to in-memory cache.
 */
function saveToCache(key, answer, tid) {
  const cacheKey = `${tid}_${key}`;
  memoryCache.set(cacheKey, { answer, cachedAt: Date.now() });
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────
/**
 * Fuzzy search: fetch top 3 similar questions from DB ordered by latest.
 * Uses LIKE %query% — catches partial / reworded matches.
 */
async function fuzzySearchDB(normalizedQuery, tid) {
  // Use individual keywords for broader matching
  const keywords = normalizedQuery.split(' ').filter((w) => w.length > 2);

  if (keywords.length === 0) return [];

  // Build: WHERE LOWER(question) LIKE '%word1%' OR LOWER(question) LIKE '%word2%'
  const likeClauses = keywords.map(() => 'LOWER(question) LIKE ?').join(' OR ');
  const params  = [...keywords.map((w) => `%${w}%`), tid];

  const rows = await query(
    `SELECT id, question, answer, hit_count
     FROM ai_chat_history
     WHERE (${likeClauses}) AND tenant_id = ?
     ORDER BY updated_at DESC
     LIMIT 3`,
    params
  );

  return rows;
}

/**
 * Check if an almost-identical question already exists.
 * "Almost identical" = normalized query matches existing normalized question at 80%+.
 * We use a simple character-overlap ratio (Dice coefficient).
 */
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

/**
 * Save a new question+answer to DB. Skips insert if a very similar
 * question already exists (dice >= 0.8). Instead, increments hit_count.
 */
async function saveOrUpdateDB(userQuery, normalizedQuery, answer, tid) {
  try {
    const rows = await fuzzySearchDB(normalizedQuery, tid);

    for (const row of rows) {
      const similarity = diceCoefficient(normalizedQuery, normalize(row.question));
      if (similarity >= 0.80) {
        // Duplicate found → just bump hit_count
        await query(
          `UPDATE ai_chat_history SET hit_count = hit_count + 1, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
          [row.id, tid]
        );
        console.log(`[AI Cache] Duplicate detected (${(similarity * 100).toFixed(0)}% similar). hit_count bumped.`);
        return;
      }
    }

    // No duplicate → insert new record
    await query(
      `INSERT INTO ai_chat_history (question, answer, tenant_id) VALUES (?, ?, ?)`,
      [userQuery, answer, tid]
    );
    console.log('[AI Cache] New Q&A saved to DB.');
  } catch (err) {
    // Non-fatal — log and continue (don't break user response)
    console.error('[AI Cache] DB save error:', err.message);
  }
}

// ─── Warehouse Context Builder ────────────────────────────────────────────────
async function buildWarehouseContext(tid) {
  const [stockRows, lowStockRows, locationRows] = await Promise.all([
    // Stock summary
    query(
      `SELECT p.name, p.code AS sku,
              COALESCE(SUM(ss.total_boxes), 0) AS stock
       FROM products p
       LEFT JOIN stock_summary ss
         ON ss.product_id = p.id AND ss.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
       GROUP BY p.id, p.name, p.code
       ORDER BY stock DESC
       LIMIT 20`,
      [tid]
    ),
    // Low stock
    query(
      `SELECT p.name,
              COALESCE(SUM(ss.total_boxes), 0) AS stock,
              p.reorder_level_boxes
       FROM products p
       LEFT JOIN stock_summary ss
         ON ss.product_id = p.id AND ss.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
       GROUP BY p.id, p.name, p.reorder_level_boxes
       HAVING stock <= GREATEST(COALESCE(p.reorder_level_boxes, 0), 5)
       ORDER BY stock ASC
       LIMIT 10`,
      [tid]
    ),
    // Rack locations
    query(
      `SELECT p.name AS product,
              w.name AS warehouse,
              r.name AS rack,
              pr.boxes_stored AS boxes
       FROM product_racks pr
       JOIN products p   ON p.id  = pr.product_id
       JOIN racks r      ON r.id  = pr.rack_id
       JOIN warehouses w ON w.id  = r.warehouse_id
       WHERE pr.tenant_id = ?
       ORDER BY pr.boxes_stored DESC
       LIMIT 20`,
      [tid]
    ),
  ]);

  const stockContext = stockRows.length
    ? stockRows.map((r) => `• ${r.name} (SKU: ${r.sku}) – ${r.stock} boxes`).join('\n')
    : 'No stock data available.';

  const lowStockContext = lowStockRows.length
    ? lowStockRows
        .map((r) => `• ${r.name} – ${r.stock} boxes (reorder: ${r.reorder_level_boxes ?? 0})`)
        .join('\n')
    : 'None — all products are well-stocked.';

  const locationContext = locationRows.length
    ? locationRows
        .map((r) => `• ${r.product} → ${r.warehouse}, Rack "${r.rack}" (${r.boxes} boxes)`)
        .join('\n')
    : 'No rack assignments recorded yet.';

  return { stockContext, lowStockContext, locationContext };
}

// ─── Resolve tenant UUID ─────────────────────────────────────────────────────
/**
 * Returns a valid tenant UUID.
 * If tenantId looks like an integer (e.g. 1) or is missing, fetch the first
 * tenant UUID from the DB so stock queries always match.
 */
async function resolveTenantId(tenantId) {
  // If tenantId is already a UUID-shaped string (contains '-'), trust it
  if (tenantId && typeof tenantId === 'string' && tenantId.includes('-')) {
    return tenantId;
  }
  // Otherwise fetch the tenant_id actually used in products (guaranteed to match stock data)
  try {
    const rows = await query('SELECT DISTINCT tenant_id FROM products LIMIT 1');
    if (rows && rows.length > 0) return rows[0].tenant_id;
  } catch (e) {
    console.error('[AI] Could not resolve tenant UUID from products:', e.message);
  }
  // Final fallback: try tenants table
  try {
    const rows = await query('SELECT id FROM tenants LIMIT 1');
    if (rows && rows.length > 0) return rows[0].id;
  } catch (e) {
    console.error('[AI] Could not resolve tenant UUID from tenants:', e.message);
  }
  return tenantId; // last resort
}

// ─── Main Export ──────────────────────────────────────────────────────────────
exports.processAI = async (userQuery, tenantId) => {
  const tid = await resolveTenantId(tenantId);

  // ── Guard: empty query ────────────────────────────────────────────────────
  if (!userQuery || !userQuery.trim()) {
    return '⚠️ Please type a question so I can help you.';
  }

  const normalizedQuery = normalize(userQuery);

  // ── Step 1: Instant greeting response (no DB, no API) ────────────────────
  if (GREETINGS.has(normalizedQuery)) {
    return '👋 Hello! I am your Warehouse Management AI Assistant. Ask me about stock levels, product locations, low-stock alerts, or how to use the system!';
  }

  // ── Categorize Question (Static vs Dynamic) ──────────────────────────────
  // Dynamic refers to questions needing real-time stock/rack/order data.
  const dynamicKeywords = [
    'stock', 'inventory', 'rack', 'how many', 'product', 'item', 'balance', 
    'low', 'order', 'status', 'grn', 'location', 'where', 'assign', 'purchase',
    'sales', 'level', 'quantity', 'expire', 'damage', 'store', 'available'
  ];
  const isDynamic = dynamicKeywords.some(kw => normalizedQuery.includes(kw));

  // ── Step 2: Handle Static Questions (Predefined DB answers) ──────────────
  if (!isDynamic) {
    try {
      const dbRows = await fuzzySearchDB(normalizedQuery, tid);
      if (dbRows.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        for (const row of dbRows) {
          const score = diceCoefficient(normalizedQuery, normalize(row.question));
          if (score > bestScore) {
            bestScore = score;
            bestMatch = row;
          }
        }

        if (bestMatch && bestScore >= 0.55) {
          console.log(`[AI] ✅ Static Match! Served from DB (${(bestScore * 100).toFixed(0)}% similar). Skipping OpenAI.`);
          query(`UPDATE ai_chat_history SET hit_count = hit_count + 1, updated_at = NOW() WHERE id = ? AND tenant_id = ?`, [bestMatch.id, tid]).catch(() => {});
          return bestMatch.answer;
        }
      }
    } catch (dbErr) {
      console.error('[AI Cache] DB search error:', dbErr.message);
    }

    // ── Step 2b: General/Setup question — call OpenAI with a WMS guide prompt ─
    console.log('[AI] 📖 General question. Calling OpenAI with WMS guide prompt...');
    try {
      const generalPrompt = `You are an expert assistant for "Tiles WMS" — a Warehouse Management System built specifically for tiles/ceramics businesses.

You know every detail of this system. Here is the complete module breakdown:

━━━ SETUP (Do this first) ━━━
1. GST Config → Add company GSTIN, legal name, state, PAN, invoice prefix (e.g. INV), fiscal year start.
2. Warehouses → Add warehouse (name, code, location, capacity in boxes). Each warehouse has racks.
3. Racks → Add racks inside warehouses (aisle, row, column, level auto-generates rack name). Set max capacity (boxes).
4. Users → Create users with roles: Super Admin, Admin, Warehouse Manager, Sales, Accountant, User. Assign warehouse if needed.

━━━ MASTER DATA ━━━
5. Categories → Group products (e.g. Ceramic, Vitrified, Marble).
6. Products → Add tile products: name, code, category, size (LxW mm), pieces/box, sqft/box, GST rate %, MRP, reorder level.
7. Vendors → Suppliers from whom you purchase tiles. Include contact, GST, address.
8. Customers → Buyers to whom you sell. Include contact, GST, billing/shipping address.

━━━ PURCHASE FLOW ━━━
9. Purchase Orders (PO) → Create PO selecting vendor + warehouse + products + boxes + price. Status: Draft → Confirm → Approve.
10. GRN (Goods Receipt Note) → After PO is approved, create GRN to physically receive stock. Assign each product to a rack. This INCREASES inventory.
11. Purchase Returns → Return damaged/wrong goods back to vendor. Status: Draft → Dispatch (reduces stock).

━━━ INVENTORY MANAGEMENT ━━━
12. Opening Stock → In Inventory Stock page, add initial stock for existing products (boxes + pieces per warehouse).
13. Stock Transfers → Move stock between warehouses. Status: Draft → Dispatch (moves stock).
14. Stock Adjustments → Manually add or deduct stock with a reason. Needs approval.
15. Damage Entries → Record damaged boxes — reduces stock immediately on creation.
16. Stock Counts → Physical count of stock. Types: Full / Cycle / Spot. Compare system vs counted boxes.
17. Stock Ledger → Full history of all movements per product/warehouse.

━━━ SALES FLOW ━━━
18. Sales Orders (SO) → Create SO selecting customer + warehouse + products. Status: Draft → Confirm (auto-creates Pick List).
19. Pick Lists → Generated from confirmed SO. Mark items as picked from racks.
20. Delivery Challans (DC) → Create DC from a completed pick list. Dispatch DC → reduces stock + auto-generates Invoice.
21. Invoices → Auto-created on DC dispatch. Can also create manually from confirmed SO. Issue invoice to finalize.
22. Sales Returns → Customer returns tiles. Receive return → increases stock + auto-creates Credit Note.

━━━ ACCOUNTS ━━━
23. Payments Received → Record payments from customers against invoices.
24. Payments Made → Record payments to vendors against purchase orders.
25. Credit Notes → Created when customer returns goods (via Sales Return) or manual credit.
26. Debit Notes → Created against purchase returns to vendor.

━━━ REPORTS ━━━
27. GST Report → GSTR-1 style monthly invoice-wise tax summary.
28. Revenue Report → Monthly revenue trends, top products, top customers.
29. Aging Report → Outstanding customer invoice aging buckets (0-30, 31-60, 61-90, 90+ days).

━━━ ALERTS ━━━
30. Low Stock Alerts → Auto-triggered when product stock falls below reorder level. Can Acknowledge or Resolve.

━━━ RULES ━━━
- Give SHORT, PRECISE, step-by-step answers specific to this software.
- Use numbered steps or bullet points.
- Do NOT give generic advice like "train your users".
- If the question is about a specific feature, explain exactly how to use it in this system.
- Answer in the same language the user asked (English/Arabic/Hindi/Hinglish).`;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: generalPrompt },
          { role: 'user',   content: userQuery },
        ],
        max_tokens: 400,
        temperature: 0.5,
      });

      const aiAnswer = aiResponse.choices[0].message.content;

      // Save to DB so future similar questions are answered faster from cache
      saveOrUpdateDB(userQuery, normalizedQuery, aiAnswer, tid).catch(() => {});

      return aiAnswer;
    } catch (openAiErr) {
      console.error('[AI] OpenAI general call failed:', openAiErr.message);
      return 'I am unable to answer right now. Please try again shortly or contact your administrator.';
    }
  }

  // ── Step 3: Handle Dynamic Questions (OpenAI + Real-time Data) ───────────
  console.log('[AI] 🤖 Dynamic Question detected. Calling OpenAI...');

  // Build context (only what is necessary to save tokens)
  const { stockContext, lowStockContext, locationContext } = await buildWarehouseContext(tid);

  const systemPrompt = `You are a warehouse assistant.
Answer based ONLY on the data below. Keep the answer strictly concise and relevant.

--- DATA ---
Stock:
${stockContext}

Low Stock Alerts:
${lowStockContext}

Rack Locations:
${locationContext}
-----------
Rules:
- Give short, concise answers (1-3 sentences).
- If the data is not present in the context above, politely say "I do not have real-time data for this request right now."
- Use bullet points if listing items.`;

  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userQuery },
    ],
    max_tokens: 300,
    temperature: 0.3, // Lower temperature for more factual, concise answers
  });

  const aiAnswer = aiResponse.choices[0].message.content;

  // We do NOT save dynamic questions to DB cache, to prevent returning stale stock data!
  return aiAnswer;
};