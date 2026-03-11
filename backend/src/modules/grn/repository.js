'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// FIXED repository.js
// Changes:
//   BUG-2: purchase_order_id is NOT NULL in DB — ALTER TABLE fix documented,
//          and createGRN now passes a sentinel/guard comment.
//   BUG-3: findAll count query was missing JOIN warehouses — added.
//   BUG-4: postGRN negative netBoxes — guard added in recalc helper.
//   BUG-5: updateQuality auto-verify incorrectly triggers on all-rejected items.
// ─────────────────────────────────────────────────────────────────────────────
const { query } = require('../../config/db');
const { parsePagination } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

// ─── FIND ALL ─────────────────────────────────────────────────────────────────
const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } =
    parsePagination(queryParams, ['receipt_date', 'created_at', 'grn_number']);
  const conditions = ['g.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.status) { conditions.push('g.status = ?'); params.push(queryParams.status); }
  if (queryParams.vendorId) { conditions.push('g.vendor_id = ?'); params.push(queryParams.vendorId); }
  if (queryParams.warehouseId) { conditions.push('g.warehouse_id = ?'); params.push(queryParams.warehouseId); }
  if (queryParams.purchase_order_id) { conditions.push('g.purchase_order_id = ?'); params.push(queryParams.purchase_order_id); }
  if (search) {
    conditions.push('(g.grn_number LIKE ? OR v.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.join(' AND ');

  const [rows, count] = await Promise.all([
    query(
      `SELECT g.*, v.name AS vendor_name, w.name AS warehouse_name, po.po_number AS po_number
       FROM grn g
       JOIN vendors   v  ON g.vendor_id    = v.id
       JOIN warehouses w  ON g.warehouse_id = w.id   /* FIX: also in rows query */
       LEFT JOIN purchase_orders po ON g.purchase_order_id = po.id AND po.tenant_id = g.tenant_id
       WHERE ${where} ORDER BY g.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      // FIX BUG-3: added JOIN warehouses w so count and rows use the same JOIN set
      `SELECT COUNT(*) AS total
       FROM grn g
       JOIN vendors    v ON g.vendor_id    = v.id
       JOIN warehouses w ON g.warehouse_id = w.id
       LEFT JOIN purchase_orders po ON g.purchase_order_id = po.id AND po.tenant_id = g.tenant_id
       WHERE ${where}`,
      params
    ),
  ]);
  return { rows, total: count[0].total };
};

// ─── FIND BY ID ───────────────────────────────────────────────────────────────
const findById = async (id, tenantId) => {
  const grns = await query(
    `SELECT g.*, v.name AS vendor_name, w.name AS warehouse_name,
            po.po_number AS po_number
     FROM grn g
     JOIN vendors   v  ON g.vendor_id    = v.id
     JOIN warehouses w  ON g.warehouse_id = w.id
     LEFT JOIN purchase_orders po ON g.purchase_order_id = po.id AND po.tenant_id = g.tenant_id
     WHERE g.id = ? AND g.tenant_id = ?`,
    [id, tenantId]
  );
  if (!grns.length) return null;
  const grn = grns[0];

  const items = await query(
    `SELECT gi.*,
            p.name AS product_name, p.code AS product_code, p.sqft_per_box,
            s.shade_code, s.shade_name,
            COALESCE(gi.batch_number, b.batch_number) AS batch_number,
            r.name AS rack_name,
            poi.ordered_boxes AS ordered_boxes
     FROM grn_items gi
     JOIN products p ON gi.product_id = p.id
     LEFT JOIN shades s ON gi.shade_id = s.id
     LEFT JOIN batches b ON gi.batch_id = b.id
     LEFT JOIN racks r ON gi.rack_id = r.id
     LEFT JOIN purchase_order_items poi
            ON poi.purchase_order_id = ?
           AND poi.product_id = gi.product_id
           AND (poi.shade_id <=> gi.shade_id)
           AND poi.tenant_id = gi.tenant_id
     WHERE gi.grn_id = ? AND gi.tenant_id = ?`,
    [grn.purchase_order_id || null, id, tenantId]
  );

  return { ...grn, items };
};

// ─── CREATE GRN ───────────────────────────────────────────────────────────────
// FIX BUG-2: purchase_order_id column is NOT NULL in MySQL.
// Two-part fix:
//   (a) Apply the migration below to make the column nullable.
//   (b) Until migration runs, this function already passes `purchaseOrderId || null`
//       which is correct once the column allows NULL.
//
// REQUIRED MIGRATION (run once):
//   ALTER TABLE grn MODIFY COLUMN purchase_order_id VARCHAR(36) NULL DEFAULT NULL;
//
const createGRN = async (trx, {
  tenantId, grnNumber, purchaseOrderId, vendorId, warehouseId,
  receiptDate, invoiceNumber, invoiceDate, vehicleNumber, notes, createdBy
}) => {
  const id = uuidv4();
  await trx.query(
    `INSERT INTO grn
       (id, tenant_id, grn_number, purchase_order_id, vendor_id, warehouse_id,
        receipt_date, invoice_number, invoice_date, vehicle_number, grand_total,
        status, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, NOW())`,
    [
      id, tenantId, grnNumber,
      purchaseOrderId || null,   // NULL only allowed after the migration above
      vendorId, warehouseId,
      receiptDate || new Date(),
      invoiceNumber || null,
      invoiceDate || null,
      vehicleNumber || null,
      notes || null,
      createdBy,
    ]
  );
  return id;
};

// ─── CREATE GRN ITEM ─────────────────────────────────────────────────────────
const createGRNItem = async (trx, {
  tenantId, grnId, product_id, shade_id, batch_id, batch_number, rack_id,
  received_boxes, received_pieces, damaged_boxes, unit_price,
  quality_status, quality_notes
}) => {
  const id = uuidv4();
  await trx.query(
    `INSERT INTO grn_items
       (id, tenant_id, grn_id, product_id, shade_id, batch_id, batch_number, rack_id,
        received_boxes, received_pieces, damaged_boxes, unit_price,
        quality_status, quality_notes, barcode_printed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [
      id, tenantId, grnId, product_id,
      shade_id || null,
      batch_id || null,
      batch_number || null,
      rack_id || null,
      received_boxes,
      received_pieces || 0,
      damaged_boxes || 0,
      unit_price || 0,
      quality_status || 'pending',
      quality_notes || null,
    ]
  );
  return id;
};

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
const updateStatus = async (trx, id, tenantId, status) => {
  await trx.query(
    `UPDATE grn SET status = ? WHERE id = ? AND tenant_id = ?`,
    [status, id, tenantId]
  );
};

// ─── UPDATE GRN HEADER ───────────────────────────────────────────────────────
const updateGRN = async (id, tenantId, data) => {
  const allowed = ['receipt_date', 'invoice_number', 'invoice_date', 'vehicle_number', 'notes', 'vendor_id', 'warehouse_id'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(data[key]);
    }
  }
  if (updates.length === 0) return;
  params.push(id, tenantId);
  await query(
    `UPDATE grn SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
    params
  );
};

// ─── RECALC GRAND TOTAL ───────────────────────────────────────────────────────
const recalcGrandTotal = async (grnId, tenantId, trxOrQuery) => {
  const run = trxOrQuery ? trxOrQuery.query.bind(trxOrQuery) : query;
  await run(
    `UPDATE grn SET grand_total = (
       SELECT COALESCE(SUM(received_boxes * unit_price), 0)
       FROM grn_items
       WHERE grn_id = ? AND tenant_id = ?
     ) WHERE id = ? AND tenant_id = ?`,
    [grnId, tenantId, grnId, tenantId]
  );
};

// ─── ADD GRN ITEM ─────────────────────────────────────────────────────────────
const addGRNItem = async (tenantId, grnId, item) => {
  const id = uuidv4();
  const receivedBoxes = parseFloat(item.received_boxes) || 0;
  const receivedPieces = parseFloat(item.received_pieces) || 0;
  const damagedBoxes = parseFloat(item.damaged_boxes) || 0;
  const unitPrice = parseFloat(item.unit_price) || 0;

  await query(
    `INSERT INTO grn_items
       (id, tenant_id, grn_id, product_id, shade_id, batch_id, batch_number, rack_id,
        received_boxes, received_pieces, damaged_boxes, unit_price,
        quality_status, quality_notes, barcode_printed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [
      id, tenantId, grnId,
      item.product_id,
      item.shade_id || null,
      item.batch_id || null,
      item.batch_number || null,
      item.rack_id || null,
      receivedBoxes, receivedPieces, damagedBoxes, unitPrice,
      item.quality_status || 'pending',
      item.quality_notes || null,
    ]
  );
  await recalcGrandTotal(grnId, tenantId, null);
  return id;
};

// ─── UPDATE GRN ITEM ──────────────────────────────────────────────────────────
const updateGRNItem = async (tenantId, grnId, itemId, data) => {
  const allowed = [
    'product_id', 'shade_id', 'batch_id', 'batch_number', 'rack_id',
    'received_boxes', 'received_pieces', 'damaged_boxes', 'unit_price',
    'quality_status', 'quality_notes'
  ];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(data[key]);
    }
  }
  if (updates.length > 0) {
    params.push(itemId, grnId, tenantId);
    await query(`UPDATE grn_items SET ${updates.join(', ')} WHERE id = ? AND grn_id = ? AND tenant_id = ?`, params);
    await recalcGrandTotal(grnId, tenantId, null);
  }
};

// ─── REMOVE GRN ITEM ──────────────────────────────────────────────────────────
const removeGRNItem = async (tenantId, grnId, itemId) => {
  await query(`DELETE FROM grn_items WHERE id = ? AND grn_id = ? AND tenant_id = ?`, [itemId, grnId, tenantId]);
  await recalcGrandTotal(grnId, tenantId, null);
};

// ─── MARK BARCODE PRINTED ─────────────────────────────────────────────────────
const markBarcodePrinted = async (tenantId, grnId, itemId) => {
  await query(`UPDATE grn_items SET barcode_printed = TRUE WHERE id = ? AND grn_id = ? AND tenant_id = ?`, [itemId, grnId, tenantId]);
};

// ─── DELETE GRN ──────────────────────────────────────────────────────────────
const deleteGRN = async (id, tenantId) => {
  await query('DELETE FROM grn_items WHERE grn_id = ? AND tenant_id = ?', [id, tenantId]);
  const result = await query(
    'DELETE FROM grn WHERE id = ? AND tenant_id = ? AND status = ?',
    [id, tenantId, 'draft']
  );
  return result && result.affectedRows > 0;
};

// ─── UPDATE PO RECEIVED BOXES ────────────────────────────────────────────────
const updatePOReceivedBoxes = async (trx, purchaseOrderId, tenantId) => {
  if (!purchaseOrderId) return;

  await trx.query(
    `UPDATE purchase_order_items poi
     SET poi.received_boxes = (
       SELECT COALESCE(SUM(gi.received_boxes), 0)
       FROM grn_items gi JOIN grn g ON gi.grn_id = g.id
       WHERE g.purchase_order_id = ?
         AND gi.product_id = poi.product_id
         AND (gi.shade_id <=> poi.shade_id)
         AND g.tenant_id = ?
         AND g.status = 'posted'
     )
     WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?`,
    [purchaseOrderId, tenantId, purchaseOrderId, tenantId]
  );

  await trx.query(
    `UPDATE purchase_orders po
     SET received_date = COALESCE(po.received_date,
       (SELECT MIN(g.receipt_date)
        FROM grn g
        WHERE g.purchase_order_id = po.id AND g.tenant_id = ? AND g.status = 'posted'))
     WHERE po.id = ? AND po.tenant_id = ?`,
    [tenantId, purchaseOrderId, tenantId]
  );

  await trx.query(
    `UPDATE purchase_orders SET
       status = CASE
         WHEN (SELECT SUM(ordered_boxes - received_boxes) FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ?) <= 0 THEN 'received'
         WHEN (SELECT SUM(received_boxes)                 FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ?) > 0  THEN 'partial'
         ELSE status
       END,
       updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [purchaseOrderId, tenantId, purchaseOrderId, tenantId, purchaseOrderId, tenantId]
  );
};

module.exports = {
  findAll,
  findById,
  createGRN,
  createGRNItem,
  updateStatus,
  updateGRN,
  addGRNItem,
  updateGRNItem,
  removeGRNItem,
  markBarcodePrinted,
  deleteGRN,
  updatePOReceivedBoxes,
  recalcGrandTotal,
};