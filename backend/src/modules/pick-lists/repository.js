'use strict';
const { query } = require('../../config/db');

const runQuery = (trx, sql, params) => (trx ? trx.query(sql, params) : query(sql, params));
const { parsePagination } = require('../../utils/pagination');

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(
    queryParams,
    ['created_at', 'pick_number', 'status']
  );
  const conditions = ['pl.tenant_id = ?'];
  const params = [tenantId];
  if (queryParams.status) {
    conditions.push('pl.status = ?');
    params.push(queryParams.status);
  }
  if (queryParams.sales_order_id) {
    conditions.push('pl.sales_order_id = ?');
    params.push(queryParams.sales_order_id);
  }
  if (search) {
    conditions.push('(pl.pick_number LIKE ? OR so.so_number LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = conditions.join(' AND ');
  const [rows, countResult] = await Promise.all([
    query(
      `SELECT pl.*, so.so_number, w.name AS warehouse_name
       FROM pick_lists pl
       JOIN sales_orders so ON pl.sales_order_id = so.id AND so.tenant_id = pl.tenant_id
       LEFT JOIN warehouses w ON w.id = pl.warehouse_id
       WHERE ${where}
       ORDER BY pl.${sortBy} ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM pick_lists pl
       JOIN sales_orders so ON pl.sales_order_id = so.id AND so.tenant_id = pl.tenant_id
       WHERE ${where}`,
      params
    ),
  ]);
  return { rows, total: countResult[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT pl.*, so.so_number, so.customer_id, w.name AS warehouse_name
     FROM pick_lists pl
     JOIN sales_orders so ON pl.sales_order_id = so.id AND so.tenant_id = pl.tenant_id
     LEFT JOIN warehouses w ON pl.warehouse_id = w.id
     WHERE pl.id = ? AND pl.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findItemsByPickListId = async (pickListId, tenantId) => {
  return query(
    `SELECT pli.*, p.code AS product_code, p.name AS product_name
     FROM pick_list_items pli
     JOIN products p ON pli.product_id = p.id
     WHERE pli.pick_list_id = ? AND pli.tenant_id = ?
     ORDER BY pli.id`,
    [pickListId, tenantId]
  );
};

const update = async (id, tenantId, data) => {
  const allowed = ['status', 'assigned_to', 'started_at', 'completed_at'];
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
    `UPDATE pick_lists SET ${setClause.join(', ')} WHERE id = ? AND tenant_id = ?`,
    values
  );
};

const deleteById = async (id, tenantId) => {
  await query('DELETE FROM pick_list_items WHERE pick_list_id = ? AND tenant_id = ?', [id, tenantId]);
  await query('DELETE FROM pick_lists WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

const updateItemPicked = async (itemId, pickListId, tenantId, pickedBoxes, trx = null) => {
  await runQuery(
    trx,
    `UPDATE pick_list_items
     SET picked_boxes = ?, picked_at = NOW(), status = ?
     WHERE id = ? AND pick_list_id = ? AND tenant_id = ?`,
    [pickedBoxes, pickedBoxes > 0 ? 'picked' : 'pending', itemId, pickListId, tenantId]
  );
};

/** Lock and return total available boxes for product/warehouse/shade/batch (any rack) */
const getAvailableStock = async (trx, tenantId, warehouseId, productId, shadeId, batchId) => {
  const rows = await trx.query(
    `SELECT id, total_boxes FROM stock_summary
     WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
       AND (shade_id <=> ?) AND (batch_id <=> ?)
     FOR UPDATE`,
    [tenantId, warehouseId, productId, shadeId || null, batchId || null]
  );
  const totalBoxes = rows.reduce((sum, r) => sum + parseFloat(r.total_boxes || 0), 0);
  return totalBoxes;
};

module.exports = {
  findAll,
  findById,
  findItemsByPickListId,
  update,
  updateItemPicked,
  getAvailableStock,
  deleteById,
};
