'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { writeAuditLog, extractRequestMeta } = require('../../utils/auditLog');

const getAll = async (req, res) => {
  const { rows, total } = await service.getAll(req.tenantId, req.query);
  return paginated(res, rows, { page: req.query.page || 1, limit: req.query.limit || 25, total });
};
const getById = async (req, res) => {
  const inv = await service.getById(req.params.id, req.tenantId);
  return success(res, inv);
};
const createFromSO = async (req, res) => {
  const inv = await service.createFromSalesOrder(req.tenantId, req.user.id, req.body.salesOrderId);
  const meta = extractRequestMeta(req);
  await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'CREATE', tableName: 'invoices', recordId: inv.id, newValues: { salesOrderId: req.body.salesOrderId }, ...meta });
  return created(res, inv, 'Invoice generated');
};
const issueInvoice = async (req, res) => {
  const inv = await service.issueInvoice(req.params.id, req.tenantId);
  const meta = extractRequestMeta(req);
  await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'ISSUE_INVOICE', tableName: 'invoices', recordId: req.params.id, ...meta });
  return success(res, inv, 'Invoice issued');
};
const updatePaymentStatus = async (req, res) => {
  const inv = await service.updatePaymentStatus(req.params.id, req.tenantId, req.body.payment_status);
  return success(res, inv, 'Payment status updated');
};
const update = async (req, res, next) => {
  try {
    const inv = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, inv, 'Invoice updated');
  } catch (err) {
    next(err);
  }
};
const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id, req.tenantId);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
module.exports = { getAll, getById, createFromSO, issueInvoice, updatePaymentStatus, update, remove };
