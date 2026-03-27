'use strict';

const { getPool, query, beginTransaction } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');
const { syncRackProductInventory } = require('../../utils/stockHelper');

const SELECT_COLUMNS = [
  'id',
  'tenant_id',
  'warehouse_id',
  'name',
  'aisle',
  '`row`',
  '`column`',
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
    \`column\`,
    level,
    capacity_boxes,
    qr_code,
    is_active
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const pool = getPool();

  await pool.execute(sql, [
    data.id,
    data.tenant_id,
    data.warehouse_id,
    data.name,
    data.aisle ?? null,
    data.row ?? null,
    data.column ?? null,
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

  const conditions = ['r.tenant_id = ?'];
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
    filterMap['r.warehouse_id'] = options.warehouse_id;
  }

  const { clauses: filterClauses, params: filterParams } =
    buildFilterClauses(filterMap);

  if (filterClauses.length) {
    conditions.push(...filterClauses);
    params.push(...filterParams);
  }

  const { clause: searchClause, params: searchParams } =
    buildSearchClause(search, ['r.name', 'r.aisle', 'r.`row`', 'r.`column`', 'r.level']);

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
    WHERE ${whereSql}
    GROUP BY r.id
  `;

  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY r.${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(DISTINCT r.id) AS total FROM racks r WHERE ${whereSql}`, params),
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
    'column',
    'level',
    'capacity_boxes',
    'qr_code',
    'is_active'
  ];

  const setParts = [];
  const values = [];

  for (const key of allowed) {

    if (fields[key] === undefined) continue;

    const col = key === 'row' ? '`row`' : (key === 'column' ? '`column`' : key);

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
// INTERNAL: Move stock_summary rows between rack slots
// ─────────────────────────────────────────────────────────────

const moveStockBetweenRacks = async (trx, tenantId, warehouseId, productId, fromRackId, toRackId, boxes) => {
  if (!boxes || boxes <= 0) return;

  // Lock source rows FOR UPDATE so no concurrent movement races
  const sourceRows = await trx.query(
    `SELECT id, shade_id, batch_id, total_boxes, total_pieces, total_sqft, avg_cost_per_box
     FROM stock_summary
     WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
       AND (rack_id <=> ?) AND total_boxes > 0
     ORDER BY total_boxes DESC
     FOR UPDATE`,
    [tenantId, warehouseId, productId, fromRackId]
  );

  const totalAvailable = sourceRows.reduce((sum, row) => {
    return sum + (parseFloat(row.total_boxes || 0));
  }, 0);

  if (totalAvailable + 1e-9 < boxes) {
    throw new Error(
      `Insufficient source stock to move ${boxes} boxes (available: ${totalAvailable})`
    );
  }

  let remaining = boxes;

  for (const row of sourceRows) {
    if (remaining <= 0) break;

    const take      = Math.min(remaining, parseFloat(row.total_boxes || 0));
    if (take <= 0) continue;

    const srcBoxes  = parseFloat(row.total_boxes  || 0);
    const ratio     = srcBoxes > 0 ? take / srcBoxes : 0;
    const takePcs   = Math.floor(parseFloat(row.total_pieces || 0) * ratio);
    const takeSqft  = parseFloat(row.total_sqft   || 0) * ratio;

    // 1. Reduce source row
    await trx.query(
      `UPDATE stock_summary
       SET total_boxes = total_boxes - ?, total_pieces = total_pieces - ?,
           total_sqft  = total_sqft  - ?, updated_at = NOW()
       WHERE id = ?`,
      [take, takePcs, takeSqft, row.id]
    );

    // 2. Upsert target row (same shade/batch, different rack_id)
    const targetRows = await trx.query(
      `SELECT id FROM stock_summary
       WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
         AND (shade_id <=> ?) AND (batch_id <=> ?) AND (rack_id <=> ?)
       FOR UPDATE`,
      [tenantId, warehouseId, productId, row.shade_id, row.batch_id, toRackId]
    );

    if (targetRows.length > 0) {
      await trx.query(
        `UPDATE stock_summary
         SET total_boxes = total_boxes + ?, total_pieces = total_pieces + ?,
             total_sqft  = total_sqft  + ?, updated_at = NOW()
         WHERE id = ?`,
        [take, takePcs, takeSqft, targetRows[0].id]
      );
    } else {
      await trx.query(
        `INSERT INTO stock_summary
           (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id,
            total_boxes, total_pieces, total_sqft, avg_cost_per_box, updated_at)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [tenantId, warehouseId, toRackId, productId,
          row.shade_id, row.batch_id, take, takePcs, takeSqft, row.avg_cost_per_box]
      );
    }

    remaining -= take;
  }
};

// ─────────────────────────────────────────────────────────────
// PRODUCT RACK MAPPING
// ─────────────────────────────────────────────────────────────

const assignProductToRack = async (tenantId, data) => {
  const isEditing = !!data.id;
  const boxesInput = Number(data.boxes_stored);
  if (!Number.isFinite(boxesInput) || boxesInput < 0) {
    throw new Error('boxes_stored must be a non-negative number');
  }

  const trx = await beginTransaction();
  try {
    const rackRows = await trx.query(
      `SELECT id, warehouse_id, capacity_boxes
       FROM racks
       WHERE id = ? AND tenant_id = ?
       FOR UPDATE`,
      [data.rack_id, tenantId]
    );
    const rack = rackRows[0];
    if (!rack) throw new Error('Rack not found');
    const rackOccupancyRows = await trx.query(
      `SELECT COALESCE(SUM(CASE WHEN p.is_active = 1 THEN pr.boxes_stored ELSE 0 END), 0) AS occupied_boxes
       FROM product_racks pr
       LEFT JOIN products p ON p.id = pr.product_id
       WHERE pr.rack_id = ? AND pr.tenant_id = ?`,
      [data.rack_id, tenantId]
    );
    rack.occupied_boxes = parseFloat(rackOccupancyRows[0]?.occupied_boxes) || 0;

    let oldRackId = null;
    let oldBoxes = 0;
    let oldWarehouseId = null;
    let oldProductId = data.product_id;

    if (isEditing) {
      const currentEntryRows = await trx.query(
        'SELECT boxes_stored, rack_id, product_id FROM product_racks WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [data.id, tenantId]
      );
      if (!currentEntryRows.length) throw new Error('Assignment entry not found');
      const oldEntry = currentEntryRows[0];
      oldRackId = oldEntry.rack_id;
      oldBoxes = Number(oldEntry.boxes_stored) || 0;
      oldProductId = oldEntry.product_id;

      if (oldRackId) {
        const oldRackRows = await trx.query(
          'SELECT warehouse_id FROM racks WHERE id = ? AND tenant_id = ? FOR UPDATE',
          [oldRackId, tenantId]
        );
        oldWarehouseId = oldRackRows[0]?.warehouse_id || rack.warehouse_id;
      }
    }

    // Capacity check (same semantics as before, but under lock)
    const diffForTarget = isEditing && oldRackId === data.rack_id
      ? boxesInput - oldBoxes
      : boxesInput;
    if (rack.capacity_boxes !== null && (Number(rack.occupied_boxes) || 0) + diffForTarget > rack.capacity_boxes) {
      const avail = rack.capacity_boxes - (Number(rack.occupied_boxes) || 0) + (isEditing && oldRackId === data.rack_id ? oldBoxes : 0);
      throw new Error(`Insufficient capacity in target rack. Max available: ${avail} boxes.`);
    }

    // Move stock_summary to keep it as source of truth.
    if (isEditing) {
      if (oldProductId !== data.product_id) {
        await moveStockBetweenRacks(trx, tenantId, oldWarehouseId || rack.warehouse_id, oldProductId, oldRackId, null, oldBoxes);
        await moveStockBetweenRacks(trx, tenantId, rack.warehouse_id, data.product_id, null, data.rack_id, boxesInput);
      } else if (oldRackId === data.rack_id) {
        const diff = boxesInput - oldBoxes;
        if (diff > 0) {
          await moveStockBetweenRacks(trx, tenantId, rack.warehouse_id, data.product_id, null, data.rack_id, diff);
        } else if (diff < 0) {
          await moveStockBetweenRacks(trx, tenantId, rack.warehouse_id, data.product_id, data.rack_id, null, -diff);
        }
      } else {
        await moveStockBetweenRacks(trx, tenantId, oldWarehouseId || rack.warehouse_id, data.product_id, oldRackId, null, oldBoxes);
        await moveStockBetweenRacks(trx, tenantId, rack.warehouse_id, data.product_id, null, data.rack_id, boxesInput);
      }
    } else {
      await moveStockBetweenRacks(trx, tenantId, rack.warehouse_id, data.product_id, null, data.rack_id, boxesInput);
    }

    // Derive product_racks from stock_summary for all touched racks.
    if (isEditing && oldRackId && oldRackId !== data.rack_id) {
      await syncRackProductInventory(trx, { tenantId, rackId: oldRackId, productId: oldProductId });
    }
    if (isEditing && oldProductId !== data.product_id && oldRackId === data.rack_id) {
      await syncRackProductInventory(trx, { tenantId, rackId: data.rack_id, productId: oldProductId });
    }
    await syncRackProductInventory(trx, { tenantId, rackId: data.rack_id, productId: data.product_id });

    await trx.commit();
    return { success: true };
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
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