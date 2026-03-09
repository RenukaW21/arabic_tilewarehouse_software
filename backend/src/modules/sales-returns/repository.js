'use strict';
const { query } = require('../../config/db');
const { parsePagination } = require('../../utils/pagination');

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(
    queryParams,
    ['return_date', 'created_at', 'return_number', 'status']
  );
  const conditions = ['sr.tenant_id = ?'];
  const params = [tenantId];
  if (queryParams.status) {
    conditions.push('sr.status = ?');
    params.push(queryParams.status);
  }
  if (queryParams.customer_id) {
    conditions.push('sr.customer_id = ?');
    params.push(queryParams.customer_id);
  }
  if (search) {
    conditions.push('(sr.return_number LIKE ? OR c.name LIKE ? OR so.so_number LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.join(' AND ');
  const [rows, countResult] = await Promise.all([
    query(
      `SELECT sr.*, c.name AS customer_name, w.name AS warehouse_name, so.so_number
       FROM sales_returns sr
       JOIN customers c ON sr.customer_id = c.id
       LEFT JOIN warehouses w ON sr.warehouse_id = w.id
       LEFT JOIN sales_orders so ON sr.sales_order_id = so.id AND so.tenant_id = sr.tenant_id
       WHERE ${where}
       ORDER BY sr.${sortBy} ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM sales_returns sr
       JOIN customers c ON sr.customer_id = c.id
       LEFT JOIN sales_orders so ON sr.sales_order_id = so.id AND so.tenant_id = sr.tenant_id
       WHERE ${where}`,
      params
    ),
  ]);
  return { rows, total: countResult[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT sr.*, c.name AS customer_name, w.name AS warehouse_name, so.so_number
     FROM sales_returns sr
     JOIN customers c ON sr.customer_id = c.id
     LEFT JOIN warehouses w ON sr.warehouse_id = w.id
     LEFT JOIN sales_orders so ON sr.sales_order_id = so.id AND so.tenant_id = sr.tenant_id
     WHERE sr.id = ? AND sr.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findItemsByReturnId = async (returnId, tenantId) => {
  return query(
    `SELECT sri.*, p.code AS product_code, p.name AS product_name
     FROM sales_return_items sri
     JOIN products p ON sri.product_id = p.id
     WHERE sri.sales_return_id = ? AND sri.tenant_id = ?`,
    [returnId, tenantId]
  );
};

const create = async (trx, data) => {
  await trx.query(
    `INSERT INTO sales_returns
       (id, tenant_id, return_number, sales_order_id, invoice_id, customer_id, warehouse_id,
        return_date, return_reason, status, total_boxes, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NOW())`,
    [
      data.id,
      data.tenant_id,
      data.return_number,
      data.sales_order_id || null,
      data.invoice_id || null,
      data.customer_id,
      data.warehouse_id,
      data.return_date || new Date(),
      data.return_reason,
      data.total_boxes || 0,
      data.notes || null,
      data.created_by,
    ]
  );
};

const createItem = async (trx, data) => {
  await trx.query(
    `INSERT INTO sales_return_items
       (id, tenant_id, sales_return_id, sales_order_item_id, product_id, shade_id, batch_id,
        returned_boxes, returned_pieces, inspection_result, good_boxes, damaged_boxes, unit_price, line_total)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenant_id,
      data.sales_return_id,
      data.sales_order_item_id || null,
      data.product_id,
      data.shade_id || null,
      data.batch_id || null,
      data.returned_boxes,
      data.returned_pieces || 0,
      data.inspection_result || null,
      data.good_boxes ?? data.returned_boxes,
      data.damaged_boxes || 0,
      data.unit_price,
      data.line_total ?? (data.returned_boxes * data.unit_price),
    ]
  );
};

const setReceived = async (id, tenantId) => {
  await query(
    `UPDATE sales_returns SET status = 'received' WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
};

const setCreditNoteId = async (returnId, tenantId, creditNoteId) => {
  await query(
    `UPDATE sales_returns SET credit_note_id = ? WHERE id = ? AND tenant_id = ?`,
    [creditNoteId, returnId, tenantId]
  );
};

const updateDraft = async (id, tenantId, data) => {
  const allowed = ['customer_id', 'warehouse_id', 'return_date', 'return_reason', 'notes', 'total_boxes'];
  const setClause = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClause.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (setClause.length > 0) {
    values.push(id, tenantId);
    await query(
      `UPDATE sales_returns SET ${setClause.join(', ')} WHERE id = ? AND tenant_id = ? AND status = 'draft'`,
      values
    );
  }
};

const deleteById = async (id, tenantId) => {
  await query('DELETE FROM sales_return_items WHERE sales_return_id = ? AND tenant_id = ?', [id, tenantId]);
  await query('DELETE FROM sales_returns WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = {
  findAll,
  findById,
  findItemsByReturnId,
  create,
  createItem,
  setReceived,
  setCreditNoteId,
  updateDraft,
  deleteById,
};
