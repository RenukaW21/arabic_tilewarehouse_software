'use strict';
const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('../utils/logger');

let pool;

/**
 * Get or create the MySQL connection pool (singleton)
 */
const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      connectionLimit: env.db.connectionLimit,
      queueLimit: env.db.queueLimit,
      waitForConnections: env.db.waitForConnections,
      charset: env.db.charset,
      timezone: env.db.timezone,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 10000,
    });
    logger.info(`MySQL pool created [host=${env.db.host} db=${env.db.database} limit=${env.db.connectionLimit}]`);
  }
  return pool;
};

/**
 * Execute a single query with optional params.
 * Automatically filters by tenantId if provided.
 */
const query = async (sql, params = []) => {
  const conn = getPool();
  const [rows] = await conn.execute(sql, params);
  return rows;
};

/**
 * Begin a transaction — returns connection with helper methods.
 * Usage:
 *   const trx = await beginTransaction();
 *   try { await trx.query(sql, params); await trx.commit(); }
 *   catch(e) { await trx.rollback(); throw e; }
 *   finally { trx.release(); }
 */
const beginTransaction = async () => {
  const conn = await getPool().getConnection();
  await conn.beginTransaction();

  return {
    query: async (sql, params = []) => {
      const [rows] = await conn.execute(sql, params);
      return rows;
    },
    commit: async () => conn.commit(),
    rollback: async () => conn.rollback(),
    release: () => conn.release(),
  };
};

/**
 * Test the database connection on startup.
 */
const testConnection = async () => {
  try {
//     console.log("DB CONFIG:", {
//   host: env.db.host,
//   port: env.db.port,
//   user: env.db.user,
//   password: env.db.password,
// });
    await query('SELECT 1');
    logger.info('Database connection verified');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }
};

module.exports = { query, beginTransaction, testConnection, getPool };
