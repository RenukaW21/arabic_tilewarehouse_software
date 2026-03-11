'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// FIXED validation.js
// Changes:
//   BUG-1: quality_status enum aligned with DB: 'pass','fail','pending'
//          (was: 'pending','approved','rejected' — both Joi AND updateQuality)
// ─────────────────────────────────────────────────────────────────────────────
const Joi = require('joi');

// Shared quality status rule — single source of truth
// DB enum: enum('pass','fail','pending')
const qualityStatusField = Joi.string()
  .valid('pending', 'pass', 'fail')   // ← FIX: was 'pending','approved','rejected'
  .default('pending')
  .optional();

// ─── CREATE GRN ───────────────────────────────────────────────────────────────
const createGRNSchema = Joi.object({
  purchaseOrderId: Joi.string().uuid().allow(null, '').optional(),
  vendorId: Joi.string().uuid().required(),
  warehouseId: Joi.string().uuid().required(),
  receiptDate: Joi.date().iso().optional(),
  invoiceNumber: Joi.string().max(100).allow(null, '').optional(),
  invoiceDate: Joi.date().iso().allow(null).optional(),
  vehicleNumber: Joi.string().max(50).allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
  items: Joi.array()
    .min(1)
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        shade_id: Joi.string().uuid().allow(null, '').optional(),
        batch_id: Joi.string().uuid().allow(null, '').optional(),
        batch_number: Joi.string().max(100).allow(null, '').optional(),
        rack_id: Joi.string().uuid().allow(null, '').optional(),
        received_boxes: Joi.number().min(0).required(),
        received_pieces: Joi.number().min(0).default(0).optional(),
        damaged_boxes: Joi.number().min(0).default(0).optional(),
        unit_price: Joi.number().min(0).default(0).optional(),
        quality_status: qualityStatusField,            // ← FIX
        quality_notes: Joi.string().allow(null, '').optional(),
      })
    )
    .required(),
});

// ─── UPDATE GRN HEADER ────────────────────────────────────────────────────────
const updateGRNSchema = Joi.object({
  receipt_date: Joi.date().iso().optional(),
  invoice_number: Joi.string().max(100).allow(null, '').optional(),
  invoice_date: Joi.date().iso().allow(null).optional(),
  vehicle_number: Joi.string().max(50).allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
  vendor_id: Joi.string().uuid().optional(),
  warehouse_id: Joi.string().uuid().optional(),
}).min(1);

// ─── ADD GRN ITEM ─────────────────────────────────────────────────────────────
const addGRNItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  shade_id: Joi.string().uuid().allow(null, '').optional(),
  batch_id: Joi.string().uuid().allow(null, '').optional(),
  batch_number: Joi.string().max(100).allow(null, '').optional(),
  rack_id: Joi.string().uuid().allow(null, '').optional(),
  received_boxes: Joi.number().min(0).required(),
  received_pieces: Joi.number().min(0).default(0).optional(),
  damaged_boxes: Joi.number().min(0).default(0).optional(),
  unit_price: Joi.number().min(0).default(0).optional(),
  quality_status: qualityStatusField,                  // ← FIX
  quality_notes: Joi.string().allow(null, '').optional(),
});

// ─── UPDATE GRN ITEM ──────────────────────────────────────────────────────────
const updateGRNItemSchema = Joi.object({
  product_id: Joi.string().uuid().optional(),
  shade_id: Joi.string().uuid().allow(null, '').optional(),
  batch_id: Joi.string().uuid().allow(null, '').optional(),
  batch_number: Joi.string().max(100).allow(null, '').optional(),
  rack_id: Joi.string().uuid().allow(null, '').optional(),
  received_boxes: Joi.number().min(0).optional(),
  received_pieces: Joi.number().min(0).default(0).optional(),
  damaged_boxes: Joi.number().min(0).default(0).optional(),
  unit_price: Joi.number().min(0).default(0).optional(),
  quality_status: qualityStatusField,
  quality_notes: Joi.string().allow(null, '').optional(),
});

// ─── UPDATE QUALITY ───────────────────────────────────────────────────────────
const updateQualitySchema = Joi.object({
  qualityStatus: Joi.string().valid('pending', 'pass', 'fail').required(), // ← FIX
  qualityNotes: Joi.string().allow(null, '').optional(),
});

// ─── LIST QUERY ───────────────────────────────────────────────────────────────
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().allow('').optional(),
  sortBy: Joi.string().valid('receipt_date', 'created_at', 'grn_number').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').optional(),
  status: Joi.string().valid('draft', 'verified', 'posted').optional(),
  vendorId: Joi.string().uuid().optional(),
  warehouseId: Joi.string().uuid().optional(),
  purchase_order_id: Joi.string().uuid().optional(),
});

module.exports = {
  createGRNSchema,
  updateGRNSchema,
  addGRNItemSchema,
  updateGRNItemSchema,
  updateQualitySchema,
  listQuerySchema,
};