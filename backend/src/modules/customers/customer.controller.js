'use strict';

const { v4: uuidv4 } = require('uuid');
const customerService = require('./customer.service');
const { createCustomerSchema, updateCustomerSchema } = require('./customer.validation');
const { success, created, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

const createCustomer = async (req, res, next) => {
  try {
    const { error: err, value } = createCustomerSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.details[0].message,
          details: err.details.map((d) => ({ path: d.path, message: d.message })),
        },
      });
    }
    const tenantId = req.tenantId;
    const payload = { id: uuidv4(), tenant_id: tenantId, ...value };
    await customerService.createCustomer(payload);
    const customer = await customerService.getCustomerById(payload.id, tenantId);
    return created(res, customer, 'Customer created successfully');
  } catch (e) {
    next(e);
  }
};

const getCustomers = async (req, res, next) => {
  try {
    console.log("Tenant ID from request:", req.tenantId);

    const { data, meta } = await customerService.getAllCustomers(req.tenantId, req.query);
    return paginated(res, data, meta, 'Customers fetched');
  } catch (e) {
    next(e);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id, req.tenantId);
    if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
    return success(res, customer, 'Customer fetched');
  } catch (e) {
    next(e);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const { error: err, value } = updateCustomerSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.details[0].message,
          details: err.details.map((d) => ({ path: d.path, message: d.message })),
        },
      });
    }
    const updated = await customerService.updateCustomer(req.params.id, req.tenantId, value);
    if (!updated) throw new AppError('Customer not found', 404, 'NOT_FOUND');
    return success(res, updated, 'Customer updated successfully');
  } catch (e) {
    next(e);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const deleted = await customerService.deleteCustomer(req.params.id, req.tenantId);
    if (!deleted) throw new AppError('Customer not found', 404, 'NOT_FOUND');
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
