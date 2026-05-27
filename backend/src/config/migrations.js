'use strict';

const { query } = require('./db');
const logger = require('../utils/logger');

const MIGRATIONS = [
  {
    name: 'create_user_dashboard_config',
    sql: `
      CREATE TABLE IF NOT EXISTS \`user_dashboard_config\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`config\` json NOT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_user_dashboard\` (\`user_id\`,\`tenant_id\`),
        KEY \`idx_udc_tenant\` (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
];

const runMigrations = async () => {
  for (const migration of MIGRATIONS) {
    try {
      await query(migration.sql);
      logger.info(`Migration OK: ${migration.name}`);
    } catch (err) {
      logger.error(`Migration failed: ${migration.name}`, { error: err.message });
    }
  }
};

module.exports = { runMigrations };
