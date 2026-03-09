'use strict';

const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_UPDATE_FIELDS = ['name', 'parentId', 'isActive'];

const findAll = async (tenantId) => {
  return query(
    `SELECT *
     FROM product_categories
     WHERE tenant_id = ?
     ORDER BY name ASC`,
    [tenantId]
  );
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT *
     FROM product_categories
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findByName = async (name, tenantId, excludeId = null) => {
  let sql = `SELECT id FROM product_categories WHERE name = ? AND tenant_id = ?`;
  const params = [name, tenantId];

  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }

  const rows = await query(sql, params);
  return rows[0] || null;
};

const create = async (tenantId, data) => {
  const id = uuidv4();

  await query(
    `INSERT INTO product_categories
     (id, tenant_id, name, parent_id, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      tenantId,
      data.name,
      data.parentId ?? null,
      data.isActive ?? 1,
    ]
  );

  return findById(id, tenantId);
};

const update = async (id, tenantId, data) => {
  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }

  if (data.parentId !== undefined) {
    fields.push('parent_id = ?');
    values.push(data.parentId);
  }

  if (data.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(data.isActive);
  }

  if (!fields.length) {
    throw new Error('No fields to update');
  }

  await query(
    `UPDATE product_categories
     SET ${fields.join(', ')}
     WHERE id = ? AND tenant_id = ?`,
    [...values, id, tenantId]
  );

  return findById(id, tenantId);
};

const hardDelete = async (id, tenantId) => {
  const result = await query(
    `DELETE FROM product_categories
     WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  return result.affectedRows;
};

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  hardDelete,
};