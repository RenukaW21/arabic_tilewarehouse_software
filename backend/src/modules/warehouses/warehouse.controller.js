'use strict';

const { v4: uuidv4 } = require('uuid');
const warehouseService = require('./warehouse.service');
const { createWarehouseSchema, updateWarehouseSchema } = require('./warehouse.validation');
const { success, created, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

const createWarehouse = async (req, res, next) => {
  try {
    const { error: err, value } = createWarehouseSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.details[0].message },
      });
    }
    const tenantId = req.tenantId;
    const payload = { id: uuidv4(), tenant_id: tenantId, ...value };
    await warehouseService.createWarehouse(payload);
    const warehouse = await warehouseService.getWarehouseById(payload.id, tenantId);
    return created(res, warehouse, 'Warehouse created successfully');
  } catch (e) {
    next(e);
  }
};

const getWarehouses = async (req, res, next) => {
  try {
    const { data, meta } = await warehouseService.getAllWarehouses(req.tenantId, req.query);
    return paginated(res, data, meta, 'Warehouses fetched');
  } catch (e) {
    next(e);
  }
};

const getWarehouseById = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.getWarehouseById(req.params.id, req.tenantId);
    if (!warehouse) throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
    return success(res, warehouse, 'Warehouse fetched');
  } catch (e) {
    next(e);
  }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const { error: err, value } = updateWarehouseSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.details[0].message },
      });
    }
    const updated = await warehouseService.updateWarehouse(req.params.id, req.tenantId, value);
    if (!updated) throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
    return success(res, updated, 'Warehouse updated successfully');
  } catch (e) {
    next(e);
  }
};

const deleteWarehouse = async (req, res, next) => {
  try {
    const deleted = await warehouseService.deleteWarehouse(req.params.id, req.tenantId);
    if (!deleted) throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
};
