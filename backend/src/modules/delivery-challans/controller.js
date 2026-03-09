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
    return success(res, data, 'Delivery challan fetched');
  } catch (err) {
    next(err);
  }
};

const createFromPickList = async (req, res, next) => {
  try {
    const pickListId = req.body?.pick_list_id;
    if (!pickListId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'pick_list_id is required' },
      });
    }
    const data = await service.createFromPickList(
      pickListId,
      req.tenantId,
      req.user.id,
      req.body
    );
    return created(res, data, 'Delivery challan created');
  } catch (err) {
    next(err);
  }
};

const dispatch = async (req, res, next) => {
  try {
    const data = await service.dispatch(req.params.id, req.tenantId, req.user.id);
    return success(res, data, 'Challan dispatched');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, data, 'Challan updated');
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

module.exports = { list, getById, createFromPickList, dispatch, update, remove };
