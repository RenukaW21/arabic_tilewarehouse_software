'use strict';
const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const count = await repo.findById(id, tenantId);
  if (!count) throw new AppError('Stock count not found', 404, 'NOT_FOUND');
  const items = await repo.findItemsByCountId(id, tenantId);
  return { ...count, items };
};

const create = async (tenantId, userId, data) => {
  const countNumber = await generateDocNumber(tenantId, 'SC', 'SC');
  const id = await repo.create({
    tenant_id: tenantId,
    count_number: countNumber,
    warehouse_id: data.warehouse_id,
    count_type: data.count_type || 'full',
    count_date: data.count_date || new Date(),
    created_by: userId,
  });
  return repo.findById(id, tenantId);
};

const loadFromStock = async (id, tenantId) => {
  const count = await repo.findById(id, tenantId);
  if (!count) throw new AppError('Stock count not found', 404, 'NOT_FOUND');
  if (count.status !== 'draft') {
    throw new AppError('Only draft counts can load from stock', 400, 'INVALID_STATUS');
  }
  const trx = await beginTransaction();
  try {
    const existing = await trx.query('SELECT id FROM stock_count_items WHERE stock_count_id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length > 0) {
      await trx.rollback();
      throw new AppError('Count already has items. Create a new count to load from stock.', 400, 'ALREADY_LOADED');
    }
    await repo.loadItemsFromStock(trx, id, tenantId, count.warehouse_id);
    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const updateItem = async (countId, itemId, tenantId, countedBoxes) => {
  const count = await repo.findById(countId, tenantId);
  if (!count) throw new AppError('Stock count not found', 404, 'NOT_FOUND');
  await repo.updateItemCounted(itemId, countId, tenantId, countedBoxes);
  return getById(countId, tenantId);
};

module.exports = { getAll, getById, create, loadFromStock, updateItem };
