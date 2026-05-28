'use strict';
const service = require('./service');
const { success } = require('../../utils/response');
const { applyWarehouseScope } = require('../../utils/warehouseScope');

const warehouseIdFromReq = (req) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  return q.warehouse_id || q.warehouseId || null;
};

const dashboard = async (req, res) => {
  const warehouseId = warehouseIdFromReq(req);
  const data = await service.getDashboard(req.tenantId, { warehouseId });
  return success(res, data, 'Dashboard data');
};
const gstReport = async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const warehouseId = q.warehouse_id || q.warehouseId || null;
  const data = await service.getGSTReport(req.tenantId, { ...q, warehouseId });
  return success(res, data, 'GST report');
};
const revenueReport = async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const warehouseId = q.warehouse_id || q.warehouseId || null;
  const data = await service.getRevenueReport(req.tenantId, { ...q, warehouseId });
  return success(res, data, 'Revenue report');
};
const agingReport = async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const warehouseId = q.warehouse_id || q.warehouseId || null;
  const data = await service.getAgingReport(req.tenantId, warehouseId);
  return success(res, data, 'Aging report');
};
const stockValuation = async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const warehouseId = q.warehouse_id || q.warehouseId || null;
  const data = await service.getStockValuation(req.tenantId, warehouseId);
  return success(res, data, 'Stock valuation');
};
const inventoryConsumption = async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const filters = {
    from:            q.from            || null,
    to:              q.to              || null,
    productId:       q.productId       || null,
    warehouseId:     q.warehouse_id    || q.warehouseId || null,
    transactionType: q.transactionType || null,
  };
  const data = await service.getInventoryConsumptionReport(req.tenantId, filters);
  return success(res, data, 'Inventory consumption report');
};

const inventoryConsumptionExport = async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const filters = {
    from:            q.from            || null,
    to:              q.to              || null,
    productId:       q.productId       || null,
    warehouseId:     q.warehouse_id    || q.warehouseId || null,
    transactionType: q.transactionType || null,
  };
  const wb = await service.exportInventoryConsumptionExcel(req.tenantId, filters);
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-consumption-${date}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

module.exports = { dashboard, gstReport, revenueReport, agingReport, stockValuation, inventoryConsumption, inventoryConsumptionExport };
