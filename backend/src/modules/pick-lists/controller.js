'use strict';
const service = require('./service');
const { success, paginated } = require('../../utils/response');

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
    return success(res, data, 'Pick list fetched');
  } catch (err) {
    next(err);
  }
};

const assign = async (req, res, next) => {
  try {
    const data = await service.assign(req.params.id, req.tenantId, req.body.assigned_to);
    return success(res, data, 'Pick list assigned');
  } catch (err) {
    next(err);
  }
};

const updateItemPicked = async (req, res, next) => {
  try {
    const data = await service.updateItemPicked(
      req.params.id,
      req.params.itemId,
      req.tenantId,
      req.body.picked_boxes
    );
    return success(res, data, 'Item updated');
  } catch (err) {
    next(err);
  }
};

const complete = async (req, res, next) => {
  try {
    const data = await service.complete(req.params.id, req.tenantId);
    return success(res, data, 'Pick list completed');
  } catch (err) {
    next(err);
  }
};

const reopen = async (req, res, next) => {
  try {
    const data = await service.reopen(req.params.id, req.tenantId);
    return success(res, data, 'Pick list reopened');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, data, 'Pick list updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id, req.tenantId);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, assign, updateItemPicked, complete, reopen, update, remove };
