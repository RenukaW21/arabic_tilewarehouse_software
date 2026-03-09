'use strict';

const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');
const { query } = require('../../config/db');

const getAll = (tenantId) => repo.findAll(tenantId);

const getById = async (id, tenantId) => {
  const category = await repo.findById(id, tenantId);
  if (!category) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }
  return category;
};

const create = async (tenantId, data) => {
  const payload = {
    name: data.name,
    parentId: data.parentId ?? null,
    isActive: data.isActive ?? 1,
  };

  const duplicate = await repo.findByName(payload.name, tenantId);
  if (duplicate) {
    throw new AppError('Category already exists', 409, 'DUPLICATE');
  }

  if (payload.parentId) {
    const parent = await repo.findById(payload.parentId, tenantId);
    if (!parent) {
      throw new AppError('Invalid parent category', 400, 'INVALID_PARENT');
    }
  }

  return repo.create(tenantId, payload);
};

const update = async (id, tenantId, data) => {
  // Make sure category exists
  await getById(id, tenantId);

  if (data.name) {
    const duplicate = await repo.findByName(data.name, tenantId, id);
    if (duplicate) {
      throw new AppError('Category already exists', 409, 'DUPLICATE');
    }
  }

  if (data.parentId) {
    if (data.parentId === id) {
      throw new AppError('Category cannot be its own parent', 400, 'INVALID_PARENT');
    }

    const parent = await repo.findById(data.parentId, tenantId);
    if (!parent) {
      throw new AppError('Invalid parent category', 400, 'INVALID_PARENT');
    }
  }

  return repo.update(id, tenantId, data);
};

const remove = async (id, tenantId) => {
  const category = await getById(id, tenantId);

  // Check child categories
  const children = await query(
    `SELECT id FROM product_categories 
     WHERE parent_id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  if (children.length > 0) {
    throw new AppError(
      'Cannot delete category. Child categories exist.',
      400,
      'CATEGORY_HAS_CHILDREN'
    );
  }

  await repo.hardDelete(id, tenantId);

  return category;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};