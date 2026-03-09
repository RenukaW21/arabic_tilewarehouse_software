'use strict';
const { query } = require('../../config/db');
const { parsePagination } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ['receipt_date', 'created_at', 'grn_number']);
  const conditions = ['g.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.status) { conditions.push('g.status = ?'); params.push(queryParams.status); }
  if (queryParams.vendorId) { conditions.push('g.vendor_id = ?'); params.push(queryParams.vendorId); }
  if (queryParams.warehouseId) { conditions.push('g.warehouse_id = ?'); params.push(queryParams.warehouseId); }
  if (search) { conditions.push('(g.grn_number LIKE ? OR v.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const where = conditions.join(' AND ');
  const [rows, count] = await Promise.all([
    query(
      `SELECT g.*, v.name AS vendor_name, w.name AS warehouse_name
       FROM grn g
       JOIN vendors v ON g.vendor_id = v.id
       JOIN warehouses w ON g.warehouse_id = w.id
       WHERE ${where} ORDER BY g.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM grn g JOIN vendors v ON g.vendor_id = v.id WHERE ${where}`, params),
  ]);
  return { rows, total: count[0].total };
};

const findById = async (id, tenantId) => {
  const grns = await query(
    `SELECT g.*, v.name AS vendor_name, w.name AS warehouse_name
     FROM grn g JOIN vendors v ON g.vendor_id = v.id JOIN warehouses w ON g.warehouse_id = w.id
     WHERE g.id = ? AND g.tenant_id = ?`,
    [id, tenantId]
  );
  if (!grns.length) return null;

  const items = await query(
    `SELECT gi.*, p.name AS product_name, p.code AS product_code,
            p.sqft_per_box, s.shade_code, b.batch_number, r.name AS rack_name
     FROM grn_items gi
     JOIN products p ON gi.product_id = p.id
     LEFT JOIN shades s ON gi.shade_id = s.id
     LEFT JOIN batches b ON gi.batch_id = b.id
     LEFT JOIN racks r ON gi.rack_id = r.id
     WHERE gi.grn_id = ? AND gi.tenant_id = ?`,
    [id, tenantId]
  );
  return { ...grns[0], items };
};

const createGRN = async (trx, { tenantId, grnNumber, purchaseOrderId, vendorId, warehouseId, receiptDate, invoiceNumber, invoiceDate, vehicleNumber, notes, createdBy }) => {
  const id = uuidv4();
  await trx.query(
    `INSERT INTO grn (id, tenant_id, grn_number, purchase_order_id, vendor_id, warehouse_id,
      receipt_date, invoice_number, invoice_date, vehicle_number, status, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NOW())`,
    [id, tenantId, grnNumber, purchaseOrderId || null, vendorId, warehouseId,
     receiptDate || new Date(), invoiceNumber || null, invoiceDate || null,
     vehicleNumber || null, notes || null, createdBy]
  );
  return id;
};

const createGRNItem = async (trx, { tenantId, grnId, productId, shadeId, batchId, rackId, receivedBoxes, receivedPieces, damagedBoxes, unitPrice, qualityStatus, qualityNotes }) => {
  const id = uuidv4();
  await trx.query(
    `INSERT INTO grn_items (id, tenant_id, grn_id, product_id, shade_id, batch_id, rack_id,
      received_boxes, received_pieces, damaged_boxes, unit_price, quality_status, quality_notes, barcode_printed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [id, tenantId, grnId, productId, shadeId || null, batchId || null, rackId || null,
     receivedBoxes, receivedPieces || 0, damagedBoxes || 0, unitPrice,
     qualityStatus || 'pending', qualityNotes || null]
  );
  return id;
};

const updateStatus = async (trx, id, tenantId, status) => {
  await trx.query(`UPDATE grn SET status = ? WHERE id = ? AND tenant_id = ?`, [status, id, tenantId]);
};

const updatePOReceivedBoxes = async (trx, purchaseOrderId, tenantId) => {
  if (!purchaseOrderId) return;
  // Update received_boxes on PO items
  await trx.query(
    `UPDATE purchase_order_items poi
     SET poi.received_boxes = (
       SELECT COALESCE(SUM(gi.received_boxes), 0)
       FROM grn_items gi JOIN grn g ON gi.grn_id = g.id
       WHERE g.purchase_order_id = ? AND gi.product_id = poi.product_id
         AND g.tenant_id = ? AND g.status = 'posted'
     )
     WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?`,
    [purchaseOrderId, tenantId, purchaseOrderId, tenantId]
  );
  // Update PO status
  await trx.query(
    `UPDATE purchase_orders SET
       status = CASE
         WHEN (SELECT SUM(ordered_boxes - received_boxes) FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ?) <= 0 THEN 'received'
         WHEN (SELECT SUM(received_boxes) FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ?) > 0 THEN 'partial'
         ELSE status
       END,
       updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [purchaseOrderId, tenantId, purchaseOrderId, tenantId, purchaseOrderId, tenantId]
  );
};

module.exports = { findAll, findById, createGRN, createGRNItem, updateStatus, updatePOReceivedBoxes };
