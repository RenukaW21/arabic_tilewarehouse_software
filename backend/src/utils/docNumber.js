'use strict';
const { beginTransaction } = require('../config/db');

/**
 * Generate atomic sequential document numbers per tenant per doc type.
 * Uses document_counters table with row-level locking (FOR UPDATE).
 *
 * Pass `externalTrx` to participate in an outer transaction — the counter
 * increment will commit/rollback together with the caller's transaction.
 *
 * @param {string} tenantId
 * @param {string} docType  - 'PO' | 'GRN' | 'SO' | 'INV' | 'DC' | 'CN' | 'DN' | 'PR' | 'SR' | 'TR' | 'SC' | 'PROD' | 'BATCH'
 * @param {string} prefix   - e.g. 'PO', 'GRN', 'INV'
 * @param {object} [externalTrx] - optional transaction from beginTransaction()
 * @returns {Promise<string>} formatted document number
 */
const generateDocNumber = async (tenantId, docType, prefix, externalTrx = null) => {
  const ownTrx = !externalTrx;
  const trx = externalTrx || await beginTransaction();
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

    if (ownTrx) await trx.commit();
    const padded = String(lastNumber).padStart(4, '0');
    return `${prefix}-${year}-${padded}`;
  } catch (err) {
    if (ownTrx) await trx.rollback();
    throw err;
  } finally {
    if (ownTrx) trx.release();
  }
};

module.exports = { generateDocNumber };
