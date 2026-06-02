'use strict';
const service = require('./service');
const { success, paginated } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Marketplace orders fetched');
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId);
    return success(res, data, 'Marketplace order fetched');
  } catch (err) { next(err); }
};

const stats = async (req, res, next) => {
  try {
    const data = await service.getStats(req.tenantId);
    return success(res, data, 'Marketplace order stats fetched');
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status, tracking_number, shipped_at, wms_sales_order_id } = req.body;
    const data = await service.updateStatus(
      req.params.id, req.tenantId, req.user.id, status,
      { tracking_number, shipped_at, wms_sales_order_id }
    );
    return success(res, data, 'Marketplace order updated');
  } catch (err) { next(err); }
};

module.exports = { list, getById, stats, updateStatus };
