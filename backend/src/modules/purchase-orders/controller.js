'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const {
  createPOSchema,
  updatePOSchema,
  updateStatusSchema,
  updateReceivedDateSchema,
  createPOItemSchema,
  updatePOItemSchema,
  receiveItemSchema,
  paymentStatusSchema,
  listQuerySchema,
} = require('./validation');

// ─── VALIDATION MIDDLEWARE ────────────────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(422).json({
      success: false,
      error: {
        code:    'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }
  req.body = value;
  next();
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { error } = listQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: error.details[0].message },
      });
    }
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Purchase orders fetched');
  } catch (err) {
    next(err);
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const po = await service.getById(req.params.id, req.tenantId);
    return success(res, po, 'Purchase order fetched');
  } catch (err) {
    next(err);
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const po = await service.create(req.tenantId, req.user.id, req.body);
    return created(res, po, 'Purchase order created');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const po = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, po, 'Purchase order updated');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE STATUS (new) ──────────────────────────────────────────────────────
// FIX #2
const updateStatus = async (req, res, next) => {
  try {
    const po = await service.updateStatus(req.params.id, req.tenantId, req.body.status);
    return success(res, po, 'Purchase order status updated');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE RECEIVED DATE (new) ───────────────────────────────────────────────
// FIX #4 — separate endpoint so received_date is never touched during draft editing
const updateReceivedDate = async (req, res, next) => {
  try {
    const po = await service.update(req.params.id, req.tenantId, {
      received_date: req.body.received_date,
    });
    return success(res, po, 'Received date updated');
  } catch (err) {
    next(err);
  }
};

// ─── APPROVE ──────────────────────────────────────────────────────────────────
const approve = async (req, res, next) => {
  try {
    const po = await service.approve(req.params.id, req.tenantId, req.user.id);
    return success(res, po, 'Purchase order approved');
  } catch (err) {
    next(err);
  }
};

// ─── CANCEL ───────────────────────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const po = await service.remove(req.params.id, req.tenantId);
    return success(res, po, 'Purchase order cancelled');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE PAYMENT STATUS ────────────────────────────────────────────────────
const updatePaymentStatus = async (req, res, next) => {
  try {
    const po = await service.updatePaymentStatus(
      req.params.id,
      req.tenantId,
      req.body.payment_status
    );
    return success(res, po, 'Payment status updated');
  } catch (err) {
    next(err);
  }
};

// ─── RECEIVE ITEM (new) ───────────────────────────────────────────────────────
// FIX #6
const receiveItem = async (req, res, next) => {
  try {
    const po = await service.receiveItem(
      req.params.id,
      req.params.itemId,
      req.tenantId,
      req.body
    );
    return success(res, po, 'Received quantity updated');
  } catch (err) {
    next(err);
  }
};

// ─── ITEM — ADD ───────────────────────────────────────────────────────────────
const addItem = async (req, res, next) => {
  try {
    const po = await service.addItem(req.params.id, req.tenantId, req.body);
    return created(res, po, 'Item added');
  } catch (err) {
    next(err);
  }
};

// ─── ITEM — UPDATE ────────────────────────────────────────────────────────────
const updateItem = async (req, res, next) => {
  try {
    const po = await service.updateItem(
      req.params.id,
      req.params.itemId,
      req.tenantId,
      req.body
    );
    return success(res, po, 'Item updated');
  } catch (err) {
    next(err);
  }
};

// ─── ITEM — DELETE ────────────────────────────────────────────────────────────
const deleteItem = async (req, res, next) => {
  try {
    const po = await service.deleteItem(req.params.id, req.params.itemId, req.tenantId);
    return success(res, po, 'Item removed');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStatus,
  updateReceivedDate,
  approve,
  remove,
  updatePaymentStatus,
  receiveItem,
  addItem,
  updateItem,
  deleteItem,
  validate,
  schemas: {
    createPOSchema,
    updatePOSchema,
    updateStatusSchema,
    updateReceivedDateSchema,
    createPOItemSchema,
    updatePOItemSchema,
    receiveItemSchema,
    paymentStatusSchema,
  },
};
