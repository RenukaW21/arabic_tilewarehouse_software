const service = require('./service');
const { success, created, error, paginated } = require('../../utils/response');
const { parsePagination } = require('../../utils/pagination');

exports.getAll = async (req, res) => {
  try {
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query, ['payment_date', 'created_at']);
    const { rows, total } = await service.getAll(req.tenantId, { page, limit, offset, sortBy, sortOrder });
    return paginated(res, rows, { page, limit, total }, 'Payments fetched');
  } catch (err) {
    return error(res, err);
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await service.getById(req.tenantId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: { message: 'Not found' } });
    return success(res, row);
  } catch (err) {
    return error(res, err);
  }
};

exports.create = async (req, res) => {
  try {
    const row = await service.create(req.tenantId, req.body, req.user?.id);
    return created(res, row);
  } catch (err) {
    return error(res, err);
  }
};

exports.update = async (req, res) => {
  try {
    const row = await service.update(req.tenantId, req.params.id, req.body);
    if (!row) return res.status(404).json({ success: false, error: { message: 'Not found' } });
    return success(res, row);
  } catch (err) {
    return error(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const result = await service.remove(req.tenantId, req.params.id);
    if (!result) return res.status(404).json({ success: false, error: { message: 'Not found' } });
    return res.status(204).send();
  } catch (err) {
    return error(res, err);
  }
};
