'use strict';
const { query, beginTransaction } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } =
    parsePagination(queryParams, ['name', 'code', 'created_at']);

  const { clause: searchClause, params: searchParams } =
    buildSearchClause(search, ['p.name', 'p.code', 'p.brand']);

  const { clauses: filterClauses, params: filterParams } =
    buildFilterClauses({
      'p.category_id': queryParams.categoryId,
      'p.is_active': queryParams.isActive !== undefined ? queryParams.isActive : undefined,
    });

  const conditions = [`p.tenant_id = ?`];
  const params = [tenantId];

  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  filterClauses.forEach((c, i) => {
    conditions.push(c);
    params.push(filterParams[i]);
  });

  const where = conditions.join(' AND ');

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT 
          p.*, 
          pc.name AS category_name,
          COALESCE(SUM(pr.boxes_stored), 0) as total_boxes_stored,
          GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as rack_names
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN product_racks pr ON p.id = pr.product_id
       LEFT JOIN racks r ON pr.rack_id = r.id
       WHERE ${where}
       GROUP BY p.id
       ORDER BY p.${sortBy} ${sortOrder}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      `SELECT COUNT(DISTINCT p.id) AS total 
       FROM products p 
       WHERE ${where}`,
      params
    ),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT 
        p.*, 
        pc.name AS category_name,
        COALESCE(SUM(pr.boxes_stored), 0) as total_boxes_stored,
        GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as rack_names,
        GROUP_CONCAT(DISTINCT w.name SEPARATOR ', ') as warehouse_names
     FROM products p
     LEFT JOIN product_categories pc ON p.category_id = pc.id
     LEFT JOIN product_racks pr ON p.id = pr.product_id
     LEFT JOIN racks r ON pr.rack_id = r.id
     LEFT JOIN warehouses w ON r.warehouse_id = w.id
     WHERE p.id = ? AND p.tenant_id = ?
     GROUP BY p.id`,
    [id, tenantId]
  );

  return rows[0] || null;
};

const create = async (data) => {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  await query(
    `INSERT INTO products
       (id, tenant_id, category_id, name, code, description,
        size_length_mm, size_width_mm, size_thickness_mm, size_label,
        pieces_per_box, sqft_per_box, sqmt_per_box, weight_per_box_kg,
        finish, material, brand, hsn_code, gst_rate, mrp,
        reorder_level_boxes, barcode, image_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
    [
      id,
      data.tenantId,
      data.categoryId || null,
      data.name,
      data.code,
      data.description || null,
      data.sizeLengthMm,
      data.sizeWidthMm,
      data.sizeThicknessMm || null,
      data.sizeLabel,
      data.piecesPerBox,
      data.sqftPerBox,
      data.sqmtPerBox || null,
      data.weightPerBoxKg || null,
      data.finish || null,
      data.material || null,
      data.brand || null,
      data.hsnCode || null,
      data.gstRate || 18.0,
      data.mrp || null,
      data.reorderLevelBoxes || 0,
      data.barcode || null,
      data.imageUrl || null,
    ]
  );

  return findById(id, data.tenantId);
};

const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const toBool = (v) =>
  v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' ? 1 : 0;

const update = async (id, tenantId, data) => {
  const existing = await findById(id, tenantId);
  if (!existing) return null;

  const isActive = data.isActive !== undefined ? toBool(data.isActive) : existing.is_active;

  const trx = await beginTransaction();
  try {
    // Update product — COALESCE so omitted fields keep existing values
    await trx.query(
      `UPDATE products SET
         category_id        = COALESCE(?, category_id),
         name               = COALESCE(?, name),
         code               = COALESCE(?, code),
         description        = ?,
         size_length_mm     = COALESCE(?, size_length_mm),
         size_width_mm      = COALESCE(?, size_width_mm),
         size_thickness_mm  = COALESCE(?, size_thickness_mm),
         size_label         = COALESCE(?, size_label),
         pieces_per_box     = COALESCE(?, pieces_per_box),
         sqft_per_box       = COALESCE(?, sqft_per_box),
         sqmt_per_box       = COALESCE(?, sqmt_per_box),
         weight_per_box_kg  = COALESCE(?, weight_per_box_kg),
         finish             = COALESCE(?, finish),
         material           = COALESCE(?, material),
         brand              = COALESCE(?, brand),
         hsn_code           = COALESCE(?, hsn_code),
         gst_rate           = COALESCE(?, gst_rate),
         mrp                = ?,
         reorder_level_boxes= COALESCE(?, reorder_level_boxes),
         barcode            = COALESCE(?, barcode),
         image_url          = COALESCE(?, image_url),
         is_active          = ?,
         updated_at         = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        data.categoryId != null ? data.categoryId : null,
        data.name != null ? data.name : null,
        data.code != null ? data.code : null,
        data.description !== undefined ? (data.description || null) : existing.description,
        toNum(data.sizeLengthMm),
        toNum(data.sizeWidthMm),
        toNum(data.sizeThicknessMm),
        data.sizeLabel != null ? data.sizeLabel : null,
        toNum(data.piecesPerBox),
        toNum(data.sqftPerBox),
        toNum(data.sqmtPerBox),
        toNum(data.weightPerBoxKg),
        data.finish !== undefined ? (data.finish || null) : null,
        data.material !== undefined ? (data.material || null) : null,
        data.brand !== undefined ? (data.brand || null) : null,
        data.hsnCode !== undefined ? (data.hsnCode || null) : null,
        toNum(data.gstRate),
        data.mrp !== undefined ? toNum(data.mrp) : existing.mrp,
        toNum(data.reorderLevelBoxes),
        data.barcode !== undefined ? (data.barcode || null) : null,
        data.imageUrl != null ? data.imageUrl : null,
        isActive,
        id,
        tenantId,
      ]
    );

    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }

  return findById(id, tenantId);
};

const softDelete = async (id, tenantId) => {
  const trx = await beginTransaction();
  try {
    // 0. Get affected racks before deletion to sync them later
    const affectedRacks = await trx.query(
      `SELECT DISTINCT rack_id FROM product_racks WHERE product_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    // 1. Soft-delete the product
    await trx.query(
      `UPDATE products SET is_active = FALSE, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    // 2. Free up rack occupancy — remove all rack assignments for this product
    await trx.query(
      `DELETE FROM product_racks WHERE product_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    await trx.commit();

    // 3. Sync each affected rack (after commit so the child queries see the changes)
    if (affectedRacks && affectedRacks.length > 0) {
      const rackService = require('../racks/rack.service');
      for (const row of affectedRacks) {
        await rackService.syncRackOccupancy(row.rack_id, tenantId);
      }
    }
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const findByCode = async (code, tenantId, excludeId = null) => {
  const params = [code, tenantId];
  let sql = `SELECT id FROM products WHERE code = ? AND tenant_id = ?`;

  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }

  const rows = await query(sql, params);
  return rows[0] || null;
};

const getProductVendors = async (productId, tenantId) => {
  return query(
    `SELECT DISTINCT v.id, v.name
     FROM grn_items gi
     JOIN grn g ON gi.grn_id = g.id
     JOIN vendors v ON g.vendor_id = v.id
     WHERE gi.product_id = ?
       AND v.tenant_id = ?
       AND g.tenant_id = ?
       AND gi.tenant_id = ?`,
    [productId, tenantId, tenantId, tenantId]
  );
};

const getProductCustomers = async (productId, tenantId) => {
  return query(
    `SELECT DISTINCT c.id, c.name
     FROM sales_order_items soi
     JOIN sales_orders so ON soi.sales_order_id = so.id
     JOIN customers c ON so.customer_id = c.id
     WHERE soi.product_id = ?
       AND c.tenant_id = ?
       AND so.tenant_id = ?
       AND soi.tenant_id = ?`,
    [productId, tenantId, tenantId, tenantId]
  );
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  softDelete,
  findByCode,
  getProductVendors,
  getProductCustomers,
};