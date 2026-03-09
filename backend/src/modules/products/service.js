'use strict';
const repo = require('./repository');
const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const { checkProductLinked } = require('../../utils/deleteGuard');

const getAll = (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const product = await repo.findById(id, tenantId);
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
  return product;
};

const create = async (tenantId, data) => {
  const existing = await repo.findByCode(data.code, tenantId);
  if (existing) throw new AppError(`Product code '${data.code}' already exists`, 409, 'DUPLICATE_CODE');
  return repo.create({ ...data, tenantId });
};

const update = async (id, tenantId, data) => {
  await getById(id, tenantId);
  const codeConflict = await repo.findByCode(data.code, tenantId, id);
  if (codeConflict) throw new AppError(`Product code '${data.code}' already in use`, 409, 'DUPLICATE_CODE');
  return repo.update(id, tenantId, data);
};

const remove = async (id, tenantId) => {
  await getById(id, tenantId);
  await checkProductLinked(id, tenantId);
  try {
    await query('DELETE FROM products WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new AppError('Cannot delete because record is linked to existing transactions.', 400, 'LINKED_TO_TRANSACTIONS');
    }
    throw err;
  }
};

module.exports = { getAll, getById, create, update, remove };
