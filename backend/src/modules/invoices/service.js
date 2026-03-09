'use strict';
const { query, beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { parsePagination } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ['invoice_date', 'created_at']);
  const conditions = ['i.tenant_id = ?'];
  const params = [tenantId];
  if (queryParams.status)        { conditions.push('i.status = ?'); params.push(queryParams.status); }
  if (queryParams.paymentStatus) { conditions.push('i.payment_status = ?'); params.push(queryParams.paymentStatus); }
  if (queryParams.customerId)    { conditions.push('i.customer_id = ?'); params.push(queryParams.customerId); }
  if (search) { conditions.push('(i.invoice_number LIKE ? OR c.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const where = conditions.join(' AND ');
  const [rows, count] = await Promise.all([
    query(`SELECT i.*, c.name AS customer_name FROM invoices i JOIN customers c ON i.customer_id = c.id
           WHERE ${where} ORDER BY i.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`,
      params),
    query(`SELECT COUNT(*) AS total FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE ${where}`, params),
  ]);
  return { rows, total: count[0].total };
};

const getById = async (id, tenantId) => {
  const rows = await query(
    `SELECT i.*, c.name AS customer_name, c.gstin AS customer_gstin,
            c.billing_address, c.shipping_address,
            gc.gstin AS company_gstin, gc.legal_name, gc.state_code AS company_state_code
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     LEFT JOIN gst_configurations gc ON gc.tenant_id = i.tenant_id
     WHERE i.id = ? AND i.tenant_id = ?`,
    [id, tenantId]
  );
  if (!rows.length) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  const items = await query(
    `SELECT ii.*, p.name AS product_name, p.code AS product_code, p.hsn_code
     FROM invoice_items ii JOIN products p ON ii.product_id = p.id
     WHERE ii.invoice_id = ? AND ii.tenant_id = ?`,
    [id, tenantId]
  );
  return { ...rows[0], items };
};

/**
 * Generate a GST invoice from a confirmed Sales Order.
 * Calculates CGST/SGST (intrastate) or IGST (interstate) based on state codes.
 */
const createFromSalesOrder = async (tenantId, userId, salesOrderId) => {
  const soRows = await query(
    `SELECT so.*, c.gstin AS customer_gstin, c.state_code AS customer_state,
            c.billing_address, c.shipping_address, c.name AS customer_name
     FROM sales_orders so JOIN customers c ON so.customer_id = c.id
     WHERE so.id = ? AND so.tenant_id = ?`,
    [salesOrderId, tenantId]
  );
  if (!soRows.length) throw new AppError('Sales order not found', 404, 'NOT_FOUND');
  const so = soRows[0];
  if (!['confirmed','pick_ready','dispatched'].includes(so.status)) {
    throw new AppError('Invoice can only be created for confirmed/dispatched orders', 400, 'INVALID_STATUS');
  }

  const soItems = await query(
    `SELECT soi.*, p.hsn_code, p.gst_rate FROM sales_order_items soi
     JOIN products p ON soi.product_id = p.id
     WHERE soi.sales_order_id = ? AND soi.tenant_id = ?`,
    [salesOrderId, tenantId]
  );

  const gstConfig = await query(`SELECT * FROM gst_configurations WHERE tenant_id = ?`, [tenantId]);
  const companyStateCode = gstConfig[0]?.state_code || '27';
  const customerStateCode = so.customer_gstin?.substring(0, 2) || companyStateCode;
  const isInterstate = companyStateCode !== customerStateCode;

  const invoiceNumber = await generateDocNumber(tenantId, 'INV', gstConfig[0]?.invoice_prefix || 'INV');
  const id = uuidv4();

  let totalCgst = 0, totalSgst = 0, totalIgst = 0, subTotal = 0, grandTotal = 0;
  const lineItems = soItems.map((item) => {
    const taxableAmt = (item.ordered_boxes * item.unit_price) * (1 - (item.discount_pct || 0) / 100);
    const gstRate = parseFloat(item.gst_rate || 18);
    const cgstPct = isInterstate ? 0 : gstRate / 2;
    const sgstPct = isInterstate ? 0 : gstRate / 2;
    const igstPct = isInterstate ? gstRate : 0;
    const cgstAmt = taxableAmt * cgstPct / 100;
    const sgstAmt = taxableAmt * sgstPct / 100;
    const igstAmt = taxableAmt * igstPct / 100;
    const lineTotal = taxableAmt + cgstAmt + sgstAmt + igstAmt;

    totalCgst += cgstAmt; totalSgst += sgstAmt; totalIgst += igstAmt;
    subTotal += taxableAmt; grandTotal += lineTotal;

    return { ...item, taxableAmt, cgstPct, sgstPct, igstPct, cgstAmt, sgstAmt, igstAmt, lineTotal };
  });

  const trx = await beginTransaction();
  try {
    await trx.query(
      `INSERT INTO invoices
         (id, tenant_id, invoice_number, sales_order_id, customer_id, invoice_date, due_date,
          billing_address, shipping_address, sub_total, discount_amount, cgst_amount, sgst_amount,
          igst_amount, grand_total, payment_status, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, ?, 0, ?, ?, ?, ?, 'pending', 'draft', ?, NOW(), NOW())`,
      [id, tenantId, invoiceNumber, salesOrderId, so.customer_id,
       so.billing_address || null, so.shipping_address || null,
       subTotal, totalCgst, totalSgst, totalIgst, grandTotal, userId]
    );

    for (const item of lineItems) {
      await trx.query(
        `INSERT INTO invoice_items
           (id, tenant_id, invoice_id, product_id, shade_id, hsn_code, quantity_boxes,
            unit_price, discount_pct, taxable_amount, gst_rate, cgst_pct, sgst_pct, igst_pct,
            cgst_amount, sgst_amount, igst_amount, line_total)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, id, item.product_id, item.shade_id || null, item.hsn_code || null,
         item.ordered_boxes, item.unit_price, item.discount_pct || 0,
         item.taxableAmt, item.gst_rate || 18, item.cgstPct, item.sgstPct, item.igstPct,
         item.cgstAmt, item.sgstAmt, item.igstAmt, item.lineTotal]
      );
    }

    // Link invoice to sales order
    await trx.query(`UPDATE sales_orders SET invoice_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`, [id, salesOrderId, tenantId]);

    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const issueInvoice = async (id, tenantId) => {
  const inv = await getById(id, tenantId);
  if (inv.status !== 'draft') throw new AppError('Only draft invoices can be issued', 400, 'INVALID_STATUS');
  await query(`UPDATE invoices SET status = 'issued', updated_at = NOW() WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return getById(id, tenantId);
};

const updatePaymentStatus = async (id, tenantId, paymentStatus) => {
  const inv = await getById(id, tenantId);
  const allowed = ['pending', 'partial', 'paid'];
  if (!allowed.includes(paymentStatus)) {
    throw new AppError(`payment_status must be one of: ${allowed.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  await query(
    `UPDATE invoices SET payment_status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    [paymentStatus, id, tenantId]
  );
  return getById(id, tenantId);
};

const update = async (id, tenantId, data) => {
  const inv = await getById(id, tenantId);
  if (inv.status !== 'draft') throw new AppError('Only draft invoices can be updated', 400, 'INVALID_STATUS');
  const allowed = ['due_date', 'billing_address', 'shipping_address'];
  const setClause = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClause.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (setClause.length === 0) return getById(id, tenantId);
  values.push(id, tenantId);
  await query(
    `UPDATE invoices SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    values
  );
  return getById(id, tenantId);
};

const remove = async (id, tenantId) => {
  const inv = await getById(id, tenantId);
  if (inv.status !== 'draft') throw new AppError('Only draft invoices can be deleted', 400, 'INVALID_STATUS');
  await query('UPDATE sales_orders SET invoice_id = NULL, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?', [id, tenantId]);
  await query('DELETE FROM invoice_items WHERE invoice_id = ? AND tenant_id = ?', [id, tenantId]);
  await query('DELETE FROM invoices WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = { getAll, getById, createFromSalesOrder, issueInvoice, updatePaymentStatus, update, remove };
