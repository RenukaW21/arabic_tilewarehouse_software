'use strict';

const { v4: uuidv4 } = require('uuid');
const rackService = require('./rack.service');
const { createRackSchema, updateRackSchema } = require('./rack.validation');
const { success, created, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

const createRack = async (req, res, next) => {
  try {
    const { error: err, value } = createRackSchema.validate(req.body);

    if (err) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.details[0].message,
        },
      });
    }

    const tenantId = req.tenantId;

    const payload = {
      id: uuidv4(),
      tenant_id: tenantId,
      ...value,
    };

    await rackService.createRack(payload);

    const rack = await rackService.getRackById(payload.id, tenantId);

    return created(res, rack, 'Rack created successfully');

  } catch (e) {
    next(e);
  }
};

const getRacks = async (req, res, next) => {
  try {
    const { data, meta } = await rackService.getAllRacks(
      req.tenantId,
      req.query
    );

    return paginated(res, data, meta, 'Racks fetched');
  } catch (e) {
    next(e);
  }
};

const getRackById = async (req, res, next) => {
  try {
    const rack = await rackService.getRackById(
      req.params.id,
      req.tenantId
    );

    if (!rack) {
      throw new AppError('Rack not found', 404, 'NOT_FOUND');
    }

    return success(res, rack, 'Rack fetched');

  } catch (e) {
    next(e);
  }
};

const updateRack = async (req, res, next) => {
  try {

    const { error: err, value } = updateRackSchema.validate(req.body);

    if (err) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.details[0].message,
        },
      });
    }

    const updated = await rackService.updateRack(
      req.params.id,
      req.tenantId,
      value
    );

    if (!updated) {
      throw new AppError('Rack not found', 404, 'NOT_FOUND');
    }

    return success(res, updated, 'Rack updated successfully');

  } catch (e) {
    next(e);
  }
};

const deleteRack = async (req, res, next) => {
  try {

    const deleted = await rackService.deleteRack(
      req.params.id,
      req.tenantId
    );

    if (!deleted) {
      throw new AppError('Rack not found', 404, 'NOT_FOUND');
    }

    return res.status(204).send();

  } catch (e) {
    next(e);
  }
};

const assignProduct = async (req, res, next) => {
  try {
    const data = await rackService.assignProductToRack(req.tenantId, req.body);
    return success(res, data, 'Storage updated successfully');
  } catch (e) {
    next(e);
  }
};

const getProductStorage = async (req, res, next) => {
  try {
    const data = await rackService.getProductRacks(req.tenantId, req.params.productId);
    return success(res, data, 'Product storage fetched');
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createRack,
  getRacks,
  getRackById,
  updateRack,
  deleteRack,
  assignProduct,
  getProductStorage
};