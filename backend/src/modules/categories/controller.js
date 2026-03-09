'use strict';

const service = require('./service');
const { success, created } = require('../../utils/response');

const getAll = async (req, res) => {
  const categories = await service.getAll(req.tenantId);
  return success(res, categories, 'Categories fetched');
};

const getById = async (req, res) => {
  const category = await service.getById(req.params.id, req.tenantId);
  return success(res, category, 'Category fetched');
};

const create = async (req, res) => {
  const category = await service.create(req.tenantId, req.body);
  return created(res, category, 'Category created');
};

const update = async (req, res) => {
  const category = await service.update(
    req.params.id,
    req.tenantId,
    req.body
  );
  return success(res, category, 'Category updated');
};

const remove = async (req, res) => {
  const deletedCategory = await service.remove(
    req.params.id,
    req.tenantId
  );

  return success(res, deletedCategory, 'Category deleted successfully');
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};