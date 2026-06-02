'use strict';
const service = require('./service');
const { success, paginated } = require('../../utils/response');

const health = async (req, res, next) => {
  try {
    const data = await service.getHealth(req.tenantId);
    return success(res, data, 'Sync health fetched');
  } catch (err) { next(err); }
};

const logs = async (req, res, next) => {
  try {
    const { rows, total } = await service.getLogs(req.tenantId, req.query);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    return paginated(res, rows, { page, limit, total }, 'Sync logs fetched');
  } catch (err) { next(err); }
};

module.exports = { health, logs };
