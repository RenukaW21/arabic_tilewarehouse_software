'use strict';

const service = require('./service');
const { success, created, paginated } = require('../../utils/response');

const getOverview = async (req, res) => success(res, await service.getOverview(req.tenantId));

const getSettings = async (req, res) => success(res, await service.getSettings(req.tenantId));

const updateSettings = async (req, res) => {
  const settings = await service.upsertSettings(req.tenantId, req.user.id, req.body);
  return success(res, settings, 'Loyalty settings saved');
};

const getCustomers = async (req, res) => {
  const { rows, total } = await service.getCustomerSummaries(req.tenantId, req.query);
  return paginated(res, rows, { page: req.query.page || 1, limit: req.query.limit || 25, total });
};

const getTransactions = async (req, res) => {
  const { rows, total } = await service.getTransactions(req.tenantId, req.query);
  return paginated(res, rows, { page: req.query.page || 1, limit: req.query.limit || 25, total });
};

const createTransaction = async (req, res) => {
  const id = await service.addTransaction(req.tenantId, req.user.id, {
    ...req.body,
    status: req.body.status || 'posted',
  });
  return created(res, { id }, 'Loyalty transaction posted');
};

const getPromotions = async (req, res) => success(res, await service.getPromotions(req.tenantId));

const createPromotion = async (req, res) => {
  const promo = await service.createPromotion(req.tenantId, req.user.id, req.body);
  return created(res, promo, 'Promotion created');
};

const updatePromotion = async (req, res) => {
  const promo = await service.updatePromotion(req.tenantId, req.params.id, req.body);
  return success(res, promo, 'Promotion updated');
};

const getReferrals = async (req, res) => success(res, await service.getReferrals(req.tenantId));

const createReferral = async (req, res) => {
  const referral = await service.createReferral(req.tenantId, req.user.id, req.body);
  return created(res, referral, 'Referral created');
};

const completeReferral = async (req, res) => {
  const referral = await service.completeReferral(req.tenantId, req.user.id, req.params.id);
  return success(res, referral, 'Referral rewarded');
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
