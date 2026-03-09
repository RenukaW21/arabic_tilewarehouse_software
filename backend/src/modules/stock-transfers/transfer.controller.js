'use strict';

const { v4: uuidv4 } = require('uuid');
const transferService = require('./transfer.service');
const transferExecutionService = require('./transferExecution.service');
const { createTransferSchema, updateTransferSchema } = require('./transfer.validation');
const { success, created, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

const createTransfer = async (req, res, next) => {
  try {
    const { error: err, value } = createTransferSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.details[0].message },
      });
    }
    const tenantId = req.tenantId;
    const createdBy = req.user?.id ?? null;
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'User context required for creating transfer' },
      });
    }
    const payload = {
      id: uuidv4(),
      tenant_id: tenantId,
      created_by: createdBy,
      ...value,
    };
    await transferService.createTransfer(payload);
    const transfer = await transferService.getTransferById(payload.id, tenantId);
    return created(res, transfer, 'Transfer created successfully');
  } catch (e) {
    next(e);
  }
};

const getTransfers = async (req, res, next) => {
  try {
    const { data, meta } = await transferService.getAllTransfers(req.tenantId, req.query);
    return paginated(res, data, meta, 'Transfers fetched');
  } catch (e) {
    next(e);
  }
};

const getTransferById = async (req, res, next) => {
  try {
    const transfer = await transferService.getTransferById(req.params.id, req.tenantId);
    if (!transfer) throw new AppError('Transfer not found', 404, 'NOT_FOUND');
    return success(res, transfer, 'Transfer fetched');
  } catch (e) {
    next(e);
  }
};

const updateTransfer = async (req, res, next) => {
  try {
    const { error: err, value } = updateTransferSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.details[0].message },
      });
    }
    const updated = await transferService.updateTransfer(req.params.id, req.tenantId, value);
    if (!updated) throw new AppError('Transfer not found', 404, 'NOT_FOUND');
    return success(res, updated, 'Transfer updated successfully');
  } catch (e) {
    next(e);
  }
};

const deleteTransfer = async (req, res, next) => {
  try {
    const deleted = await transferService.deleteTransfer(req.params.id, req.tenantId);
    if (!deleted) throw new AppError('Transfer not found', 404, 'NOT_FOUND');
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
};

/**
 * Execute (dispatch) transfer — moves stock from source to destination warehouse.
 * Transaction-safe; uses postStockMovement only (no direct stock edit).
 */
const executeTransfer = async (req, res, next) => {
  try {
    const transfer = await transferExecutionService.executeTransfer(
      req.params.id,
      req.tenantId,
      req.user.id
    );
    return success(res, transfer, 'Transfer executed — stock moved');
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createTransfer,
  getTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
  executeTransfer,
};
