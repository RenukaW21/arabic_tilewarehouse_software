'use strict';
const { v4: uuidv4 } = require('uuid');
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');

const getByTenant = async (tenantId) => {
  const row = await repo.findByTenantId(tenantId);
  return row;
};

const getById = async (id, tenantId) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('GST configuration not found', 404, 'NOT_FOUND');
  return row;
};

const create = async (tenantId, data) => {
  const existing = await repo.findByTenantId(tenantId);
  if (existing) {
    throw new AppError('Only one GST configuration per tenant is allowed', 400, 'ALREADY_EXISTS');
  }
  const id = uuidv4();
  await repo.create({
    id,
    tenant_id: tenantId,
    gstin: data.gstin,
    legal_name: data.legal_name,
    trade_name: data.trade_name || null,
    state_code: data.state_code,
    state_name: data.state_name,
    pan: data.pan || null,
    default_gst_rate: data.default_gst_rate ?? 18,
    fiscal_year_start: data.fiscal_year_start ?? '04-01',
    invoice_prefix: data.invoice_prefix || null,
    is_composition_scheme: data.is_composition_scheme ?? false,
  });
  return repo.findById(id, tenantId);
};

const update = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('GST configuration not found', 404, 'NOT_FOUND');
  await repo.update(id, tenantId, data);
  return repo.findById(id, tenantId);
};

const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('GST configuration not found', 404, 'NOT_FOUND');
  await repo.remove(id, tenantId);
};

module.exports = { getByTenant, getById, create, update, remove };
