'use strict';
/**
 * CSV Customer Import Service
 */
const service = require('./customer.service');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../../middlewares/error.middleware');
const { normalizeEmail } = require('../../utils/normalizeEmail');

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new AppError('CSV must have a header row and at least one data row', 400, 'INVALID_CSV');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));

  return lines.slice(1).map((line, idx) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim().replace(/^"(.*)"$/, '$1');
    });
    row.__rowNumber = idx + 2;
    return row;
  });
}

const importFromCsv = async (tenantId, csvText) => {
  const rows = parseCsv(csvText);
  const results = { imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const rowNum = row.__rowNumber;
    try {
      if (!row.name) {
        results.errors.push({ row: rowNum, code: row.code || '(unknown)', error: 'Missing required field: name' });
        results.skipped++;
        continue;
      }

      const creditLimit = parseFloat(row.credit_limit);
      const paymentTermsDays = parseInt(row.payment_terms_days);
      const isActive = !row.is_active || ['true', '1', 'yes', 'active'].includes(row.is_active.toLowerCase());

      await service.createCustomer({
        id: uuidv4(),
        tenant_id: tenantId,
        name: row.name,
        code: row.code || null,
        contact_person: row.contact_person || null,
        phone: row.phone || null,
        email: normalizeEmail(row.email),
        billing_address: row.billing_address || null,
        shipping_address: row.shipping_address || null,
        gstin: row.gstin || null,
        state_code: row.state_code || null,
        credit_limit: isNaN(creditLimit) ? null : creditLimit,
        payment_terms_days: isNaN(paymentTermsDays) ? null : paymentTermsDays,
        is_active: isActive,
      });

      results.imported++;
    } catch (err) {
      results.errors.push({ row: rowNum, code: row.code || '(unknown)', error: err.message });
      results.skipped++;
    }
  }

  return results;
};

module.exports = { importFromCsv };
