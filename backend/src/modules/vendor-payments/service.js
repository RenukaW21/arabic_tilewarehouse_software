const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const buildTileDetails = async (tenantId, purchaseOrderId) => {
  if (!purchaseOrderId) return null;

  const rows = await query(`
    SELECT p.name, p.code, p.size_label, poi.ordered_boxes, poi.unit_price 
    FROM purchase_order_items poi 
    JOIN products p ON poi.product_id = p.id 
    WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?
  `, [purchaseOrderId, tenantId]);

  if (!rows || rows.length === 0) return 'No items found';

  return rows
    .map(r => `${r.name} (${r.size_label}) - ${r.ordered_boxes} boxes`)
    .join(', ');
};

const updatePurchaseOrderPaymentStatus = async (tenantId, purchaseOrderId) => {
  if (!purchaseOrderId) return;

  const poResult = await query(
    `SELECT grand_total FROM purchase_orders WHERE id = ? AND tenant_id = ?`,
    [purchaseOrderId, tenantId]
  );

  if (!poResult.length) return;

  const grandTotal = poResult[0].grand_total || 0;

  const paymentsResult = await query(`
    SELECT SUM(amount) as total_paid 
    FROM vendor_payments 
    WHERE purchase_order_id = ? AND tenant_id = ? AND status != 'cancelled'
  `, [purchaseOrderId, tenantId]);

  const totalPaid = paymentsResult[0].total_paid || 0;

  let newStatus = 'pending';

  if (totalPaid >= grandTotal && grandTotal > 0) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  }

  await query(
    `UPDATE purchase_orders SET payment_status = ? WHERE id = ? AND tenant_id = ?`,
    [newStatus, purchaseOrderId, tenantId]
  );
};

exports.getAll = async (tenantId, { page = 1, limit = 25, offset = 0, sortBy = 'payment_date', sortOrder = 'DESC' }) => {
  const allowedCols = ['payment_date', 'amount', 'created_at', 'payment_number'];
  const safeSortBy = allowedCols.includes(sortBy) ? sortBy : 'payment_date';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const rows = await query(`
    SELECT vp.*, 
      v.name as vendor_name,
      po.po_number
    FROM vendor_payments vp
    LEFT JOIN vendors v ON vp.vendor_id = v.id
    LEFT JOIN purchase_orders po ON vp.purchase_order_id = po.id
    WHERE vp.tenant_id = ?
    ORDER BY vp.${safeSortBy} ${safeSortOrder}
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `, [tenantId]);

  for (let row of rows) {
    if (row.purchase_order_id) {
      row.tile_details = await buildTileDetails(tenantId, row.purchase_order_id);
    } else {
      row.tile_details = '—';
    }
  }

  const countResult = await query(
    `SELECT COUNT(*) as total FROM vendor_payments WHERE tenant_id = ?`,
    [tenantId]
  );

  return {
    rows,
    total: countResult[0].total
  };
};

exports.getById = async (tenantId, id) => {

  const rows = await query(
    `SELECT * FROM vendor_payments WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  const row = rows[0];

  if (row && row.purchase_order_id) {
    row.tile_details = await buildTileDetails(tenantId, row.purchase_order_id);
  }

  return row;
};

exports.create = async (tenantId, data, createdBy) => {

  const id = uuidv4();
  const payment_number = data.payment_number || `VP-${Date.now()}`;

  await query(`
    INSERT INTO vendor_payments (
      id, tenant_id, payment_number, vendor_id, purchase_order_id, debit_note_id,
      payment_date, amount, payment_mode, reference_number, bank_name, status, notes, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    tenantId,
    payment_number,
    data.vendor_id,
    data.purchase_order_id || null,
    data.debit_note_id || null,
    data.payment_date || null,
    data.amount || 0,
    data.payment_mode || 'neft',
    data.reference_number || null,
    data.bank_name || null,
    data.status || 'cleared',
    data.notes || null,
    createdBy
  ]);

  if (data.purchase_order_id) {
    await updatePurchaseOrderPaymentStatus(tenantId, data.purchase_order_id);
  }

  return this.getById(tenantId, id);
};

exports.update = async (tenantId, id, data) => {

  const existingRows = await query(
    `SELECT * FROM vendor_payments WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  const existing = existingRows[0];

  if (!existing) return null;

  await query(`
    UPDATE vendor_payments SET
      payment_number = ?,
      vendor_id = ?,
      purchase_order_id = ?,
      debit_note_id = ?,
      payment_date = ?,
      amount = ?,
      payment_mode = ?,
      reference_number = ?,
      bank_name = ?,
      status = ?,
      notes = ?
    WHERE id = ? AND tenant_id = ?
  `, [
    data.payment_number,
    data.vendor_id,
    data.purchase_order_id || null,
    data.debit_note_id || null,
    data.payment_date || null,
    data.amount || 0,
    data.payment_mode || 'neft',
    data.reference_number || null,
    data.bank_name || null,
    data.status || 'cleared',
    data.notes || null,
    id,
    tenantId
  ]);

  if (existing.purchase_order_id) {
    await updatePurchaseOrderPaymentStatus(tenantId, existing.purchase_order_id);
  }

  if (data.purchase_order_id && data.purchase_order_id !== existing.purchase_order_id) {
    await updatePurchaseOrderPaymentStatus(tenantId, data.purchase_order_id);
  }

  return this.getById(tenantId, id);
};

exports.remove = async (tenantId, id) => {

  const rows = await query(
    `SELECT purchase_order_id FROM vendor_payments WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  const existing = rows[0];

  if (!existing) return false;

  await query(
    `DELETE FROM vendor_payments WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  if (existing.purchase_order_id) {
    await updatePurchaseOrderPaymentStatus(tenantId, existing.purchase_order_id);
  }

  return true;
};