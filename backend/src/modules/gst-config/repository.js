'use strict';
const { query } = require('../../config/db');

const findById = async (id, tenantId) => {
  const rows = await query(
    'SELECT * FROM gst_configurations WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return rows[0] || null;
};

const findByTenantId = async (tenantId) => {
  const rows = await query('SELECT * FROM gst_configurations WHERE tenant_id = ?', [tenantId]);
  return rows[0] || null;
};

const create = async (data) => {
  await query(
    `INSERT INTO gst_configurations
       (id, tenant_id, gstin, legal_name, trade_name, state_code, state_name, pan,
        default_gst_rate, fiscal_year_start, invoice_prefix, is_composition_scheme, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.id,
      data.tenant_id,
      data.gstin,
      data.legal_name,
      data.trade_name ?? null,
      data.state_code,
      data.state_name,
      data.pan ?? null,
      data.default_gst_rate ?? 18,
      data.fiscal_year_start ?? '04-01',
      data.invoice_prefix ?? null,
      data.is_composition_scheme ? 1 : 0,
    ]
  );
  return data.id;
};

const update = async (id, tenantId, data) => {
  const allowed = [
    'gstin', 'legal_name', 'trade_name', 'state_code', 'state_name', 'pan',
    'default_gst_rate', 'fiscal_year_start', 'invoice_prefix', 'is_composition_scheme',
  ];
  const setClause = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClause.push(key === 'is_composition_scheme' ? 'is_composition_scheme = ?' : `${key} = ?`);
      values.push(key === 'is_composition_scheme' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (setClause.length === 0) return;
  values.push(id, tenantId);
  await query(
    `UPDATE gst_configurations SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    values
  );
};

const remove = async (id, tenantId) => {
  await query('DELETE FROM gst_configurations WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = { findById, findByTenantId, create, update, remove };
