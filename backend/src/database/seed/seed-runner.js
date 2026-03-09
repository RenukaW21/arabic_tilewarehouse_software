'use strict';

/**
 * Tiles WMS — Production-grade seed runner.
 * Inserts in FK-safe order; uses single transaction; prevents duplicate run.
 */

const bcrypt = require('bcryptjs');
const { beginTransaction } = require('../../config/db');
const { query } = require('../../config/db');
const env = require('../../config/env');
const {
  TENANTS,
  USER_TEMPLATES,
  GST_CONFIG,
  WAREHOUSE_NAMES,
  getRackNames,
  VENDOR_NAMES,
  CUSTOMER_NAMES,
  CATEGORIES,
  PRODUCT_TEMPLATES,
  SHADE_NAMES,
  SHADE_HEX,
  uuid,
  today,
  addDays,
} = require('./fixtures');

const DEFAULT_PASSWORD = 'Seed@123'; // Override with SEED_PASSWORD env

const SEED_PASSWORD = process.env.SEED_PASSWORD || DEFAULT_PASSWORD;

async function runSeed() {
  const existing = await query(
    "SELECT id FROM tenants WHERE slug IN ('tiles-india', 'ceramic-world') LIMIT 1"
  );
  if (existing.length > 0 && !process.env.FORCE_SEED) {
    console.log('[Seed] Tenants already exist. Skip. Set FORCE_SEED=1 to re-run.');
    process.exit(0);
  }

  const trx = await beginTransaction();
  const log = (msg, count = '') => console.log(`[Seed] ${msg} ${count}`.trim());

  try {
    const ctx = { tenantIds: [], userIdsByTenant: {}, warehouseIdsByTenant: {}, rackIdsByTenant: {}, vendorIdsByTenant: {}, customerIdsByTenant: {}, categoryIdsByTenant: {}, productIdsByTenant: {}, shadeIdsByProduct: {}, batchIdsByTenant: {} };

    // ─── 1. Tenants ─────────────────────────────────────────────────────────
    for (let i = 0; i < TENANTS.length; i++) {
      const t = TENANTS[i];
      const id = uuid();
      ctx.tenantIds.push(id);
      await trx.query(
        `INSERT INTO tenants (id, name, slug, plan, status, max_warehouses, max_users, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, t.name, t.slug, t.plan, t.status, t.max_warehouses, t.max_users]
      );
    }
    log('Tenants', ctx.tenantIds.length);

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, env.security.bcryptRounds);

    for (let ti = 0; ti < ctx.tenantIds.length; ti++) {
      const tenantId = ctx.tenantIds[ti];
      ctx.userIdsByTenant[tenantId] = [];
      ctx.warehouseIdsByTenant[tenantId] = [];
      ctx.rackIdsByTenant[tenantId] = [];
      ctx.vendorIdsByTenant[tenantId] = [];
      ctx.customerIdsByTenant[tenantId] = [];
      ctx.categoryIdsByTenant[tenantId] = [];
      ctx.productIdsByTenant[tenantId] = [];
      ctx.shadeIdsByProduct[tenantId] = {};
      ctx.batchIdsByTenant[tenantId] = [];

      // ─── 2. Users (4 per tenant) ─────────────────────────────────────────
      const domain = ti === 0 ? 'tilesindia.com' : 'ceramicworld.in';
      for (let u = 0; u < USER_TEMPLATES.length; u++) {
        const ut = USER_TEMPLATES[u];
        const uid = uuid();
        ctx.userIdsByTenant[tenantId].push(uid);
        const email = `${ut.email}@${domain}`;
        await trx.query(
          `INSERT INTO users (id, tenant_id, name, email, password_hash, role, phone, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [uid, tenantId, ut.name, email, passwordHash, ut.role, ut.phone]
        );
      }
      log(`Users (tenant ${ti + 1})`, ctx.userIdsByTenant[tenantId].length);

      // ─── 3. GST Configuration (1 per tenant) ───────────────────────────────
      const gst = GST_CONFIG[ti];
      await trx.query(
        `INSERT INTO gst_configurations (id, tenant_id, gstin, legal_name, trade_name, state_code, state_name, pan, default_gst_rate, fiscal_year_start, is_composition_scheme, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 18.00, '04-01', 0, NOW(), NOW())`,
        [uuid(), tenantId, gst.gstin, gst.legal_name, gst.trade_name, gst.state_code, gst.state_name, gst.pan]
      );
      log(`GST config (tenant ${ti + 1})`, 1);

      // ─── 4. Warehouses (2 per tenant) ────────────────────────────────────
      for (let w = 0; w < 2; w++) {
        const wh = WAREHOUSE_NAMES[ti * 2 + w];
        const wid = uuid();
        ctx.warehouseIdsByTenant[tenantId].push(wid);
        await trx.query(
          `INSERT INTO warehouses (id, tenant_id, name, code, address, city, state, pincode, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [wid, tenantId, wh.name, wh.code, `${wh.name}, ${wh.city}`, wh.city, wh.state, wh.pincode]
        );
      }
      log(`Warehouses (tenant ${ti + 1})`, ctx.warehouseIdsByTenant[tenantId].length);

      // ─── 5. Racks (per warehouse) ────────────────────────────────────────
      const rackNames = getRackNames(0);
      for (const wid of ctx.warehouseIdsByTenant[tenantId]) {
        for (let r = 0; r < Math.min(8, rackNames.length); r++) {
          const rn = rackNames[r];
          const rid = uuid();
          if (!ctx.rackIdsByTenant[tenantId].length) ctx.rackIdsByTenant[tenantId] = [];
          ctx.rackIdsByTenant[tenantId].push(rid);
          await trx.query(
            `INSERT INTO racks (id, tenant_id, warehouse_id, name, aisle, \`row\`, level, capacity_boxes, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [rid, tenantId, wid, rn.name, rn.aisle, rn.row, rn.level, rn.capacity_boxes]
          );
        }
      }
      log(`Racks (tenant ${ti + 1})`, ctx.rackIdsByTenant[tenantId].length);

      // ─── 6. Vendors (10 per tenant) ──────────────────────────────────────
      for (let v = 0; v < VENDOR_NAMES.length; v++) {
        const vn = VENDOR_NAMES[v];
        const vid = uuid();
        ctx.vendorIdsByTenant[tenantId].push(vid);
        await trx.query(
          `INSERT INTO vendors (id, tenant_id, name, code, contact_person, phone, email, address, gstin, pan, payment_terms_days, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30, 1, NOW())`,
          [vid, tenantId, vn.name, vn.code, vn.contact, vn.phone, vn.email, `${vn.name}, ${vn.city}`, vn.gstin, vn.pan]
        );
      }
      log(`Vendors (tenant ${ti + 1})`, ctx.vendorIdsByTenant[tenantId].length);

      // ─── 7. Customers (10 per tenant) ────────────────────────────────────
      for (let c = 0; c < CUSTOMER_NAMES.length; c++) {
        const cn = CUSTOMER_NAMES[c];
        const cid = uuid();
        ctx.customerIdsByTenant[tenantId].push(cid);
        await trx.query(
          `INSERT INTO customers (id, tenant_id, name, code, contact_person, phone, email, billing_address, shipping_address, gstin, state_code, credit_limit, payment_terms_days, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 500000, 30, 1, NOW())`,
          [cid, tenantId, cn.name, cn.code, cn.contact, cn.phone, cn.email, `${cn.name}, ${cn.city}`, `${cn.name}, ${cn.city}`, cn.gstin, cn.state_code]
        );
      }
      log(`Customers (tenant ${ti + 1})`, ctx.customerIdsByTenant[tenantId].length);

      // ─── 8. Product categories (4, no parent) ──────────────────────────────
      for (let cat = 0; cat < CATEGORIES.length; cat++) {
        const cid = uuid();
        ctx.categoryIdsByTenant[tenantId].push(cid);
        await trx.query(
          `INSERT INTO product_categories (id, tenant_id, name, parent_id, is_active) VALUES (?, ?, ?, NULL, 1)`,
          [cid, tenantId, CATEGORIES[cat].name]
        );
      }
      log(`Categories (tenant ${ti + 1})`, ctx.categoryIdsByTenant[tenantId].length);

      // ─── 9. Products (20 per tenant) ─────────────────────────────────────
      for (let p = 0; p < PRODUCT_TEMPLATES.length; p++) {
        const pt = PRODUCT_TEMPLATES[p];
        const pid = uuid();
        ctx.productIdsByTenant[tenantId].push(pid);
        const catId = ctx.categoryIdsByTenant[tenantId][p % 4];
        const sqmt = (pt.sqft * 0.092903).toFixed(4);
        await trx.query(
          `INSERT INTO products (id, tenant_id, category_id, name, code, description, size_length_mm, size_width_mm, size_thickness_mm, size_label, pieces_per_box, sqft_per_box, sqmt_per_box, gst_rate, mrp, reorder_level_boxes, brand, finish, material, hsn_code, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [pid, tenantId, catId, pt.name, `PRD-${String(p + 1).padStart(3, '0')}`, pt.name, pt.sizeL, pt.sizeW, pt.sizeT, pt.sizeLabel, pt.pieces, pt.sqft, sqmt, pt.gst, pt.mrp, pt.brand, pt.finish, pt.material, pt.hsn]
        );
      }
      log(`Products (tenant ${ti + 1})`, ctx.productIdsByTenant[tenantId].length);

      // ─── 10. Shades (2 per product) ──────────────────────────────────────
      const productIds = ctx.productIdsByTenant[tenantId];
      for (let pi = 0; pi < productIds.length; pi++) {
        const pid = productIds[pi];
        ctx.shadeIdsByProduct[tenantId][pid] = [];
        for (let s = 0; s < 2; s++) {
          const sid = uuid();
          ctx.shadeIdsByProduct[tenantId][pid].push(sid);
          const shName = SHADE_NAMES[(pi + s) % SHADE_NAMES.length];
          const hex = SHADE_HEX[(pi + s) % SHADE_HEX.length];
          await trx.query(
            `INSERT INTO shades (id, tenant_id, product_id, shade_code, shade_name, hex_color, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
            [sid, tenantId, pid, `SH-${pi}-${s}`, shName, hex]
          );
        }
      }
      log(`Shades (tenant ${ti + 1})`, productIds.length * 2);

      // ─── 11. Batches (1 per product, link vendor) ──────────────────────────
      const vendorIds = ctx.vendorIdsByTenant[tenantId];
      for (let pi = 0; pi < productIds.length; pi++) {
        const bid = uuid();
        ctx.batchIdsByTenant[tenantId].push(bid);
        const pid = productIds[pi];
        const shadeIds = ctx.shadeIdsByProduct[tenantId][pid];
        const shadeId = shadeIds[0] || null;
        const vid = vendorIds[pi % vendorIds.length];
        await trx.query(
          `INSERT INTO batches (id, tenant_id, product_id, shade_id, batch_number, production_date, expiry_date, grade, vendor_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'A', ?, NOW())`,
          [bid, tenantId, pid, shadeId, `BAT-${today().replace(/-/g, '')}-${pi + 1}`, addDays(today(), -30), addDays(today(), 365), vid]
        );
      }
      log(`Batches (tenant ${ti + 1})`, ctx.batchIdsByTenant[tenantId].length);

      // ─── 12. Document counters ────────────────────────────────────────────
      const year = new Date().getFullYear();
      const docTypes = ['PO', 'GRN', 'SO', 'INV', 'CN', 'DN', 'CP', 'VP', 'TR', 'SR', 'PR'];
      for (const docType of docTypes) {
        await trx.query(
          `INSERT INTO document_counters (id, tenant_id, doc_type, prefix, year, last_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
          [uuid(), tenantId, docType, docType, year]
        );
      }
      log(`Document counters (tenant ${ti + 1})`, docTypes.length);

      const adminId = ctx.userIdsByTenant[tenantId][0];
      const whIds = ctx.warehouseIdsByTenant[tenantId];
      const mainWh = whIds[0];

      // ─── 13. Purchase orders (3 per tenant) + items ────────────────────────
      const poIds = [];
      for (let po = 0; po < 3; po++) {
        const poId = uuid();
        poIds.push(poId);
        const vId = vendorIds[po % vendorIds.length];
        const poNum = `PO-${year}-${String(po + 1).padStart(4, '0')}`;
        const orderDate = addDays(today(), -15 - po * 5);
        await trx.query(
          `INSERT INTO purchase_orders (id, tenant_id, po_number, vendor_id, warehouse_id, status, return_status, order_date, expected_date, total_amount, discount_amount, tax_amount, grand_total, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'received', 'none', ?, ?, 0, 0, 0, 0, ?, NOW(), NOW())`,
          [poId, tenantId, poNum, vId, mainWh, orderDate, addDays(orderDate, 7), adminId]
        );
        const itemsToAdd = 2 + (po % 2);
        let poTotal = 0;
        for (let it = 0; it < itemsToAdd; it++) {
          const prodId = productIds[(po * 2 + it) % productIds.length];
          const shadeList = ctx.shadeIdsByProduct[tenantId][prodId] || [];
          const shadeId = shadeList[0] || null;
          const boxes = 20 + (it * 10);
          const unitPrice = 35 + (it * 5);
          const lineTotal = boxes * unitPrice;
          poTotal += lineTotal;
          await trx.query(
            `INSERT INTO purchase_order_items (id, tenant_id, purchase_order_id, product_id, shade_id, ordered_boxes, ordered_pieces, received_boxes, unit_price, discount_pct, tax_pct, line_total)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 18, ?)`,
            [uuid(), tenantId, poId, prodId, shadeId, boxes, boxes, unitPrice, lineTotal]
          );
        }
        const tax = poTotal * 0.18;
        await trx.query(
          `UPDATE purchase_orders SET total_amount = ?, tax_amount = ?, grand_total = ? WHERE id = ?`,
          [poTotal, tax, poTotal + tax, poId]
        );
      }
      log(`Purchase orders (tenant ${ti + 1})`, poIds.length);

      // ─── 14. GRN (2 per tenant) + items ────────────────────────────────────
      const grnIds = [];
      for (let g = 0; g < 2; g++) {
        const grnId = uuid();
        grnIds.push(grnId);
        const grnNum = `GRN-${year}-${String(g + 1).padStart(4, '0')}`;
        const vId = vendorIds[g % vendorIds.length];
        const poId = poIds[g] || poIds[0];
        await trx.query(
          `INSERT INTO grn (id, tenant_id, grn_number, purchase_order_id, vendor_id, warehouse_id, receipt_date, invoice_number, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, NOW())`,
          [grnId, tenantId, grnNum, poId, vId, mainWh, addDays(today(), -10 - g), `INV-V-${g + 1}`, adminId]
        );
        for (let it = 0; it < 2; it++) {
          const prodId = productIds[(g * 2 + it) % productIds.length];
          const shadeList = ctx.shadeIdsByProduct[tenantId][prodId] || [];
          const shadeId = shadeList[0] || null;
          const batchList = ctx.batchIdsByTenant[tenantId];
          const batchId = batchList[(g * 2 + it) % batchList.length] || null;
          const rackIds = ctx.rackIdsByTenant[tenantId];
          const rackId = rackIds[it % rackIds.length] || null;
          const boxes = 15 + it * 5;
          const unitPrice = 38;
          await trx.query(
            `INSERT INTO grn_items (id, tenant_id, grn_id, product_id, shade_id, batch_id, rack_id, received_boxes, received_pieces, damaged_boxes, unit_price, quality_status, barcode_printed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'pass', 0)`,
            [uuid(), tenantId, grnId, prodId, shadeId, batchId, rackId, boxes, unitPrice]
          );
        }
      }
      log(`GRN (tenant ${ti + 1})`, grnIds.length);

      // ─── 15. Stock summary (from GRN items: warehouse, product, shade, batch, rack) ─────────────────
      const rackIds = ctx.rackIdsByTenant[tenantId];
      for (let pi = 0; pi < Math.min(10, productIds.length); pi++) {
        const pid = productIds[pi];
        const shadeList = ctx.shadeIdsByProduct[tenantId][pid] || [];
        const shadeId = shadeList[0] || null;
        const batchId = ctx.batchIdsByTenant[tenantId][pi] || null;
        const rackId = rackIds[pi % rackIds.length] || null;
        const boxes = 25 + pi * 5;
        const sqftPerBox = PRODUCT_TEMPLATES[pi].sqft;
        const totalSqft = (boxes * sqftPerBox).toFixed(4);
        await trx.query(
          `INSERT INTO stock_summary (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id, total_boxes, total_pieces, total_sqft, avg_cost_per_box, last_receipt_date, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 38, ?, NOW())`,
          [uuid(), tenantId, mainWh, rackId, pid, shadeId, batchId, boxes, totalSqft, addDays(today(), -5)]
        );
      }
      log(`Stock summary (tenant ${ti + 1})`, 10);

      // ─── 16. Stock ledger (opening/grn entries) ─────────────────────────────
      for (let pi = 0; pi < 5; pi++) {
        const pid = productIds[pi];
        const shadeList = ctx.shadeIdsByProduct[tenantId][pid] || [];
        const shadeId = shadeList[0] || null;
        const batchId = ctx.batchIdsByTenant[tenantId][pi] || null;
        const rackId = rackIds[pi % rackIds.length] || null;
        const boxes = 20;
        const sqft = (PRODUCT_TEMPLATES[pi].sqft * boxes).toFixed(4);
        await trx.query(
          `INSERT INTO stock_ledger (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id, transaction_type, reference_id, reference_type, boxes_in, boxes_out, pieces_in, pieces_out, balance_boxes, balance_pieces, sqft_in, sqft_out, transaction_date, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'opening', NULL, NULL, ?, 0, 0, 0, ?, 0, ?, 0, ?, ?, NOW())`,
          [uuid(), tenantId, mainWh, rackId, pid, shadeId, batchId, boxes, boxes, sqft, addDays(today(), -20), adminId]
        );
      }
      log(`Stock ledger (tenant ${ti + 1})`, 5);

      // ─── 17. Sales orders (4 per tenant) + items ──────────────────────────
      const customerIds = ctx.customerIdsByTenant[tenantId];
      const soIds = [];
      for (let so = 0; so < 4; so++) {
        const soId = uuid();
        soIds.push(soId);
        const cId = customerIds[so % customerIds.length];
        const soNum = `SO-${year}-${String(so + 1).padStart(4, '0')}`;
        const orderDate = addDays(today(), -8 - so);
        await trx.query(
          `INSERT INTO sales_orders (id, tenant_id, so_number, customer_id, warehouse_id, status, order_date, expected_delivery_date, sub_total, discount_amount, tax_amount, grand_total, payment_status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 'pending', ?, NOW(), NOW())`,
          [soId, tenantId, soNum, cId, mainWh, so < 2 ? 'delivered' : 'confirmed', orderDate, addDays(orderDate, 3), adminId]
        );
        let soTotal = 0;
        for (let it = 0; it < 2; it++) {
          const prodId = productIds[(so + it) % productIds.length];
          const shadeList = ctx.shadeIdsByProduct[tenantId][prodId] || [];
          const shadeId = shadeList[0] || null;
          const boxes = 5 + it * 3;
          const unitPrice = 48;
          const lineTotal = boxes * unitPrice;
          soTotal += lineTotal;
          await trx.query(
            `INSERT INTO sales_order_items (id, tenant_id, sales_order_id, product_id, shade_id, ordered_boxes, ordered_pieces, dispatched_boxes, unit_price, discount_pct, tax_pct, line_total)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 18, ?)`,
            [uuid(), tenantId, soId, prodId, shadeId, boxes, so < 2 ? boxes : 0, unitPrice, lineTotal]
          );
        }
        const tax = soTotal * 0.18;
        await trx.query(
          `UPDATE sales_orders SET sub_total = ?, tax_amount = ?, grand_total = ? WHERE id = ?`,
          [soTotal, tax, soTotal + tax, soId]
        );
      }
      log(`Sales orders (tenant ${ti + 1})`, soIds.length);

      // ─── 18. Invoices (2 per tenant) ─────────────────────────────────────
      const invIds = [];
      for (let inv = 0; inv < 2; inv++) {
        const invId = uuid();
        invIds.push(invId);
        const soId = soIds[inv];
        const soRows = await trx.query(`SELECT customer_id, grand_total, sub_total, tax_amount FROM sales_orders WHERE id = ?`, [soId]);
        const soRow = soRows[0];
        const invNum = `INV-${year}-${String(inv + 1).padStart(4, '0')}`;
        const grandTotal = soRow.grand_total || 0;
        const tax = soRow.tax_amount || 0;
        const cgst = tax / 2;
        await trx.query(
          `INSERT INTO invoices (id, tenant_id, invoice_number, sales_order_id, customer_id, invoice_date, due_date, sub_total, discount_amount, cgst_amount, sgst_amount, igst_amount, grand_total, payment_status, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'pending', 'issued', ?, NOW(), NOW())`,
          [invId, tenantId, invNum, soId, soRow.customer_id, addDays(today(), -5 - inv), addDays(today(), 25), soRow.sub_total, cgst, cgst, grandTotal, adminId]
        );
        const items = await trx.query(`SELECT product_id, shade_id, ordered_boxes, unit_price, line_total FROM sales_order_items WHERE sales_order_id = ?`, [soId]);
        for (const item of items) {
          const taxable = item.line_total || 0;
          const gstRate = 18;
          const cgstAmt = taxable * 0.09;
          await trx.query(
            `INSERT INTO invoice_items (id, tenant_id, invoice_id, product_id, shade_id, quantity_boxes, unit_price, discount_pct, taxable_amount, gst_rate, cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 18, 9, 9, 0, ?, ?, 0, ?)`,
            [uuid(), tenantId, invId, item.product_id, item.shade_id, item.ordered_boxes, item.unit_price, taxable, cgstAmt, cgstAmt, item.line_total]
          );
        }
      }
      log(`Invoices (tenant ${ti + 1})`, invIds.length);

      // ─── 19. Customer payments (2) ────────────────────────────────────────
      for (let cp = 0; cp < 2; cp++) {
        const cId = customerIds[cp];
        const invId = invIds[cp] || invIds[0];
        const payNum = `CP-${year}-${String(cp + 1).padStart(4, '0')}`;
        await trx.query(
          `INSERT INTO customer_payments (id, tenant_id, payment_number, customer_id, invoice_id, payment_date, amount, payment_mode, reference_number, bank_name, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 5000, 'neft', 'NEFT123456', 'HDFC Bank', 'cleared', ?, NOW())`,
          [uuid(), tenantId, payNum, cId, invId, addDays(today(), -2), adminId]
        );
      }
      log(`Customer payments (tenant ${ti + 1})`, 2);

      // ─── 20. Vendor payments (2) ──────────────────────────────────────────
      for (let vp = 0; vp < 2; vp++) {
        const vId = vendorIds[vp];
        const poId = poIds[vp];
        const payNum = `VP-${year}-${String(vp + 1).padStart(4, '0')}`;
        await trx.query(
          `INSERT INTO vendor_payments (id, tenant_id, payment_number, vendor_id, purchase_order_id, payment_date, amount, payment_mode, reference_number, bank_name, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 10000, 'neft', 'NEFT789012', 'ICICI Bank', 'cleared', ?, NOW())`,
          [uuid(), tenantId, payNum, vId, poId, addDays(today(), -4), adminId]
        );
      }
      log(`Vendor payments (tenant ${ti + 1})`, 2);

      // ─── 21. Notifications (2 per tenant) ─────────────────────────────────
      for (let n = 0; n < 2; n++) {
        await trx.query(
          `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, is_read, created_at)
           VALUES (?, ?, ?, 'info', ?, ?, 0, NOW())`,
          [uuid(), tenantId, adminId, n === 0 ? 'Low stock alert' : 'New order', n === 0 ? 'Product PRD-005 is below reorder level.' : 'Sales order SO-0001 has been confirmed.']
        );
      }
      log(`Notifications (tenant ${ti + 1})`, 2);
    }

    await trx.commit();
    trx.release();
    log('Seed completed successfully.');
    console.log('\n--- Sample data preview ---');
    console.log('Tenants:', ctx.tenantIds.length);
    console.log('Login (any tenant): use email like admin@tilesindia.com or admin@ceramicworld.in with password:', DEFAULT_PASSWORD);
    console.log('(Set SEED_PASSWORD in .env to override default password.)');
  } catch (err) {
    await trx.rollback();
    trx.release();
    console.error('[Seed] Failed:', err.message);
    throw err;
  }
}

module.exports = { runSeed };
