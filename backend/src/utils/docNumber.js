'use strict';
const { beginTransaction } = require('../config/db');

/**
 * Generate atomic sequential document numbers per tenant per doc type.
 * Uses document_counters table with row-level locking (FOR UPDATE).
 *
 * Examples: PO-2024-0001, GRN-2024-0042, INV-2024-0100
 *
 * @param {string} tenantId
 * @param {string} docType  - 'PO' | 'GRN' | 'SO' | 'INV' | 'DC' | 'CN' | 'DN' | 'PR' | 'SR' | 'TR' | 'SC'
 * @param {string} prefix   - e.g. 'PO', 'GRN', 'INV'
 * @returns {Promise<string>} formatted document number
 */
const generateDocNumber = async (tenantId, docType, prefix) => {
  const trx = await beginTransaction();
  try {
    const year = new Date().getFullYear();

    // Lock the row for atomic increment
    const rows = await trx.query(
      `SELECT id, last_number FROM document_counters
       WHERE tenant_id = ? AND doc_type = ? AND year = ?
       FOR UPDATE`,
      [tenantId, docType, year]
    );

    let lastNumber;
    if (rows.length === 0) {
      await trx.query(
        `INSERT INTO document_counters (id, tenant_id, doc_type, prefix, year, last_number)
         VALUES (UUID(), ?, ?, ?, ?, 1)`,
        [tenantId, docType, prefix, year]
      );
      lastNumber = 1;
    } else {
      lastNumber = rows[0].last_number + 1;
      await trx.query(
        `UPDATE document_counters SET last_number = ? WHERE id = ?`,
        [lastNumber, rows[0].id]
      );
    }

    await trx.commit();
    const padded = String(lastNumber).padStart(4, '0');
    return `${prefix}-${year}-${padded}`;
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

module.exports = { generateDocNumber };
