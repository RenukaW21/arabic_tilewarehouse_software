'use strict';
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');
const { writeAuditLog } = require('../../utils/auditLog');

const VALID_TYPES = [
  'inventory_adjustment',
  'production_entry',
  'purchase_approval',
  'pricing_change',
  'marketplace_update',
  'report_validation',
];

const getAll = async (tenantId, userId, userRole, queryParams) => {
  const isAdmin = ['super_admin', 'admin'].includes(userRole);
  const filters = { ...queryParams };
  if (!isAdmin) {
    filters.submitted_by = userId;
  }
  return repo.findAll(tenantId, filters);
};

const getById = async (id, tenantId, userId, userRole) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Approval request not found', 404, 'NOT_FOUND');

  const isAdmin = ['super_admin', 'admin'].includes(userRole);
  if (!isAdmin && row.submitted_by !== userId) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }
  return row;
};

const getStats = async (tenantId) => repo.getStats(tenantId);

const create = async (tenantId, userId, data) => {
  if (!VALID_TYPES.includes(data.request_type)) {
    throw new AppError(`Invalid request_type. Must be one of: ${VALID_TYPES.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  const id = await repo.create({
    tenant_id:      tenantId,
    request_type:   data.request_type,
    reference_id:   data.reference_id,
    reference_type: data.reference_type,
    title:          data.title,
    description:    data.description || null,
    payload:        data.payload || null,
    submitted_by:   userId,
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'CREATE',
    tableName: 'approval_requests',
    recordId: id,
    newValues: { request_type: data.request_type, title: data.title, status: 'pending' },
  });

  return repo.findById(id, tenantId);
};

const approve = async (id, tenantId, userId, reviewNotes) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Approval request not found', 404, 'NOT_FOUND');
  if (row.status !== 'pending') {
    throw new AppError(`Cannot approve a request with status "${row.status}"`, 400, 'INVALID_STATUS');
  }

  // Execute the underlying operation if it is a type with a direct execution hook
  if (row.request_type === 'inventory_adjustment') {
    const adjService = require('../stock-adjustments/service');
    await adjService.approve(row.reference_id, tenantId, userId);
  }
  // Other types: purchase_approval, production_entry etc. are approved in-system
  // and their modules check approval status independently. No cascading call needed
  // for types without a dedicated execution hook.

  await repo.setApproved(id, tenantId, userId, reviewNotes);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'APPROVE',
    tableName: 'approval_requests',
    recordId: id,
    newValues: { status: 'approved', review_notes: reviewNotes },
  });

  return repo.findById(id, tenantId);
};

const reject = async (id, tenantId, userId, reviewNotes) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Approval request not found', 404, 'NOT_FOUND');
  if (row.status !== 'pending') {
    throw new AppError(`Cannot reject a request with status "${row.status}"`, 400, 'INVALID_STATUS');
  }

  await repo.setRejected(id, tenantId, userId, reviewNotes);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'REJECT',
    tableName: 'approval_requests',
    recordId: id,
    newValues: { status: 'rejected', review_notes: reviewNotes },
  });

  return repo.findById(id, tenantId);
};

module.exports = { getAll, getById, getStats, create, approve, reject };
