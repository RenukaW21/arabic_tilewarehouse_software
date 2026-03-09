'use strict';
const { query, beginTransaction } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ['name', 'code', 'created_at']);
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['p.name', 'p.code', 'p.brand']);
  const { clauses: filterClauses, params: filterParams } = buildFilterClauses({
    'p.category_id': queryParams.categoryId,
    'p.is_active':   queryParams.isActive !== undefined ? queryParams.isActive : undefined,
  });

  const conditions = [`p.tenant_id = ?`];
  const params = [tenantId];

  if (searchClause) { conditions.push(searchClause); params.push(...searchParams); }
  filterClauses.forEach((c, i) => { conditions.push(c); params.push(filterParams[i]); });

  const where = conditions.join(' AND ');

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT p.*, pc.name AS category_name
       FROM products p LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE ${where} ORDER BY p.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM products p WHERE ${where}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT p.*, pc.name AS category_name
     FROM products p LEFT JOIN product_categories pc ON p.category_id = pc.id
     WHERE p.id = ? AND p.tenant_id = ?`,
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
    [id, data.tenantId, data.categoryId || null, data.name, data.code, data.description || null,
     data.sizeLengthMm, data.sizeWidthMm, data.sizeThicknessMm || null, data.sizeLabel,
     data.piecesPerBox, data.sqftPerBox, data.sqmtPerBox || null, data.weightPerBoxKg || null,
     data.finish || null, data.material || null, data.brand || null, data.hsnCode || null,
     data.gstRate || 18.00, data.mrp || null, data.reorderLevelBoxes || 0,
     data.barcode || null, data.imageUrl || null]
  );
  return findById(id, data.tenantId);
};

const toNum = (v) => (v === undefined || v === null || v === '') ? null : Number(v);
const toBool = (v) => (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' ? 1 : 0);

const update = async (id, tenantId, data) => {
  const isActive = data.isActive !== undefined ? toBool(data.isActive) : 1;
  await query(
    `UPDATE products SET
       category_id = ?, name = ?, code = ?, description = ?,
       size_length_mm = ?, size_width_mm = ?, size_thickness_mm = ?, size_label = ?,
       pieces_per_box = ?, sqft_per_box = ?, sqmt_per_box = ?, weight_per_box_kg = ?,
       finish = ?, material = ?, brand = ?, hsn_code = ?, gst_rate = ?, mrp = ?,
       reorder_level_boxes = ?, barcode = ?, image_url = ?, is_active = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [
      data.categoryId || null,
      data.name,
      data.code,
      data.description ?? null,
      toNum(data.sizeLengthMm) ?? 0,
      toNum(data.sizeWidthMm) ?? 0,
      toNum(data.sizeThicknessMm),
      data.sizeLabel ?? null,
      toNum(data.piecesPerBox) ?? 0,
      toNum(data.sqftPerBox) ?? 0,
      toNum(data.sqmtPerBox),
      toNum(data.weightPerBoxKg),
      data.finish ?? null,
      data.material ?? null,
      data.brand ?? null,
      data.hsnCode ?? null,
      toNum(data.gstRate) ?? 18,
      toNum(data.mrp),
      toNum(data.reorderLevelBoxes) ?? 0,
      data.barcode ?? null,
      data.imageUrl ?? null,
      isActive,
      id,
      tenantId,
    ]
  );
  return findById(id, tenantId);
};

const softDelete = async (id, tenantId) => {
  await query(`UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
};

const findByCode = async (code, tenantId, excludeId = null) => {
  const params = [code, tenantId];
  let sql = `SELECT id FROM products WHERE code = ? AND tenant_id = ?`;
  if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
  const rows = await query(sql, params);
  return rows[0] || null;
};

module.exports = { findAll, findById, create, update, softDelete, findByCode };
