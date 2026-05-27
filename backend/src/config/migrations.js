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
  {
    name: 'create_production_orders',
    sql: `
      CREATE TABLE IF NOT EXISTS \`production_orders\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`order_number\` varchar(50) NOT NULL,
        \`status\` enum('draft','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
        \`warehouse_id\` varchar(36) NOT NULL,
        \`planned_date\` date NOT NULL,
        \`completion_date\` date DEFAULT NULL,
        \`labor_cost\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`machine_cost\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`wastage_cost\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`total_material_cost\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`total_cost\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`notes\` text DEFAULT NULL,
        \`created_by\` varchar(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_prod_order_number\` (\`order_number\`,\`tenant_id\`),
        KEY \`idx_prod_order_tenant\` (\`tenant_id\`),
        KEY \`idx_prod_order_status\` (\`status\`),
        KEY \`idx_prod_order_warehouse\` (\`warehouse_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    name: 'create_production_order_materials',
    sql: `
      CREATE TABLE IF NOT EXISTS \`production_order_materials\` (
        \`id\` varchar(36) NOT NULL,
        \`production_order_id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`planned_qty\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`actual_qty\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`unit_cost\` decimal(12,4) NOT NULL DEFAULT 0.0000,
        \`line_total\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_pom_order\` (\`production_order_id\`),
        KEY \`idx_pom_tenant\` (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    name: 'create_production_order_outputs',
    sql: `
      CREATE TABLE IF NOT EXISTS \`production_order_outputs\` (
        \`id\` varchar(36) NOT NULL,
        \`production_order_id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`planned_qty\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`actual_qty\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`wastage_qty\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`unit_cost\` decimal(12,4) NOT NULL DEFAULT 0.0000,
        \`line_total\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_poo_order\` (\`production_order_id\`),
        KEY \`idx_poo_tenant\` (\`tenant_id\`)
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
