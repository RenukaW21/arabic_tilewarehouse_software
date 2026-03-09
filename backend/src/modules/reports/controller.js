'use strict';
const service = require('./service');
const { success } = require('../../utils/response');

const dashboard = async (req, res) => {
  const data = await service.getDashboard(req.tenantId);
  return success(res, data, 'Dashboard data');
};
const gstReport = async (req, res) => {
  const data = await service.getGSTReport(req.tenantId, req.query);
  return success(res, data, 'GST report');
};
const revenueReport = async (req, res) => {
  const data = await service.getRevenueReport(req.tenantId, req.query);
  return success(res, data, 'Revenue report');
};
const agingReport = async (req, res) => {
  const data = await service.getAgingReport(req.tenantId);
  return success(res, data, 'Aging report');
};
const stockValuation = async (req, res) => {
  const data = await service.getStockValuation(req.tenantId, req.query.warehouseId);
  return success(res, data, 'Stock valuation');
};
module.exports = { dashboard, gstReport, revenueReport, agingReport, stockValuation };
