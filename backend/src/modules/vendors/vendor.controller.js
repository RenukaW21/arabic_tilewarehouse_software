'use strict';

const { v4: uuidv4 } = require('uuid');
const vendorService = require('./vendor.service');
const { createVendorSchema, updateVendorSchema } = require('./vendor.validation');
const { success, created, error, paginated } = require('../../utils/response');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * Create vendor. tenant_id is set from JWT only (never from body).
 */
const createVendor = async (req, res, next) => {
  try {
    const { error: err, value } = createVendorSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.details[0].message },
      });
    }

    const tenantId = req.tenantId;
    const vendorData = {
      id: uuidv4(),
      tenant_id: tenantId,
      ...value,
    };

    await vendorService.createVendor(vendorData);
    const vendor = await vendorService.getVendorById(vendorData.id, tenantId);

    return created(res, vendor, 'Vendor created successfully');
  } catch (e) {
    next(e);
  }
};

/**
 * Get all vendors with pagination, search (name/code), and sorting.
 */
const getVendors = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { data, meta } = await vendorService.getAllVendors(tenantId, req.query);
    return paginated(res, data, meta, 'Vendors fetched');
  } catch (e) {
    next(e);
  }
};

/**
 * Get vendor by ID.
 */
const getVendorById = async (req, res, next) => {
  try {
    const vendor = await vendorService.getVendorById(req.params.id, req.tenantId);
    if (!vendor) {
      throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    }
    return success(res, vendor, 'Vendor fetched');
  } catch (e) {
    next(e);
  }
};

/**
 * Update vendor. Only allowed fields; tenant_id never from body.
 */
const updateVendor = async (req, res, next) => {
  try {
    const { error: err, value } = updateVendorSchema.validate(req.body);
    if (err) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.details[0].message },
      });
    }

    const { id } = req.params;
    const tenantId = req.tenantId;

    const updated = await vendorService.updateVendor(id, tenantId, value);
    if (!updated) {
      throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    }

    return success(res, updated, 'Vendor updated successfully');
  } catch (e) {
    next(e);
  }
};

/**
 * Soft delete: set is_active = 0.
 */
const deleteVendor = async (req, res, next) => {
  try {
    const deleted = await vendorService.deleteVendor(req.params.id, req.tenantId);
    if (!deleted) {
      throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    }
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
};

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
};
