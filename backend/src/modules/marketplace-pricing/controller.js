'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    return paginated(res, rows, { page, limit, total }, 'Marketplace pricing fetched');
  } catch (err) { next(err); }
};

const upsert = async (req, res, next) => {
  try {
    const { product_id, platform, price } = req.body;
    const data = await service.upsert(req.tenantId, req.user.id, product_id, platform, price);
    return created(res, data, 'Marketplace price saved');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.tenantId, req.user.id, req.params.productId, req.params.platform);
    return res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { list, upsert, remove };
