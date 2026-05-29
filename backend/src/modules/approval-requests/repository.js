'use strict';
const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const BASE_SELECT = `
  SELECT
    ar.*,
    su.name  AS submitter_name,
    su.email AS submitter_email,
    ru.name  AS reviewer_name,
    ru.email AS reviewer_email
  FROM approval_requests ar
  LEFT JOIN users su ON ar.submitted_by = su.id
  LEFT JOIN users ru ON ar.reviewed_by  = ru.id
`;

const findAll = async (tenantId, { status, request_type, submitted_by, page = 1, limit = 25, search } = {}) => {
  const conditions = ['ar.tenant_id = ?'];
  const params = [tenantId];

  if (status)        { conditions.push('ar.status = ?');        params.push(status); }
  if (request_type)  { conditions.push('ar.request_type = ?');  params.push(request_type); }
  if (submitted_by)  { conditions.push('ar.submitted_by = ?');  params.push(submitted_by); }
  if (search)        { conditions.push('ar.title LIKE ?');       params.push(`%${search}%`); }

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));

  const [rows, countRows] = await Promise.all([
    query(`${BASE_SELECT} WHERE ${where} ORDER BY ar.submitted_at DESC LIMIT ${lim} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM approval_requests ar WHERE ${where}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `${BASE_SELECT} WHERE ar.id = ? AND ar.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const getStats = async (tenantId) => {
  const rows = await query(
    `SELECT
       COUNT(*)                                           AS total,
       SUM(status = 'pending')                           AS pending,
       SUM(status = 'approved')                          AS approved,
       SUM(status = 'rejected')                          AS rejected,
       SUM(status = 'pending' AND request_type = 'inventory_adjustment')  AS pending_adj,
       SUM(status = 'pending' AND request_type = 'production_entry')      AS pending_prod,
       SUM(status = 'pending' AND request_type = 'purchase_approval')     AS pending_po,
       SUM(status = 'pending' AND request_type = 'pricing_change')        AS pending_price,
       SUM(status = 'pending' AND request_type = 'marketplace_update')    AS pending_market,
       SUM(status = 'pending' AND request_type = 'report_validation')     AS pending_report
     FROM approval_requests
     WHERE tenant_id = ?`,
    [tenantId]
  );
  return rows[0];
};

const create = async (data) => {
  const id = uuidv4();
  await query(
    `INSERT INTO approval_requests
       (id, tenant_id, request_type, reference_id, reference_type, title, description, payload, submitted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.tenant_id,
      data.request_type,
      data.reference_id,
      data.reference_type,
      data.title,
      data.description || null,
      data.payload ? JSON.stringify(data.payload) : null,
      data.submitted_by,
    ]
  );
  return id;
};

const setApproved = async (id, tenantId, reviewedBy, reviewNotes) => {
  await query(
    `UPDATE approval_requests
     SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [reviewedBy, reviewNotes || null, id, tenantId]
  );
};

const setRejected = async (id, tenantId, reviewedBy, reviewNotes) => {
  await query(
    `UPDATE approval_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [reviewedBy, reviewNotes || null, id, tenantId]
  );
};

module.exports = { findAll, findById, getStats, create, setApproved, setRejected };
