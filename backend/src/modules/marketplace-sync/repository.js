'use strict';
const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const getHealth = async (tenantId) => {
  // Latest sync log per platform per sync_type + credential status
  const [logs, creds] = await Promise.all([
    query(
      `SELECT platform, sync_type, status, records_in, records_out, error_msg, started_at, finished_at
       FROM marketplace_sync_logs msl
       WHERE tenant_id = ?
         AND started_at = (
           SELECT MAX(msl2.started_at)
           FROM marketplace_sync_logs msl2
           WHERE msl2.tenant_id = msl.tenant_id
             AND msl2.platform  = msl.platform
             AND msl2.sync_type = msl.sync_type
         )
       ORDER BY platform, sync_type`,
      [tenantId]
    ),
    query(
      `SELECT platform, is_active, last_sync_at FROM marketplace_credentials WHERE tenant_id = ?`,
      [tenantId]
    ),
  ]);
  return { logs, credentials: creds };
};

const getLogs = async (tenantId, { platform, sync_type, page = 1, limit = 50 } = {}) => {
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];
  if (platform)  { conditions.push('platform = ?');   params.push(platform); }
  if (sync_type) { conditions.push('sync_type = ?');  params.push(sync_type); }

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT * FROM marketplace_sync_logs WHERE ${where}
       ORDER BY started_at DESC LIMIT ${lim} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM marketplace_sync_logs WHERE ${where}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const createLog = async (tenantId, platform, syncType) => {
  const id = uuidv4();
  await query(
    `INSERT INTO marketplace_sync_logs (id, tenant_id, platform, sync_type, status)
     VALUES (?, ?, ?, ?, 'running')`,
    [id, tenantId, platform, syncType]
  );
  return id;
};

const finishLog = async (id, status, recordsIn, recordsOut, errorMsg) => {
  await query(
    `UPDATE marketplace_sync_logs
     SET status = ?, records_in = ?, records_out = ?, error_msg = ?, finished_at = NOW()
     WHERE id = ?`,
    [status, recordsIn || 0, recordsOut || 0, errorMsg || null, id]
  );
};

module.exports = { getHealth, getLogs, createLog, finishLog };
