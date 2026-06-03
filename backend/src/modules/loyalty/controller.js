'use strict';

const service = require('./service');
const { success, created, paginated } = require('../../utils/response');

const getOverview = async (req, res, next) => {
  try {
    return success(res, await service.getOverview(req.tenantId));
  } catch (err) { next(err); }
};

const getSettings = async (req, res, next) => {
  try {
    return success(res, await service.getSettings(req.tenantId));
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await service.upsertSettings(req.tenantId, req.user.id, req.body);
    return success(res, settings, 'Loyalty settings saved');
  } catch (err) { next(err); }
};

const getCustomers = async (req, res, next) => {
  try {
    const { rows, total } = await service.getCustomerSummaries(req.tenantId, req.query);
    return paginated(res, rows, { page: req.query.page || 1, limit: req.query.limit || 25, total });
  } catch (err) { next(err); }
};

const getTransactions = async (req, res, next) => {
  try {
    const { rows, total } = await service.getTransactions(req.tenantId, req.query);
    return paginated(res, rows, { page: req.query.page || 1, limit: req.query.limit || 25, total });
  } catch (err) { next(err); }
};

const createTransaction = async (req, res, next) => {
  try {
    const id = await service.addTransaction(req.tenantId, req.user.id, {
      ...req.body,
      status: req.body.status || 'posted',
    });
    return created(res, { id }, 'Loyalty transaction posted');
  } catch (err) { next(err); }
};

const getPromotions = async (req, res, next) => {
  try {
    return success(res, await service.getPromotions(req.tenantId));
  } catch (err) { next(err); }
};

const createPromotion = async (req, res, next) => {
  try {
    const promo = await service.createPromotion(req.tenantId, req.user.id, req.body);
    return created(res, promo, 'Promotion created');
  } catch (err) { next(err); }
};

const updatePromotion = async (req, res, next) => {
  try {
    const promo = await service.updatePromotion(req.tenantId, req.params.id, req.body);
    return success(res, promo, 'Promotion updated');
  } catch (err) { next(err); }
};

const getReferrals = async (req, res, next) => {
  try {
    return success(res, await service.getReferrals(req.tenantId));
  } catch (err) { next(err); }
};

const createReferral = async (req, res, next) => {
  try {
    const referral = await service.createReferral(req.tenantId, req.user.id, req.body);
    return created(res, referral, 'Referral created');
  } catch (err) { next(err); }
};

const completeReferral = async (req, res, next) => {
  try {
    const referral = await service.completeReferral(req.tenantId, req.user.id, req.params.id);
    return success(res, referral, 'Referral rewarded');
  } catch (err) { next(err); }
};

module.exports = {
  getOverview,
  getSettings,
  updateSettings,
  getCustomers,
  getTransactions,
  createTransaction,
  getPromotions,
  createPromotion,
  updatePromotion,
  getReferrals,
  createReferral,
  completeReferral,
};
