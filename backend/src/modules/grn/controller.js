'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { writeAuditLog, extractRequestMeta } = require('../../utils/auditLog');
const {
  createGRNSchema,
  updateGRNSchema,
  addGRNItemSchema,
  updateQualitySchema,
  listQuerySchema,
} = require('./validation');

// ─── VALIDATION MIDDLEWARE ────────────────────────────────────────────────────
// FIX #12 — added validate middleware (GRN had none before)
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }
  req.body = value;
  next();
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
// FIX #8 — all controller functions now have try/catch/next
const getAll = async (req, res, next) => {
  try {
    const { error } = listQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.details[0].message } });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 25));
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    return paginated(res, rows, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const grn = await service.getById(req.params.id, req.tenantId);
    return success(res, grn, 'GRN fetched');
  } catch (err) {
    next(err);
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const grn = await service.create(req.tenantId, req.user.id, req.body);
    const meta = extractRequestMeta(req);
    await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'CREATE', tableName: 'grn', recordId: grn.id, newValues: req.body, ...meta });
    return created(res, grn, 'GRN created');
  } catch (err) {
    next(err);
  }
};

// ─── POST GRN ─────────────────────────────────────────────────────────────────
const postGRN = async (req, res, next) => {
  try {
    const grn = await service.postGRN(req.params.id, req.tenantId, req.user.id);
    const meta = extractRequestMeta(req);
    await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'POST_GRN', tableName: 'grn', recordId: req.params.id, newValues: { status: 'posted' }, ...meta });
    return success(res, grn, 'GRN posted — stock updated');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE QUALITY ───────────────────────────────────────────────────────────
const updateQuality = async (req, res, next) => {
  try {
    await service.updateQuality(req.params.id, req.tenantId, req.params.itemId, req.body);
    return success(res, {}, 'Quality status updated');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const grn = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, grn, 'GRN updated');
  } catch (err) {
    next(err);
  }
};

// ─── ADD ITEM ─────────────────────────────────────────────────────────────────
const addItem = async (req, res, next) => {
  try {
    const grn = await service.addItem(req.params.id, req.tenantId, req.body);
    return created(res, grn, 'GRN item added');
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE ITEM ──────────────────────────────────────────────────────────────
const updateItem = async (req, res, next) => {
  try {
    const grn = await service.updateItem(req.params.id, req.tenantId, req.params.itemId, req.body);
    return success(res, grn, 'GRN item updated');
  } catch (err) {
    next(err);
  }
};

// ─── DELETE ITEM ──────────────────────────────────────────────────────────────
const deleteItem = async (req, res, next) => {
  try {
    const grn = await service.deleteItem(req.params.id, req.tenantId, req.params.itemId);
    return success(res, grn, 'GRN item deleted');
  } catch (err) {
    next(err);
  }
};

// ─── GENERATE LABELS ──────────────────────────────────────────────────────────
const generateLabels = async (req, res, next) => {
  try {
    const labels = await service.generateLabels(req.params.id, req.tenantId, req.params.itemId);
    return success(res, labels, 'Labels generated successfully');
  } catch (err) {
    next(err);
  }
};

// ─── REMOVE ───────────────────────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const result = await service.remove(req.params.id, req.tenantId);
    return success(res, result, 'GRN deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  addItem,
  updateItem,
  deleteItem,
  generateLabels,
  remove,
  postGRN,
  updateQuality,
  validate,
};
