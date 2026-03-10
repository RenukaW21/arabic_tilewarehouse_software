'use strict';
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');
const { checkProductLinked } = require('../../utils/deleteGuard');

const getAll = (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const product = await repo.findById(id, tenantId);
  if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

  // Attach related entities for detailed view
  const rackService = require('../racks/rack.service');
  const [vendors, customers, rackAssignments] = await Promise.all([
    repo.getProductVendors(id, tenantId),
    repo.getProductCustomers(id, tenantId),
    rackService.getProductRacks(tenantId, id)
  ]);
  product.vendors = vendors;
  product.customers = customers;
  product.rackAssignments = rackAssignments;

  return product;
};

const create = async (tenantId, data) => {
  const existing = await repo.findByCode(data.code, tenantId);
  if (existing) throw new AppError(`Product code '${data.code}' already exists`, 409, 'DUPLICATE_CODE');
  return repo.create({ ...data, tenantId });
};

const update = async (id, tenantId, data) => {
  await getById(id, tenantId); // ensures product exists
  // Only check code conflict if a new code is actually being supplied
  if (data.code) {
    const codeConflict = await repo.findByCode(data.code, tenantId, id);
    if (codeConflict) throw new AppError(`Product code '${data.code}' already in use`, 409, 'DUPLICATE_CODE');
  }
  // Rack upsert / delete is handled inside repo.update() in a transaction
  return repo.update(id, tenantId, data);
};

const remove = async (id, tenantId) => {
  await getById(id, tenantId);
  await checkProductLinked(id, tenantId);
  // Uses repo.softDelete() which runs inside a transaction:
  // marks is_active=FALSE AND clears product_racks in one atomic operation
  await repo.softDelete(id, tenantId);
};

module.exports = { getAll, getById, create, update, remove };
