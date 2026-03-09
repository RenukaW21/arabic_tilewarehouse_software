'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    return paginated(res, rows, {
      page: req.query.page || 1,
      limit: req.query.limit || 25,
      total,
    });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId);
    return success(res, data, 'User fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await service.create(req.tenantId, req.body);
    return created(res, data, 'User created');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(
      req.params.id,
      req.tenantId,
      req.user.id,
      req.user.role,
      req.body
    );
    return success(res, data, 'User updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id, req.tenantId, req.user.id);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove };
