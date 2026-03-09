'use strict';
const service = require('./service');
const { success, created } = require('../../utils/response');

const get = async (req, res, next) => {
  try {
    const data = await service.getByTenant(req.tenantId);
    return success(res, data || null, data ? 'GST config fetched' : 'No GST config');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId);
    return success(res, data, 'GST config fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await service.create(req.tenantId, req.body);
    return created(res, data, 'GST configuration created');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, data, 'GST configuration updated');
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

module.exports = { get, getById, create, update, remove };
