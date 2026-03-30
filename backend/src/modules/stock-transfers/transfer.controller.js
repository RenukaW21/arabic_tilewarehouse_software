'use strict';

const { v4: uuidv4 } = require('uuid');
const transferService = require('./transfer.service');
const transferExecutionService = require('./transferExecution.service');
const { createTransferSchema, updateTransferSchema } = require('./transfer.validation');
const { success, created, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');
const { generateDocNumber } = require('../../utils/docNumber');

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
    const transferNumber = await generateDocNumber(tenantId, 'ST', 'ST');
    const payload = {
      id: uuidv4(),
      tenant_id: tenantId,
      created_by: createdBy,
      transfer_number: transferNumber,
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
    const existing = await transferService.getTransferById(req.params.id, req.tenantId);
    if (!existing) throw new AppError('Transfer not found', 404, 'NOT_FOUND');
    if (existing.status !== 'draft') {
      throw new AppError(
        'Only draft transfers can be edited.',
        400, 'INVALID_STATUS',
        'Confirm the transfer first to lock it, or create a new transfer.'
      );
    }
    const updated = await transferService.updateTransfer(req.params.id, req.tenantId, value);
    return success(res, updated, 'Transfer updated successfully');
  } catch (e) {
    next(e);
  }
};

const deleteTransfer = async (req, res, next) => {
  try {
    const existing = await transferService.getTransferById(req.params.id, req.tenantId);
    if (!existing) throw new AppError('Transfer not found', 404, 'NOT_FOUND');
    if (existing.status !== 'draft') {
      throw new AppError(
        'Only draft transfers can be deleted.',
        400, 'INVALID_STATUS',
        'Cancel the transfer instead, or contact an administrator.'
      );
    }
    await transferService.deleteTransfer(req.params.id, req.tenantId);
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
};

/**
 * POST /:id/confirm — Draft → In Transit.
 * Immediately deducts stock from source warehouse; marks empty racks as vacant.
 */
const confirmTransfer = async (req, res, next) => {
  try {
    const transfer = await transferExecutionService.confirmTransfer(
      req.params.id,
      req.tenantId,
      req.user.id
    );
    return success(res, transfer, 'Transfer confirmed — stock deducted from source warehouse');
  } catch (e) {
    next(e);
  }
};

/**
 * POST /:id/receive — In Transit → Received.
 * Adds stock to destination warehouse.
 */
const receiveTransfer = async (req, res, next) => {
  try {
    const transfer = await transferExecutionService.receiveTransfer(
      req.params.id,
      req.tenantId,
      req.user.id,
      req.body?.notes ?? null
    );
    return success(res, transfer, 'Transfer received — stock added to destination warehouse');
  } catch (e) {
    next(e);
  }
};

const getTransfersByProduct = async (req, res, next) => {
  try {
    const transfers = await transferService.getTransfersByProduct(
      req.params.productId,
      req.tenantId
    );
    return success(res, transfers, 'Product transfers fetched');
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
  confirmTransfer,
  receiveTransfer,
  getTransfersByProduct,
};
