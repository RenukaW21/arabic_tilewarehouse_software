'use strict';
const { query } = require('../../config/db');
const { parsePagination } = require('../../utils/pagination');

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(
    queryParams,
    ['created_at', 'dispatch_date', 'dc_number', 'status']
  );
  const conditions = ['dc.tenant_id = ?'];
  const params = [tenantId];
  if (queryParams.status) {
    conditions.push('dc.status = ?');
    params.push(queryParams.status);
  }
  if (queryParams.sales_order_id) {
    conditions.push('dc.sales_order_id = ?');
    params.push(queryParams.sales_order_id);
  }
  if (search) {
    conditions.push('(dc.dc_number LIKE ? OR so.so_number LIKE ? OR c.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.join(' AND ');
  const [rows, countResult] = await Promise.all([
    query(
      `SELECT dc.*, so.so_number, c.name AS customer_name
       FROM delivery_challans dc
       JOIN sales_orders so ON dc.sales_order_id = so.id AND so.tenant_id = dc.tenant_id
       JOIN customers c ON dc.customer_id = c.id
       WHERE ${where}
       ORDER BY dc.${sortBy} ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM delivery_challans dc
       JOIN sales_orders so ON dc.sales_order_id = so.id AND so.tenant_id = dc.tenant_id
       JOIN customers c ON dc.customer_id = c.id
       WHERE ${where}`,
      params
    ),
  ]);
  return { rows, total: countResult[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT dc.*, so.so_number, so.warehouse_id,
            c.name AS customer_name
     FROM delivery_challans dc
     JOIN sales_orders so ON dc.sales_order_id = so.id AND so.tenant_id = dc.tenant_id
     JOIN customers c ON dc.customer_id = c.id
     WHERE dc.id = ? AND dc.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findItemsByChallanId = async (challanId, tenantId) => {
  return query(
    `SELECT dci.*, p.code AS product_code, p.name AS product_name
     FROM delivery_challan_items dci
     JOIN products p ON dci.product_id = p.id
     WHERE dci.delivery_challan_id = ? AND dci.tenant_id = ?`,
    [challanId, tenantId]
  );
};

const create = async (trx, data) => {
  const id = data.id;
  await trx.query(
    `INSERT INTO delivery_challans
       (id, tenant_id, dc_number, sales_order_id, pick_list_id, customer_id,
        dispatch_date, vehicle_number, transporter_name, lr_number, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW())`,
    [
      id,
      data.tenant_id,
      data.dc_number,
      data.sales_order_id,
      data.pick_list_id,
      data.customer_id,
      data.dispatch_date || new Date(),
      data.vehicle_number || null,
      data.transporter_name || null,
      data.lr_number || null,
      data.created_by,
    ]
  );
  return id;
};

const createItem = async (trx, data) => {
  await trx.query(
    `INSERT INTO delivery_challan_items
       (id, tenant_id, delivery_challan_id, product_id, shade_id, batch_id,
        dispatched_boxes, dispatched_pieces, dispatched_sqft, unit_price)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenant_id,
      data.delivery_challan_id,
      data.product_id,
      data.shade_id || null,
      data.batch_id || null,
      data.dispatched_boxes,
      data.dispatched_pieces || 0,
      data.dispatched_sqft || 0,
      data.unit_price,
    ]
  );
};

const setDispatched = async (id, tenantId) => {
  await query(
    `UPDATE delivery_challans SET status = 'dispatched', created_at = created_at WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
};

const updateDraft = async (id, tenantId, data) => {
  const allowed = ['dispatch_date', 'vehicle_number', 'transporter_name', 'lr_number'];
  const setClause = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClause.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (setClause.length === 0) return;
  values.push(id, tenantId);
  await query(
    `UPDATE delivery_challans SET ${setClause.join(', ')} WHERE id = ? AND tenant_id = ? AND status = 'draft'`,
    values
  );
};

const deleteById = async (id, tenantId) => {
  await query('DELETE FROM delivery_challan_items WHERE delivery_challan_id = ? AND tenant_id = ?', [id, tenantId]);
  await query('DELETE FROM delivery_challans WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = {
  findAll,
  findById,
  findItemsByChallanId,
  create,
  createItem,
  setDispatched,
  updateDraft,
  deleteById,
};
