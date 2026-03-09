'use strict';

const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const SELECT_COLUMNS = [
  'id', 'tenant_id', 'transfer_number', 'from_warehouse_id', 'to_warehouse_id',
  'status', 'transfer_date', 'received_date', 'vehicle_number', 'notes', 'created_by', 'created_at',
].join(', ');

const ALLOWED_SORT_FIELDS = ['transfer_number', 'transfer_date', 'created_at'];

const getItemsByTransferId = async (transferId, tenantId) => {
  const rows = await query(
    `SELECT sti.id, sti.tenant_id, sti.transfer_id, sti.product_id, sti.shade_id, sti.batch_id,
            sti.from_rack_id, sti.to_rack_id, sti.transferred_boxes, sti.transferred_pieces,
            sti.received_boxes, sti.discrepancy_boxes,
            p.code AS product_code, p.name AS product_name
     FROM stock_transfer_items sti
     JOIN products p ON p.id = sti.product_id AND p.tenant_id = sti.tenant_id
     WHERE sti.transfer_id = ? AND sti.tenant_id = ?
     ORDER BY sti.id`,
    [transferId, tenantId]
  );
  return rows;
};

const createTransfer = async (data) => {
  const sql = `
    INSERT INTO stock_transfers (
      id, tenant_id, transfer_number, from_warehouse_id, to_warehouse_id,
      status, transfer_date, received_date, vehicle_number, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await query(sql, [
    data.id,
    data.tenant_id,
    data.transfer_number,
    data.from_warehouse_id,
    data.to_warehouse_id,
    data.status || 'draft',
    data.transfer_date,
    data.received_date ?? null,
    data.vehicle_number ?? null,
    data.notes ?? null,
    data.created_by,
  ]);
  const items = data.items || [];
  for (const it of items) {
    const itemId = uuidv4();
    await query(
      `INSERT INTO stock_transfer_items
       (id, tenant_id, transfer_id, product_id, shade_id, batch_id, from_rack_id, to_rack_id,
        transferred_boxes, transferred_pieces, received_boxes, discrepancy_boxes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        itemId,
        data.tenant_id,
        data.id,
        it.product_id,
        it.shade_id ?? null,
        it.batch_id ?? null,
        it.from_rack_id ?? null,
        it.to_rack_id ?? null,
        parseFloat(it.transferred_boxes) || 0,
        parseFloat(it.transferred_pieces) || 0,
      ]
    );
  }
};

const getAllTransfers = async (tenantId, options = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(options, ALLOWED_SORT_FIELDS);
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['transfer_number']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }
  const orderBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  const whereSql = conditions.join(' AND ');
  const baseSql = `SELECT ${SELECT_COLUMNS},
    (SELECT COUNT(*) FROM stock_transfer_items sti WHERE sti.transfer_id = stock_transfers.id AND sti.tenant_id = stock_transfers.tenant_id) AS items_count
    FROM stock_transfers WHERE ${whereSql}`;
  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM stock_transfers WHERE ${whereSql}`, params),
  ]);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getTransferById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ${SELECT_COLUMNS} FROM stock_transfers WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  const transfer = rows[0] ?? null;
  if (!transfer) return null;
  const items = await getItemsByTransferId(id, tenantId);
  return { ...transfer, items };
};

const updateTransfer = async (id, tenantId, fields) => {
  const existing = await query(
    'SELECT id, status FROM stock_transfers WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  if (!existing.length) return null;
  const isDraft = existing[0].status === 'draft';

  const allowed = [
    'transfer_number', 'from_warehouse_id', 'to_warehouse_id', 'status',
    'transfer_date', 'received_date', 'vehicle_number', 'notes',
  ];
  const setParts = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    setParts.push(`${key} = ?`);
    values.push(fields[key] === null ? null : fields[key]);
  }
  if (setParts.length > 0) {
    await query(
      `UPDATE stock_transfers SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`,
      [...values, id, tenantId]
    );
  }

  if (isDraft && Array.isArray(fields.items)) {
    await query('DELETE FROM stock_transfer_items WHERE transfer_id = ? AND tenant_id = ?', [id, tenantId]);
    for (const it of fields.items) {
      const itemId = uuidv4();
      await query(
        `INSERT INTO stock_transfer_items
         (id, tenant_id, transfer_id, product_id, shade_id, batch_id, from_rack_id, to_rack_id,
          transferred_boxes, transferred_pieces, received_boxes, discrepancy_boxes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          itemId,
          tenantId,
          id,
          it.product_id,
          it.shade_id ?? null,
          it.batch_id ?? null,
          it.from_rack_id ?? null,
          it.to_rack_id ?? null,
          parseFloat(it.transferred_boxes) || 0,
          parseFloat(it.transferred_pieces) || 0,
        ]
      );
    }
  }
  return getTransferById(id, tenantId);
};

const deleteTransfer = async (id, tenantId) => {
  await query('DELETE FROM stock_transfer_items WHERE transfer_id = ? AND tenant_id = ?', [id, tenantId]);
  const result = await query(
    'DELETE FROM stock_transfers WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createTransfer,
  getAllTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
};
