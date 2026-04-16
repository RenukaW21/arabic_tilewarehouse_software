const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const buildTileDetails = async (tenantId, invoiceId) => {
  if (!invoiceId) return null;
  const rows = await query(`
    SELECT p.name, p.code, p.size_label, ii.quantity_boxes, ii.unit_price 
    FROM invoice_items ii 
    JOIN products p ON ii.product_id = p.id 
    WHERE ii.invoice_id = ? AND ii.tenant_id = ?
  `, [invoiceId, tenantId]);
  
  if (!rows || rows.length === 0) return 'No items found';
  
  return rows.map(r => `${r.name} (${r.size_label}) - ${r.quantity_boxes} boxes`).join(', ');
};

const updateInvoicePaymentStatus = async (tenantId, invoiceId) => {
  if (!invoiceId) return;
  
  const invResult = await query(`SELECT grand_total FROM invoices WHERE id = ? AND tenant_id = ?`, [invoiceId, tenantId]);
  if (!invResult.length) return;
  
  const grandTotal = invResult[0].grand_total || 0;
  
  const paymentsResult = await query(`
    SELECT SUM(amount) as total_received 
    FROM customer_payments 
    WHERE invoice_id = ? AND tenant_id = ? AND status != 'cancelled'
  `, [invoiceId, tenantId]);
  
  const totalReceived = paymentsResult[0].total_received || 0;
  
  let newStatus = 'pending';
  if (totalReceived >= grandTotal && grandTotal > 0) {
    newStatus = 'paid';
  } else if (totalReceived > 0) {
    newStatus = 'partial';
  }
  
  await query(`UPDATE invoices SET payment_status = ? WHERE id = ? AND tenant_id = ?`, [newStatus, invoiceId, tenantId]);
};

exports.getAll = async (tenantId, { page = 1, limit = 25, offset = 0, sortBy = 'payment_date', sortOrder = 'DESC' }) => {
  const allowedCols = ['payment_date', 'amount', 'created_at', 'payment_number'];
  const safeSortBy = allowedCols.includes(sortBy) ? sortBy : 'payment_date';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const rows = await query(`
  SELECT cp.*, 
    c.name as customer_name,
    inv.invoice_number
  FROM customer_payments cp
  LEFT JOIN customers c ON cp.customer_id = c.id
  LEFT JOIN invoices inv ON cp.invoice_id = inv.id
  WHERE cp.tenant_id = ? 
  ORDER BY cp.${safeSortBy} ${safeSortOrder} 
  LIMIT ${Number(limit)} OFFSET ${Number(offset)}
`, [tenantId]);

  for(let row of rows) {
    if (row.invoice_id) {
       row.tile_details = await buildTileDetails(tenantId, row.invoice_id);
    } else {
       row.tile_details = '—';
    }
  }

  // const [countResult] = await query(`SELECT COUNT(*) as total FROM customer_payments WHERE tenant_id = ?`, [tenantId]);
  const countResult = await query(`
  SELECT COUNT(*) as total 
  FROM customer_payments 
  WHERE tenant_id = ?
`, [tenantId]);
  
  return { rows, total: countResult[0].total };
};

exports.getById = async (tenantId, id) => {
  const [row] = await query(`SELECT * FROM customer_payments WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  if (row && row.invoice_id) {
     row.tile_details = await buildTileDetails(tenantId, row.invoice_id);
  }
  return row;
};

exports.create = async (tenantId, data, createdBy) => {
  const id = uuidv4();
  const payment_number = data.payment_number || `REC-${Date.now()}`;
  
  await query(`
    INSERT INTO customer_payments (
      id, tenant_id, payment_number, customer_id, invoice_id, credit_note_id, 
      payment_date, amount, payment_mode, reference_number, bank_name, status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, tenantId, payment_number, data.customer_id, data.invoice_id || null, data.credit_note_id || null,
    data.payment_date || null, data.amount || 0, data.payment_mode || 'cash', data.reference_number || null,
    data.bank_name || null, data.status || 'cleared', data.notes || null, createdBy
  ]);
  
  if (data.invoice_id) {
    await updateInvoicePaymentStatus(tenantId, data.invoice_id);
  }
  
  return this.getById(tenantId, id);
};

exports.update = async (tenantId, id, data) => {
  const [existing] = await query(`SELECT * FROM customer_payments WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  if (!existing) return null;
  
  await query(`
    UPDATE customer_payments SET
      payment_number = ?, customer_id = ?, invoice_id = ?, credit_note_id = ?, 
      payment_date = ?, amount = ?, payment_mode = ?, reference_number = ?, bank_name = ?, status = ?, notes = ?
    WHERE id = ? AND tenant_id = ?
  `, [
    data.payment_number, data.customer_id, data.invoice_id || null, data.credit_note_id || null,
    data.payment_date || null, data.amount || 0, data.payment_mode || 'cash', data.reference_number || null,
    data.bank_name || null, data.status || 'cleared', data.notes || null,
    id, tenantId
  ]);
  
  if (existing.invoice_id) {
    await updateInvoicePaymentStatus(tenantId, existing.invoice_id);
  }
  if (data.invoice_id && data.invoice_id !== existing.invoice_id) {
    await updateInvoicePaymentStatus(tenantId, data.invoice_id);
  }
  
  return this.getById(tenantId, id);
};

exports.remove = async (tenantId, id) => {
  const [existing] = await query(`SELECT invoice_id FROM customer_payments WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  if (!existing) return false;
  
  await query(`DELETE FROM customer_payments WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  
  if (existing.invoice_id) {
     await updateInvoicePaymentStatus(tenantId, existing.invoice_id);
  }
  
  return true;
};
