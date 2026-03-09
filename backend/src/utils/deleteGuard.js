'use strict';
const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const LINKED_ERROR_MESSAGE = 'Cannot delete because record is linked to existing transactions.';

/**
 * Check if user is used in sales_orders, purchase_orders, invoices, or stock_ledger (created_by).
 * Throws AppError 400 if linked.
 */
const checkUserLinked = async (userId, tenantId) => {
  const checks = await Promise.all([
    query('SELECT 1 FROM sales_orders WHERE created_by = ? AND tenant_id = ? LIMIT 1', [userId, tenantId]),
    query('SELECT 1 FROM purchase_orders WHERE created_by = ? AND tenant_id = ? LIMIT 1', [userId, tenantId]),
    query('SELECT 1 FROM invoices WHERE created_by = ? AND tenant_id = ? LIMIT 1', [userId, tenantId]),
    query('SELECT 1 FROM stock_ledger WHERE created_by = ? AND tenant_id = ? LIMIT 1', [userId, tenantId]),
  ]);
  const linked = checks.some((rows) => rows.length > 0);
  if (linked) throw new AppError(LINKED_ERROR_MESSAGE, 400, 'LINKED_TO_TRANSACTIONS');
};

/**
 * Check if product is used in sales_order_items, purchase_order_items, invoice_items, or stock_ledger.
 * Throws AppError 400 if linked.
 */
const checkProductLinked = async (productId, tenantId) => {
  const checks = await Promise.all([
    query('SELECT 1 FROM sales_order_items WHERE product_id = ? AND tenant_id = ? LIMIT 1', [productId, tenantId]),
    query('SELECT 1 FROM purchase_order_items WHERE product_id = ? AND tenant_id = ? LIMIT 1', [productId, tenantId]),
    query('SELECT 1 FROM invoice_items WHERE product_id = ? AND tenant_id = ? LIMIT 1', [productId, tenantId]),
    query('SELECT 1 FROM stock_ledger WHERE product_id = ? AND tenant_id = ? LIMIT 1', [productId, tenantId]),
  ]);
  const linked = checks.some((rows) => rows.length > 0);
  if (linked) throw new AppError(LINKED_ERROR_MESSAGE, 400, 'LINKED_TO_TRANSACTIONS');
};

/**
 * Check if vendor is used in purchase_orders, grn, purchase_returns, debit_notes, vendor_payments.
 */
const checkVendorLinked = async (vendorId, tenantId) => {
  const checks = await Promise.all([
    query('SELECT 1 FROM purchase_orders WHERE vendor_id = ? AND tenant_id = ? LIMIT 1', [vendorId, tenantId]),
    query('SELECT 1 FROM grn WHERE vendor_id = ? AND tenant_id = ? LIMIT 1', [vendorId, tenantId]),
    query('SELECT 1 FROM purchase_returns WHERE vendor_id = ? AND tenant_id = ? LIMIT 1', [vendorId, tenantId]),
    query('SELECT 1 FROM debit_notes WHERE vendor_id = ? AND tenant_id = ? LIMIT 1', [vendorId, tenantId]),
    query('SELECT 1 FROM vendor_payments WHERE vendor_id = ? AND tenant_id = ? LIMIT 1', [vendorId, tenantId]),
  ]);
  const linked = checks.some((rows) => rows.length > 0);
  if (linked) throw new AppError(LINKED_ERROR_MESSAGE, 400, 'LINKED_TO_TRANSACTIONS');
};

/**
 * Check if customer is used in sales_orders, invoices, delivery_challans, sales_returns, credit_notes, customer_payments.
 */
const checkCustomerLinked = async (customerId, tenantId) => {
  const checks = await Promise.all([
    query('SELECT 1 FROM sales_orders WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [customerId, tenantId]),
    query('SELECT 1 FROM invoices WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [customerId, tenantId]),
    query('SELECT 1 FROM delivery_challans WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [customerId, tenantId]),
    query('SELECT 1 FROM sales_returns WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [customerId, tenantId]),
    query('SELECT 1 FROM credit_notes WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [customerId, tenantId]),
    query('SELECT 1 FROM customer_payments WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [customerId, tenantId]),
  ]);
  const linked = checks.some((rows) => rows.length > 0);
  if (linked) throw new AppError(LINKED_ERROR_MESSAGE, 400, 'LINKED_TO_TRANSACTIONS');
};

module.exports = {
  LINKED_ERROR_MESSAGE,
  checkUserLinked,
  checkProductLinked,
  checkVendorLinked,
  checkCustomerLinked,
};
