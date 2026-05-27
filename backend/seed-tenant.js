'use strict';

/**
 * Targeted full seed for an existing real (non-dummy) tenant.
 * Populates ALL pages: master data → transactions → extra modules.
 *
 * Usage:  node seed-tenant.js <tenantId>
 * Example: node seed-tenant.js 019c4122-cb85-4fda-822b-ba9d54145f0b
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { query, beginTransaction, testConnection } = require('./src/config/db');
const {
  WAREHOUSE_NAMES, getRackNames, VENDOR_NAMES, CUSTOMER_NAMES,
  CATEGORIES, PRODUCT_TEMPLATES, SHADE_NAMES, SHADE_HEX,
} = require('./src/database/seed/fixtures');

const uuid  = () => uuidv4();
const today = () => new Date().toISOString().slice(0, 10);
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
const pick  = (arr, i) => arr[i % arr.length];

async function seedTenant(tenantId) {
  // ── Verify tenant + get admin user ────────────────────────────────────────
  const tenantRows = await query('SELECT id, name FROM tenants WHERE id = ?', [tenantId]);
  if (!tenantRows.length) { console.error('Tenant not found:', tenantId); process.exit(1); }
  console.log(`\nSeeding tenant: ${tenantRows[0].name} (${tenantId.slice(0,8)}...)`);

  const adminRows = await query("SELECT id FROM users WHERE tenant_id = ? AND role IN ('admin','super_admin') LIMIT 1", [tenantId]);
  if (!adminRows.length) { console.error('No admin user found for tenant.'); process.exit(1); }
  const adminId = adminRows[0].id;
  const yr = new Date().getFullYear();

  const trx = await beginTransaction();
  const log = (msg, n) => console.log(`  [${msg}]`, n ?? '');

  try {
    // ── GST config ────────────────────────────────────────────────────────
    const gstExists = await trx.query('SELECT id FROM gst_configurations WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!gstExists.length) {
      await trx.query(
        `INSERT INTO gst_configurations (id, tenant_id, gstin, legal_name, trade_name, state_code, state_name, pan, default_gst_rate, fiscal_year_start, is_composition_scheme, created_at, updated_at)
         VALUES (?, ?, '29AABCA1234Z1Z5', 'AR Sports Tiles Pvt Ltd', 'AR Sports', '29', 'Karnataka', 'AABCA1234Z', 18.00, '04-01', 0, NOW(), NOW())`,
        [uuid(), tenantId]
      );
      log('GST config', 1);
    }

    // ── Document counters ─────────────────────────────────────────────────
    const ctrExists = await trx.query('SELECT id FROM document_counters WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!ctrExists.length) {
      for (const dt of ['PO','GRN','SO','INV','CN','DN','CP','VP','TR','SR','PR','PICK','DC','SA','CNT']) {
        await trx.query(
          `INSERT INTO document_counters (id, tenant_id, doc_type, prefix, year, last_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
          [uuid(), tenantId, dt, dt, yr]
        );
      }
      log('Document counters', 15);
    }

    // ── Warehouses ────────────────────────────────────────────────────────
    let whIds = (await trx.query('SELECT id FROM warehouses WHERE tenant_id = ? AND is_active = 1', [tenantId])).map(r => r.id);
    if (!whIds.length) {
      const whDefs = [
        { name: 'Main Store',      code: 'WH-MAIN', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
        { name: 'Secondary Store', code: 'WH-SEC',  city: 'Mysore',    state: 'Karnataka', pincode: '570001' },
      ];
      for (const w of whDefs) {
        const id = uuid(); whIds.push(id);
        await trx.query(
          `INSERT INTO warehouses (id, tenant_id, name, code, address, city, state, pincode, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [id, tenantId, w.name, w.code, `${w.name}, ${w.city}`, w.city, w.state, w.pincode]
        );
      }
      log('Warehouses', whIds.length);
    }
    const wh1 = whIds[0], wh2 = whIds[1] ?? whIds[0];

    // ── Racks ─────────────────────────────────────────────────────────────
    let rackIds = (await trx.query('SELECT id FROM racks WHERE tenant_id = ? AND is_active = 1 LIMIT 20', [tenantId])).map(r => r.id);
    if (!rackIds.length) {
      const rackDefs = getRackNames(0);
      for (const wid of whIds) {
        for (let r = 0; r < Math.min(8, rackDefs.length); r++) {
          const rn = rackDefs[r]; const rid = uuid(); rackIds.push(rid);
          await trx.query(
            `INSERT INTO racks (id, tenant_id, warehouse_id, name, aisle, \`row\`, level, capacity_boxes, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [rid, tenantId, wid, rn.name, rn.aisle, rn.row, rn.level, rn.capacity_boxes]
          );
        }
      }
      log('Racks', rackIds.length);
    }

    // ── Product categories ────────────────────────────────────────────────
    let catIds = (await trx.query('SELECT id FROM product_categories WHERE tenant_id = ?', [tenantId])).map(r => r.id);
    if (!catIds.length) {
      for (const cat of CATEGORIES) {
        const id = uuid(); catIds.push(id);
        await trx.query(`INSERT INTO product_categories (id, tenant_id, name, parent_id, is_active) VALUES (?, ?, ?, NULL, 1)`, [id, tenantId, cat.name]);
      }
      log('Categories', catIds.length);
    }

    // ── Products + shades + batches ───────────────────────────────────────
    let productIds = (await trx.query('SELECT id FROM products WHERE tenant_id = ? AND is_active = 1', [tenantId])).map(r => r.id);
    const shadeMap = {};  // productId → [shadeId, ...]
    const batchIds = [];

    if (!productIds.length) {
      // ── Vendors first (needed for batches) ───────────────────────────────
      let vendorIds = (await trx.query('SELECT id FROM vendors WHERE tenant_id = ?', [tenantId])).map(r => r.id);
      if (!vendorIds.length) {
        for (const vn of VENDOR_NAMES) {
          const vid = uuid(); vendorIds.push(vid);
          await trx.query(
            `INSERT INTO vendors (id, tenant_id, name, code, contact_person, phone, email, address, gstin, pan, payment_terms_days, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30, 1, NOW())`,
            [vid, tenantId, vn.name, vn.code, vn.contact, vn.phone, vn.email, `${vn.name}, ${vn.city}`, vn.gstin, vn.pan]
          );
        }
        log('Vendors', vendorIds.length);
      }

      for (let p = 0; p < PRODUCT_TEMPLATES.length; p++) {
        const pt = PRODUCT_TEMPLATES[p];
        const pid = uuid(); productIds.push(pid);
        const catId = catIds[p % 4];
        const sqmt = (pt.sqft * 0.092903).toFixed(4);
        await trx.query(
          `INSERT INTO products (id, tenant_id, category_id, name, code, description, size_length_mm, size_width_mm, size_thickness_mm, size_label, pieces_per_box, sqft_per_box, sqmt_per_box, gst_rate, mrp, reorder_level_boxes, brand, finish, material, hsn_code, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [pid, tenantId, catId, pt.name, `PRD-${String(p+1).padStart(3,'0')}`, pt.name, pt.sizeL, pt.sizeW, pt.sizeT, pt.sizeLabel, pt.pieces, pt.sqft, sqmt, pt.gst, pt.mrp, pt.brand, pt.finish, pt.material, pt.hsn]
        );
        // shades
        shadeMap[pid] = [];
        for (let s = 0; s < 2; s++) {
          const sid = uuid(); shadeMap[pid].push(sid);
          await trx.query(
            `INSERT INTO shades (id, tenant_id, product_id, shade_code, shade_name, hex_color, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
            [sid, tenantId, pid, `SH-${p}-${s}`, SHADE_NAMES[(p+s)%SHADE_NAMES.length], SHADE_HEX[(p+s)%SHADE_HEX.length]]
          );
        }
        // batch
        const bid = uuid(); batchIds.push(bid);
        await trx.query(
          `INSERT INTO batches (id, tenant_id, product_id, shade_id, batch_number, production_date, expiry_date, grade, vendor_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'A', ?, NOW())`,
          [bid, tenantId, pid, shadeMap[pid][0], `BAT-${today().replace(/-/g,'')}-${p+1}`, addDays(today(),-30), addDays(today(),365), pick(vendorIds, p)]
        );
      }
      log('Products + shades + batches', productIds.length);
    } else {
      // products exist — load shade/batch maps
      const shRows = await trx.query('SELECT id, product_id FROM shades WHERE tenant_id = ?', [tenantId]);
      for (const r of shRows) { if (!shadeMap[r.product_id]) shadeMap[r.product_id]=[]; shadeMap[r.product_id].push(r.id); }
      const bRows = await trx.query('SELECT id FROM batches WHERE tenant_id = ? LIMIT 20', [tenantId]);
      batchIds.push(...bRows.map(r => r.id));
    }

    // ── Customers ─────────────────────────────────────────────────────────
    let customerIds = (await trx.query('SELECT id FROM customers WHERE tenant_id = ?', [tenantId])).map(r => r.id);
    if (!customerIds.length) {
      for (const cn of CUSTOMER_NAMES) {
        const cid = uuid(); customerIds.push(cid);
        await trx.query(
          `INSERT INTO customers (id, tenant_id, name, code, contact_person, phone, email, billing_address, shipping_address, gstin, state_code, credit_limit, payment_terms_days, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 500000, 30, 1, NOW())`,
          [cid, tenantId, cn.name, cn.code, cn.contact, cn.phone, cn.email, `${cn.name}, ${cn.city}`, `${cn.name}, ${cn.city}`, cn.gstin, cn.state_code]
        );
      }
      log('Customers', customerIds.length);
    }

    let vendorIds = (await trx.query('SELECT id FROM vendors WHERE tenant_id = ?', [tenantId])).map(r => r.id);

    // helper shorthands
    const prodId  = i => pick(productIds, i);
    const shadeId = i => { const pid = prodId(i); return (shadeMap[pid] ?? [])[0] ?? null; };
    const batchId = i => pick(batchIds, i) ?? null;
    const rackId  = i => pick(rackIds, i) ?? null;

    // ── Stock summary (10 products in main WH) ─────────────────────────────
    const ssExists = await trx.query('SELECT id FROM stock_summary WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!ssExists.length) {
      for (let pi = 0; pi < Math.min(10, productIds.length); pi++) {
        const boxes = 30 + pi * 5;
        const sqft  = (boxes * PRODUCT_TEMPLATES[pi].sqft).toFixed(4);
        await trx.query(
          `INSERT INTO stock_summary (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id, total_boxes, total_pieces, total_sqft, avg_cost_per_box, last_receipt_date, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 38, ?, NOW())`,
          [uuid(), tenantId, wh1, rackId(pi), prodId(pi), shadeId(pi), batchId(pi), boxes, sqft, addDays(today(),-5)]
        );
      }
      log('Stock summary', 10);
    }

    // ── Stock ledger (opening entries) ─────────────────────────────────────
    const slExists = await trx.query('SELECT id FROM stock_ledger WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!slExists.length) {
      for (let pi = 0; pi < 5; pi++) {
        const boxes = 20; const sqft = (PRODUCT_TEMPLATES[pi].sqft * boxes).toFixed(4);
        await trx.query(
          `INSERT INTO stock_ledger (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id, transaction_type, reference_id, reference_type, boxes_in, boxes_out, pieces_in, pieces_out, balance_boxes, balance_pieces, sqft_in, sqft_out, transaction_date, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'opening', NULL, NULL, ?, 0, 0, 0, ?, 0, ?, 0, ?, ?, NOW())`,
          [uuid(), tenantId, wh1, rackId(pi), prodId(pi), shadeId(pi), batchId(pi), boxes, boxes, sqft, addDays(today(),-20), adminId]
        );
      }
      log('Stock ledger', 5);
    }

    // ── Purchase orders (3) + items ────────────────────────────────────────
    let poIds = (await trx.query('SELECT id FROM purchase_orders WHERE tenant_id = ?', [tenantId])).map(r => r.id);
    if (!poIds.length) {
      for (let po = 0; po < 3; po++) {
        const poId = uuid(); poIds.push(poId);
        const vId = pick(vendorIds, po);
        const poNum = `PO-${yr}-${String(po+1).padStart(4,'0')}`;
        const orderDate = addDays(today(), -15 - po * 5);
        await trx.query(
          `INSERT INTO purchase_orders (id, tenant_id, po_number, vendor_id, warehouse_id, status, return_status, order_date, expected_date, total_amount, discount_amount, tax_amount, grand_total, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'received', 'none', ?, ?, 0, 0, 0, 0, ?, NOW(), NOW())`,
          [poId, tenantId, poNum, vId, wh1, orderDate, addDays(orderDate, 7), adminId]
        );
        let poTotal = 0;
        for (let it = 0; it < 2 + (po%2); it++) {
          const boxes = 20 + it*10; const unitPrice = 35 + it*5; const lineTotal = boxes * unitPrice;
          poTotal += lineTotal;
          await trx.query(
            `INSERT INTO purchase_order_items (id, tenant_id, purchase_order_id, product_id, shade_id, ordered_boxes, ordered_pieces, received_boxes, unit_price, discount_pct, tax_pct, line_total)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 18, ?)`,
            [uuid(), tenantId, poId, prodId(po*2+it), shadeId(po*2+it), boxes, boxes, unitPrice, lineTotal]
          );
        }
        const tax = poTotal * 0.18;
        await trx.query(`UPDATE purchase_orders SET total_amount=?, tax_amount=?, grand_total=? WHERE id=?`, [poTotal, tax, poTotal+tax, poId]);
      }
      log('Purchase orders', 3);
    }

    // ── GRN (2) + items ───────────────────────────────────────────────────
    let grnIds = (await trx.query('SELECT id FROM grn WHERE tenant_id = ?', [tenantId])).map(r => r.id);
    let grnItemRows = [];
    if (!grnIds.length) {
      for (let g = 0; g < 2; g++) {
        const grnId = uuid(); grnIds.push(grnId);
        const grnNum = `GRN-${yr}-${String(g+1).padStart(4,'0')}`;
        await trx.query(
          `INSERT INTO grn (id, tenant_id, grn_number, purchase_order_id, vendor_id, warehouse_id, receipt_date, invoice_number, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, NOW())`,
          [grnId, tenantId, grnNum, pick(poIds, g), pick(vendorIds, g), wh1, addDays(today(), -10-g), `INV-V-${g+1}`, adminId]
        );
        for (let it = 0; it < 2; it++) {
          const giId = uuid();
          const boxes = 15 + it*5;
          await trx.query(
            `INSERT INTO grn_items (id, tenant_id, grn_id, product_id, shade_id, batch_id, rack_id, received_boxes, received_pieces, damaged_boxes, unit_price, quality_status, barcode_printed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 38, 'pass', 0)`,
            [giId, tenantId, grnId, prodId(g*2+it), shadeId(g*2+it), batchId(g*2+it), rackId(it), boxes]
          );
          grnItemRows.push({ id: giId, grn_id: grnId, product_id: prodId(g*2+it), shade_id: shadeId(g*2+it), batch_id: batchId(g*2+it), received_boxes: boxes, unit_price: 38 });
        }
      }
      log('GRN', 2);
    } else {
      grnItemRows = await trx.query('SELECT id, grn_id, product_id, shade_id, batch_id, received_boxes, unit_price FROM grn_items WHERE tenant_id = ? LIMIT 6', [tenantId]);
    }

    // ── Sales orders (4) + items ───────────────────────────────────────────
    let soIds = (await trx.query('SELECT id FROM sales_orders WHERE tenant_id = ?', [tenantId])).map(r => r.id);
    let soItemRows = [];
    if (!soIds.length) {
      for (let so = 0; so < 4; so++) {
        const soId = uuid(); soIds.push(soId);
        const cId = pick(customerIds, so);
        const soNum = `SO-${yr}-${String(so+1).padStart(4,'0')}`;
        const orderDate = addDays(today(), -8-so);
        const status = so < 2 ? 'delivered' : 'confirmed';
        await trx.query(
          `INSERT INTO sales_orders (id, tenant_id, so_number, customer_id, warehouse_id, status, order_date, expected_delivery_date, sub_total, discount_amount, tax_amount, grand_total, payment_status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 'pending', ?, NOW(), NOW())`,
          [soId, tenantId, soNum, cId, wh1, status, orderDate, addDays(orderDate, 3), adminId]
        );
        let soTotal = 0;
        for (let it = 0; it < 2; it++) {
          const siId = uuid();
          const boxes = 5 + it*3; const unitPrice = 48; const lineTotal = boxes * unitPrice;
          soTotal += lineTotal;
          await trx.query(
            `INSERT INTO sales_order_items (id, tenant_id, sales_order_id, product_id, shade_id, ordered_boxes, ordered_pieces, dispatched_boxes, unit_price, discount_pct, tax_pct, line_total)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 18, ?)`,
            [siId, tenantId, soId, prodId(so+it), shadeId(so+it), boxes, so < 2 ? boxes : 0, unitPrice, lineTotal]
          );
          soItemRows.push({ id: siId, sales_order_id: soId, product_id: prodId(so+it), shade_id: shadeId(so+it), ordered_boxes: boxes, unit_price: unitPrice });
        }
        const tax = soTotal * 0.18;
        await trx.query(`UPDATE sales_orders SET sub_total=?, tax_amount=?, grand_total=? WHERE id=?`, [soTotal, tax, soTotal+tax, soId]);
      }
      log('Sales orders', 4);
    } else {
      soItemRows = await trx.query('SELECT id, sales_order_id, product_id, shade_id, ordered_boxes, unit_price FROM sales_order_items WHERE tenant_id = ? LIMIT 10', [tenantId]);
    }

    // Also fetch SO customer_id for DC seeding
    const soFullRows = await trx.query('SELECT id, customer_id, warehouse_id FROM sales_orders WHERE tenant_id = ? LIMIT 4', [tenantId]);

    // ── Invoices (2) ──────────────────────────────────────────────────────
    let invIds = (await trx.query('SELECT id FROM invoices WHERE tenant_id = ?', [tenantId])).map(r => r.id);
    if (!invIds.length) {
      for (let inv = 0; inv < 2; inv++) {
        const invId = uuid(); invIds.push(invId);
        const soId = soIds[inv];
        const soRows2 = await trx.query('SELECT customer_id, grand_total, sub_total, tax_amount FROM sales_orders WHERE id=?', [soId]);
        const soRow = soRows2[0];
        const invNum = `INV-${yr}-${String(inv+1).padStart(4,'0')}`;
        const tax = soRow.tax_amount || 0; const cgst = tax / 2;
        await trx.query(
          `INSERT INTO invoices (id, tenant_id, invoice_number, sales_order_id, customer_id, invoice_date, due_date, sub_total, discount_amount, cgst_amount, sgst_amount, igst_amount, grand_total, payment_status, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'pending', 'issued', ?, NOW(), NOW())`,
          [invId, tenantId, invNum, soId, soRow.customer_id, addDays(today(),-5-inv), addDays(today(),25), soRow.sub_total, cgst, cgst, soRow.grand_total, adminId]
        );
        const items = await trx.query('SELECT product_id, shade_id, ordered_boxes, unit_price, line_total FROM sales_order_items WHERE sales_order_id=?', [soId]);
        for (const item of items) {
          const taxable = item.line_total || 0; const cgstAmt = taxable * 0.09;
          await trx.query(
            `INSERT INTO invoice_items (id, tenant_id, invoice_id, product_id, shade_id, quantity_boxes, unit_price, discount_pct, taxable_amount, gst_rate, cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 18, 9, 9, 0, ?, ?, 0, ?)`,
            [uuid(), tenantId, invId, item.product_id, item.shade_id, item.ordered_boxes, item.unit_price, taxable, cgstAmt, cgstAmt, item.line_total]
          );
        }
      }
      log('Invoices', 2);
    }

    // ── Customer payments (2) ─────────────────────────────────────────────
    const cpExists = await trx.query('SELECT id FROM customer_payments WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!cpExists.length) {
      for (let cp = 0; cp < 2; cp++) {
        await trx.query(
          `INSERT INTO customer_payments (id, tenant_id, payment_number, customer_id, invoice_id, payment_date, amount, payment_mode, reference_number, bank_name, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 5000, 'neft', ?, 'HDFC Bank', 'cleared', ?, NOW())`,
          [uuid(), tenantId, `CP-${yr}-${String(cp+1).padStart(4,'0')}`, pick(customerIds,cp), invIds[cp]??invIds[0], addDays(today(),-2), `NEFT${100000+cp}`, adminId]
        );
      }
      log('Customer payments', 2);
    }

    // ── Vendor payments (2) ───────────────────────────────────────────────
    const vpExists = await trx.query('SELECT id FROM vendor_payments WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!vpExists.length) {
      for (let vp = 0; vp < 2; vp++) {
        await trx.query(
          `INSERT INTO vendor_payments (id, tenant_id, payment_number, vendor_id, purchase_order_id, payment_date, amount, payment_mode, reference_number, bank_name, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 10000, 'neft', ?, 'ICICI Bank', 'cleared', ?, NOW())`,
          [uuid(), tenantId, `VP-${yr}-${String(vp+1).padStart(4,'0')}`, pick(vendorIds,vp), poIds[vp], addDays(today(),-4), `NEFT${200000+vp}`, adminId]
        );
      }
      log('Vendor payments', 2);
    }

    // ── Pick lists (3) ─────────────────────────────────────────────────────
    const plExists = await trx.query('SELECT id FROM pick_lists WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!plExists.length && soFullRows.length) {
      const plDefs = [
        { so: soFullRows[0], status: 'completed',   daysAgo: 8 },
        { so: soFullRows[1]??soFullRows[0], status: 'in_progress', daysAgo: 3 },
        { so: soFullRows[2]??soFullRows[0], status: 'pending',     daysAgo: 1 },
      ];
      for (let i = 0; i < plDefs.length; i++) {
        const { so, status, daysAgo } = plDefs[i];
        const plId = uuid();
        await trx.query(
          `INSERT INTO pick_lists (id, tenant_id, sales_order_id, pick_number, warehouse_id, status, assigned_to, started_at, completed_at, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [plId, tenantId, so.id, `PICK-${yr}-${String(i+1).padStart(4,'0')}`, so.warehouse_id||wh1, status, adminId,
           status !== 'pending' ? addDays(today(), -(daysAgo-1)) : null,
           status === 'completed' ? addDays(today(), -daysAgo+1) : null, adminId]
        );
        const soItems = soItemRows.filter(r => r.sales_order_id === so.id);
        for (const item of soItems) {
          await trx.query(
            `INSERT INTO pick_list_items (id, tenant_id, pick_list_id, sales_order_item_id, product_id, shade_id, batch_id, rack_id, requested_boxes, picked_boxes, picked_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), tenantId, plId, item.id, item.product_id, item.shade_id, batchId(0), rackId(0),
             item.ordered_boxes,
             status === 'completed' ? item.ordered_boxes : status === 'in_progress' ? Math.floor(item.ordered_boxes/2) : 0,
             status !== 'pending' ? addDays(today(), -(daysAgo-1)) : null,
             status === 'completed' ? 'picked' : 'pending']
          );
        }
      }
      log('Pick lists', 3);
    }

    // ── Delivery challans (3) ─────────────────────────────────────────────
    const dcExists = await trx.query('SELECT id FROM delivery_challans WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!dcExists.length && soFullRows.length) {
      const dcDefs = [
        { so: soFullRows[0], status: 'delivered',  daysAgo: 7, vehicle: 'KA-01-AB-1234' },
        { so: soFullRows[1]??soFullRows[0], status: 'dispatched', daysAgo: 2, vehicle: 'KA-02-CD-5678' },
        { so: soFullRows[2]??soFullRows[0], status: 'draft',      daysAgo: 0, vehicle: null },
      ];
      for (let i = 0; i < dcDefs.length; i++) {
        const { so, status, daysAgo, vehicle } = dcDefs[i];
        const dcId = uuid();
        await trx.query(
          `INSERT INTO delivery_challans (id, tenant_id, dc_number, sales_order_id, customer_id, warehouse_id, dispatch_date, vehicle_number, transporter_name, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [dcId, tenantId, `DC-${yr}-${String(i+1).padStart(4,'0')}`, so.id, so.customer_id, so.warehouse_id||wh1,
           addDays(today(),-daysAgo), vehicle, vehicle ? 'Express Logistics' : null, status, adminId]
        );
        const soItems = soItemRows.filter(r => r.sales_order_id === so.id);
        for (const item of soItems) {
          await trx.query(
            `INSERT INTO delivery_challan_items (id, tenant_id, delivery_challan_id, product_id, shade_id, dispatched_boxes, dispatched_pieces, dispatched_sqft, unit_price)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [uuid(), tenantId, dcId, item.product_id, item.shade_id, item.ordered_boxes,
             (Number(item.ordered_boxes) * 13.38).toFixed(4), item.unit_price]
          );
        }
      }
      log('Delivery challans', 3);
    }

    // ── Stock transfers (3) ───────────────────────────────────────────────
    const stExists = await trx.query('SELECT id FROM stock_transfers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!stExists.length) {
      const stDefs = [
        { status: 'received',   daysAgo: 10, fromWh: wh1, toWh: wh2 },
        { status: 'in_transit', daysAgo: 3,  fromWh: wh1, toWh: wh2 },
        { status: 'draft',      daysAgo: 1,  fromWh: wh2, toWh: wh1 },
      ];
      for (let i = 0; i < stDefs.length; i++) {
        const { status, daysAgo, fromWh, toWh } = stDefs[i];
        const stId = uuid();
        await trx.query(
          `INSERT INTO stock_transfers (id, tenant_id, transfer_number, from_warehouse_id, to_warehouse_id, status, transfer_date, received_date, vehicle_number, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [stId, tenantId, `TR-${yr}-${String(i+1).padStart(4,'0')}`, fromWh, toWh, status,
           addDays(today(),-daysAgo), status==='received' ? addDays(today(),-daysAgo+2) : null,
           `KA-03-ZZ-${1000+i}`, adminId]
        );
        for (let j = 0; j < 2; j++) {
          await trx.query(
            `INSERT INTO stock_transfer_items (id, tenant_id, transfer_id, product_id, shade_id, batch_id, from_rack_id, to_rack_id, transferred_boxes, transferred_pieces, received_boxes, discrepancy_boxes)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, 0)`,
            [uuid(), tenantId, stId, prodId(i*2+j), batchId(j), rackId(j), rackId(j+1),
             10+j*5, status==='received' ? 10+j*5 : 0]
          );
        }
      }
      log('Stock transfers', 3);
    }

    // ── Stock adjustments (4) ─────────────────────────────────────────────
    const saExists = await trx.query('SELECT id FROM stock_adjustments WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!saExists.length) {
      const saDefs = [
        { type:'add',    boxes:10, reason:'Found during cycle count',            status:'approved', daysAgo:12 },
        { type:'deduct', boxes:5,  reason:'Damaged tiles written off',           status:'approved', daysAgo:6  },
        { type:'add',    boxes:8,  reason:'Returns from site — good condition',  status:'pending',  daysAgo:1  },
        { type:'deduct', boxes:3,  reason:'Breakage at loading dock',            status:'pending',  daysAgo:0  },
      ];
      for (let i = 0; i < saDefs.length; i++) {
        const { type, boxes, reason, status, daysAgo } = saDefs[i];
        await trx.query(
          `INSERT INTO stock_adjustments (id, tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id, adjustment_type, boxes, pieces, reason, status, approved_by, approved_at, created_by, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NOW())`,
          [uuid(), tenantId, wh1, prodId(i), batchId(i), rackId(i), type, boxes, reason, status,
           status==='approved' ? adminId : null,
           status==='approved' ? addDays(today(),-daysAgo+1) : null, adminId]
        );
      }
      log('Stock adjustments', 4);
    }

    // ── Damage entries (4) ────────────────────────────────────────────────
    const deExists = await trx.query('SELECT id FROM damage_entries WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!deExists.length) {
      const deDefs = [
        { boxes:3, reason:'Breakage during unloading', loss:2100, daysAgo:9 },
        { boxes:2, reason:'Water damage in storage',   loss:1400, daysAgo:5 },
        { boxes:5, reason:'Transit damage',            loss:3500, daysAgo:2 },
        { boxes:1, reason:'Incorrect stacking',        loss:700,  daysAgo:0 },
      ];
      for (let i = 0; i < deDefs.length; i++) {
        const { boxes, reason, loss, daysAgo } = deDefs[i];
        await trx.query(
          `INSERT INTO damage_entries (id, tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id, damage_date, damaged_boxes, damaged_pieces, damage_reason, estimated_loss, approved_by, created_by, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW())`,
          [uuid(), tenantId, wh1, prodId(i), batchId(i), rackId(i), addDays(today(),-daysAgo), boxes, reason, loss, adminId, adminId]
        );
      }
      log('Damage entries', 4);
    }

    // ── Sales returns (3) ─────────────────────────────────────────────────
    const srExists = await trx.query('SELECT id FROM sales_returns WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!srExists.length && soFullRows.length) {
      const srDefs = [
        { so: soFullRows[0], status:'completed', reason:'Shade mismatch', daysAgo:6, boxes:3 },
        { so: soFullRows[1]??soFullRows[0], status:'received',   reason:'Cracked tiles', daysAgo:2, boxes:2 },
        { so: soFullRows[2]??soFullRows[0], status:'draft',      reason:'Customer changed mind', daysAgo:0, boxes:4 },
      ];
      for (let i = 0; i < srDefs.length; i++) {
        const { so, status, reason, daysAgo, boxes } = srDefs[i];
        const srId = uuid();
        await trx.query(
          `INSERT INTO sales_returns (id, tenant_id, return_number, sales_order_id, customer_id, warehouse_id, return_date, return_reason, status, total_boxes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [srId, tenantId, `SR-${yr}-${String(i+1).padStart(4,'0')}`, so.id, so.customer_id, so.warehouse_id||wh1,
           addDays(today(),-daysAgo), reason, status, boxes, adminId]
        );
        const items = soItemRows.filter(r => r.sales_order_id === so.id).slice(0, 1);
        for (const item of items) {
          await trx.query(
            `INSERT INTO sales_return_items (id, tenant_id, sales_return_id, sales_order_item_id, product_id, shade_id, returned_boxes, returned_pieces, inspection_result, good_boxes, damaged_boxes, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'good', ?, 0, ?, ?)`,
            [uuid(), tenantId, srId, item.id, item.product_id, item.shade_id, boxes, boxes, item.unit_price, boxes*Number(item.unit_price)]
          );
        }
      }
      log('Sales returns', 3);
    }

    // ── Purchase returns (2) ──────────────────────────────────────────────
    const prExists = await trx.query('SELECT id FROM purchase_returns WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!prExists.length && grnIds.length) {
      const prDefs = [
        { grnIdx:0, status:'dispatched',   reason:'Defective batch — grade B supplied as A', daysAgo:5, boxes:4 },
        { grnIdx:1, status:'acknowledged', reason:'Over-supply — excess returned',            daysAgo:2, boxes:6 },
      ];
      for (let i = 0; i < prDefs.length; i++) {
        const { grnIdx, status, reason, daysAgo, boxes } = prDefs[i];
        const prId = uuid(); const grnId = grnIds[grnIdx] ?? grnIds[0];
        const grnRow = await trx.query('SELECT vendor_id FROM grn WHERE id=?', [grnId]);
        const vid = grnRow[0]?.vendor_id ?? pick(vendorIds,i);
        await trx.query(
          `INSERT INTO purchase_returns (id, tenant_id, return_number, grn_id, vendor_id, warehouse_id, return_date, reason, status, total_boxes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [prId, tenantId, `PR-${yr}-${String(i+1).padStart(4,'0')}`, grnId, vid, wh1, addDays(today(),-daysAgo), reason, status, boxes, adminId]
        );
        const grnItems = grnItemRows.filter(r => r.grn_id === grnId).slice(0,1);
        for (const item of grnItems) {
          await trx.query(
            `INSERT INTO purchase_return_items (id, tenant_id, purchase_return_id, grn_item_id, product_id, shade_id, batch_id, returned_boxes, returned_pieces, unit_price, return_reason, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [uuid(), tenantId, prId, item.id, item.product_id, item.shade_id, item.batch_id, boxes, item.unit_price, reason, boxes*Number(item.unit_price)]
          );
        }
      }
      log('Purchase returns', 2);
    }

    // ── Stock counts (3) ──────────────────────────────────────────────────
    const scExists = await trx.query('SELECT id FROM stock_counts WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!scExists.length) {
      const scDefs = [
        { type:'full',  status:'completed',   daysAgo:14, wh:wh1 },
        { type:'cycle', status:'in_progress', daysAgo:3,  wh:wh1 },
        { type:'spot',  status:'draft',       daysAgo:0,  wh:wh2 },
      ];
      for (let i = 0; i < scDefs.length; i++) {
        const { type, status, daysAgo, wh } = scDefs[i];
        const scId = uuid();
        await trx.query(
          `INSERT INTO stock_counts (id, tenant_id, count_number, warehouse_id, count_type, status, count_date, started_at, completed_at, assigned_to, variance_boxes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [scId, tenantId, `CNT-${yr}-${String(i+1).padStart(4,'0')}`, wh, type, status,
           addDays(today(),-daysAgo),
           status !== 'draft' ? addDays(today(),-daysAgo) : null,
           status === 'completed' ? addDays(today(),-daysAgo+1) : null,
           adminId, status === 'completed' ? -2 : 0, adminId]
        );
        const countProds = productIds.slice(i*3, i*3+5);
        for (let j = 0; j < countProds.length; j++) {
          const sysBoxes = 20 + j*5;
          const counted  = status === 'completed' ? sysBoxes - (j===2 ? 2 : 0) : null;
          const variance = counted !== null ? counted - sysBoxes : 0;
          await trx.query(
            `INSERT INTO stock_count_items (id, tenant_id, stock_count_id, product_id, shade_id, batch_id, rack_id, system_boxes, counted_boxes, variance_boxes, status, counted_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), tenantId, scId, countProds[j], batchId(j), rackId(j),
             sysBoxes, counted, variance,
             status === 'completed' ? 'counted' : 'pending',
             status === 'completed' ? addDays(today(),-daysAgo+1) : null]
          );
        }
      }
      log('Stock counts', 3);
    }

    // ── Low stock alerts (5) ──────────────────────────────────────────────
    const laExists = await trx.query('SELECT id FROM low_stock_alerts WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!laExists.length) {
      const laDefs = [
        { idx:0, stock:6,  status:'open'         },
        { idx:1, stock:3,  status:'acknowledged' },
        { idx:2, stock:8,  status:'open'         },
        { idx:3, stock:2,  status:'open'         },
        { idx:4, stock:9,  status:'resolved'      },
      ];
      for (const a of laDefs) {
        await trx.query(
          `INSERT INTO low_stock_alerts (id, tenant_id, warehouse_id, product_id, current_stock_boxes, reorder_level_boxes, status, alerted_at, resolved_at)
           VALUES (?, ?, ?, ?, ?, 10, ?, NOW(), ?)`,
          [uuid(), tenantId, wh1, prodId(a.idx), a.stock, a.status,
           a.status === 'resolved' ? addDays(today(),-1) : null]
        );
      }
      log('Low stock alerts', 5);
    }

    // ── Notifications (2) ─────────────────────────────────────────────────
    const notifExists = await trx.query('SELECT id FROM notifications WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (!notifExists.length) {
      await trx.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, ?, 'info', 'Low Stock Alert', 'PRD-001 is below reorder level.', 0, NOW())`,
        [uuid(), tenantId, adminId]
      );
      await trx.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, ?, 'info', 'New Sales Order', 'SO-0001 has been confirmed.', 0, NOW())`,
        [uuid(), tenantId, adminId]
      );
      log('Notifications', 2);
    }

    await trx.commit();
    trx.release();
    console.log(`\n✓ Tenant ${tenantId.slice(0,8)} seeded successfully.`);

  } catch (err) {
    await trx.rollback();
    trx.release();
    console.error('[seed-tenant] Error:', err.message);
    throw err;
  }
}

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: node seed-tenant.js <tenantId>');
    process.exit(1);
  }
  await testConnection();
  await seedTenant(tenantId);
  console.log('\nAll done! Refresh your app to see the data.');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
