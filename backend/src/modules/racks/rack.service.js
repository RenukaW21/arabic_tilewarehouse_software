'use strict';

const { getPool, query } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');

const SELECT_COLUMNS = [
  'id',
  'tenant_id',
  'warehouse_id',
  'name',
  'aisle',
  '`row`',
  'level',
  'capacity_boxes',
  'qr_code',
  'is_active',
  'created_at'
].join(', ');

const ALLOWED_SORT_FIELDS = ['name', 'aisle', 'created_at'];


// ─────────────────────────────────────────────────────────────
// CREATE RACK
// ─────────────────────────────────────────────────────────────

const createRack = async (data) => {
  const sql = `
  INSERT INTO racks (
    id,
    tenant_id,
    warehouse_id,
    name,
    aisle,
    \`row\`,
    level,
    capacity_boxes,
    qr_code,
    is_active
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const pool = getPool();

  await pool.execute(sql, [
    data.id,
    data.tenant_id,
    data.warehouse_id,
    data.name,
    data.aisle ?? null,
    data.row ?? null,
    data.level ?? null,
    data.capacity_boxes ?? null,
    data.qr_code ?? null,
    data.is_active !== false ? 1 : 0
  ]);
};


// ─────────────────────────────────────────────────────────────
// GET ALL RACKS
// ─────────────────────────────────────────────────────────────

const getAllRacks = async (tenantId, options = {}) => {

  const { page, limit, offset, sortBy, sortOrder, search } =
    parsePagination(options, ALLOWED_SORT_FIELDS);

  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  const filterMap = {};

  if (options.is_active !== undefined && options.is_active !== '') {
    filterMap.is_active =
      options.is_active === true ||
        options.is_active === '1' ||
        options.is_active === 'true'
        ? 1
        : 0;
  }

  if (options.warehouse_id) {
    filterMap.warehouse_id = options.warehouse_id;
  }

  const { clauses: filterClauses, params: filterParams } =
    buildFilterClauses(filterMap);

  if (filterClauses.length) {
    conditions.push(...filterClauses);
    params.push(...filterParams);
  }

  const { clause: searchClause, params: searchParams } =
    buildSearchClause(search, ['name', 'aisle', 'zone']);

  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  const orderBy = ALLOWED_SORT_FIELDS.includes(sortBy)
    ? sortBy
    : 'created_at';

  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

  const whereSql = conditions.join(' AND ');

  const baseSql = `
    SELECT r.*, w.name as warehouse_name,
           COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0) AS occupied_boxes,
           (r.capacity_boxes - COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0)) AS available_boxes
    FROM racks r
    LEFT JOIN warehouses w ON r.warehouse_id = w.id
    LEFT JOIN product_racks pr ON r.id = pr.rack_id
    LEFT JOIN products p ON pr.product_id = p.id
    WHERE r.${whereSql}
    GROUP BY r.id
  `;

  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY r.${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(DISTINCT id) AS total FROM racks WHERE ${whereSql}`, params),
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


// ─────────────────────────────────────────────────────────────
// GET RACK BY ID
// ─────────────────────────────────────────────────────────────

const getRackById = async (id, tenantId) => {

  const rows = await query(
    `SELECT r.*, w.name as warehouse_name,
            COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0) AS occupied_boxes,
            (r.capacity_boxes - COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0)) AS available_boxes
     FROM racks r
     LEFT JOIN warehouses w ON r.warehouse_id = w.id
     LEFT JOIN product_racks pr ON r.id = pr.rack_id
     LEFT JOIN products p ON pr.product_id = p.id
     WHERE r.id = ? AND r.tenant_id = ?
     GROUP BY r.id`,
    [id, tenantId]
  );

  return rows[0] ?? null;
};


// ─────────────────────────────────────────────────────────────
// UPDATE RACK
// ─────────────────────────────────────────────────────────────

const updateRack = async (id, tenantId, fields) => {

  const existing = await getRackById(id, tenantId);

  if (!existing) return null;

  const allowed = [
    'warehouse_id',
    'name',
    'aisle',
    'row',
    'level',
    'capacity_boxes',
    'qr_code',
    'is_active'
  ];

  const setParts = [];
  const values = [];

  for (const key of allowed) {

    if (fields[key] === undefined) continue;

    const col = key === 'row' ? '`row`' : key;

    setParts.push(`${col} = ?`);

    values.push(
      key === 'is_active'
        ? fields[key] === true || fields[key] === 1
          ? 1
          : 0
        : fields[key]
    );
  }

  // No additional fields
  const pool = getPool();

  const [result] = await pool.execute(
    `UPDATE racks SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`,
    [...values, id, tenantId]
  );

  if (result.affectedRows === 0) return null;

  return getRackById(id, tenantId);
};


// ─────────────────────────────────────────────────────────────
// DELETE RACK (SOFT DELETE)
// ─────────────────────────────────────────────────────────────

const deleteRack = async (id, tenantId) => {

  const pool = getPool();

  const [result] = await pool.execute(
    'UPDATE racks SET is_active = 0 WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );

  return result.affectedRows > 0;
};

// ─────────────────────────────────────────────────────────────
// PRODUCT RACK MAPPING
// ─────────────────────────────────────────────────────────────

const assignProductToRack = async (tenantId, data) => {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  // 1. Get rack capacity and current occupancy
  const rack = await getRackById(data.rack_id, tenantId);
  if (!rack) throw new Error('Rack not found');

  // get current boxes for this specific product-rack mapping (if any)
  const existingRows = await query(
    'SELECT boxes_stored FROM product_racks WHERE product_id = ? AND rack_id = ? AND tenant_id = ?',
    [data.product_id, data.rack_id, tenantId]
  );
  const existingBoxesForThisProduct = existingRows[0]?.boxes_stored || 0;

  // Calculate potential new total: TotalOccupied - OldValueForThisProduct + NewValue
  const newOccupiedTotal = (Number(rack.occupied_boxes) || 0) - existingBoxesForThisProduct + Number(data.boxes_stored);

  if (rack.capacity_boxes !== null && newOccupiedTotal > rack.capacity_boxes) {
    const available = rack.capacity_boxes - ((Number(rack.occupied_boxes) || 0) - existingBoxesForThisProduct);
    throw new Error(`Rack capacity exceeded. Only ${available} boxes available.`);
  }

  await query(sql, [id, tenantId, data.product_id, data.rack_id, data.boxes_stored, data.boxes_stored]);

  // 3. Sync the 'racks' table columns
  await syncRackOccupancy(data.rack_id, tenantId);

  return { success: true };
};

const syncRackOccupancy = async (rackId, tenantId) => {
  // Recalculates based on active products only
  const sql = `
    UPDATE racks r
    SET 
      occupied_boxes = (
        SELECT COALESCE(SUM(pr.boxes_stored), 0)
        FROM product_racks pr
        JOIN products p ON pr.product_id = p.id
        WHERE pr.rack_id = ? AND p.is_active = 1
      ),
      available_boxes = capacity_boxes - (
        SELECT COALESCE(SUM(pr.boxes_stored), 0)
        FROM product_racks pr
        JOIN products p ON pr.product_id = p.id
        WHERE pr.rack_id = ? AND p.is_active = 1
      )
    WHERE r.id = ? AND r.tenant_id = ?
  `;
  await query(sql, [rackId, rackId, rackId, tenantId]);
};

const getProductRacks = async (tenantId, productId) => {
  return query(
    `SELECT pr.*, r.name as rack_name, w.name as warehouse_name
     FROM product_racks pr
     JOIN racks r ON pr.rack_id = r.id
     JOIN warehouses w ON r.warehouse_id = w.id
     WHERE pr.tenant_id = ? AND pr.product_id = ?`,
    [tenantId, productId]
  );
};

module.exports = {
  createRack,
  getAllRacks,
  getRackById,
  updateRack,
  deleteRack,
  assignProductToRack,
  getProductRacks,
  syncRackOccupancy
};