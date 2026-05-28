'use strict';

const { query } = require('./db');
const logger = require('../utils/logger');

const MIGRATIONS = [
  {
    name: 'create_loyalty_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS \`loyalty_settings\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`earn_rate_amount\` decimal(12,2) NOT NULL DEFAULT 100.00,
        \`earn_rate_points\` int NOT NULL DEFAULT 1,
        \`point_value_amount\` decimal(12,2) NOT NULL DEFAULT 1.00,
        \`min_redeem_points\` int NOT NULL DEFAULT 1,
        \`max_redeem_percent\` decimal(5,2) NOT NULL DEFAULT 25.00,
        \`cashback_percent\` decimal(5,2) NOT NULL DEFAULT 0.00,
        \`referral_reward_points\` int NOT NULL DEFAULT 50,
        \`tiers_json\` json DEFAULT NULL,
        \`created_by\` varchar(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_loyalty_settings_tenant\` (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `,
  },
  {
    name: 'create_loyalty_transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS \`loyalty_transactions\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`customer_id\` varchar(36) NOT NULL,
        \`sales_order_id\` varchar(36) DEFAULT NULL,
        \`type\` enum('earn','redeem','cashback','referral','adjustment','promotion') NOT NULL,
        \`points_delta\` int NOT NULL DEFAULT 0,
        \`cashback_delta\` decimal(12,2) NOT NULL DEFAULT 0.00,
        \`description\` varchar(255) DEFAULT NULL,
        \`sales_channel\` varchar(50) NOT NULL DEFAULT 'offline',
        \`status\` enum('pending','posted','cancelled') NOT NULL DEFAULT 'posted',
        \`created_by\` varchar(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_loyalty_tx_tenant_customer\` (\`tenant_id\`, \`customer_id\`),
        KEY \`idx_loyalty_tx_order\` (\`sales_order_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `,
  },
  {
    name: 'create_loyalty_promotions',
    sql: `
      CREATE TABLE IF NOT EXISTS \`loyalty_promotions\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`name\` varchar(150) NOT NULL,
        \`description\` text DEFAULT NULL,
        \`offer_type\` enum('points_multiplier','cashback','member_benefit','discount') NOT NULL DEFAULT 'points_multiplier',
        \`points_multiplier\` decimal(6,2) NOT NULL DEFAULT 1.00,
        \`cashback_percent\` decimal(5,2) NOT NULL DEFAULT 0.00,
        \`start_date\` date NOT NULL DEFAULT curdate(),
        \`end_date\` date DEFAULT NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_by\` varchar(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_loyalty_promos_tenant\` (\`tenant_id\`, \`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `,
  },
  {
    name: 'create_loyalty_referrals',
    sql: `
      CREATE TABLE IF NOT EXISTS \`loyalty_referrals\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`referrer_customer_id\` varchar(36) NOT NULL,
        \`referred_customer_id\` varchar(36) DEFAULT NULL,
        \`referral_code\` varchar(50) NOT NULL,
        \`status\` enum('pending','converted','rewarded','cancelled') NOT NULL DEFAULT 'pending',
        \`reward_points\` int NOT NULL DEFAULT 0,
        \`rewarded_at\` datetime DEFAULT NULL,
        \`notes\` text DEFAULT NULL,
        \`created_by\` varchar(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_loyalty_referral_code\` (\`tenant_id\`, \`referral_code\`),
        KEY \`idx_loyalty_referrer\` (\`referrer_customer_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `,
  },
  {
    name: 'add_loyalty_columns_to_sales_orders',
    sql: `
      ALTER TABLE \`sales_orders\`
        ADD COLUMN IF NOT EXISTS \`loyalty_points_redeemed\` int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS \`loyalty_discount_amount\` decimal(12,2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS \`loyalty_points_earned\` int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS \`sales_channel\` varchar(50) NOT NULL DEFAULT 'offline'
    `,
  },
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `,
  },
  {
    name: 'create_production_batches',
    sql: `
      CREATE TABLE IF NOT EXISTS \`production_batches\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`batch_number\` varchar(50) NOT NULL,
        \`production_order_id\` varchar(36) DEFAULT NULL,
        \`status\` enum('pending','in_progress','completed','rejected') NOT NULL DEFAULT 'pending',
        \`warehouse_id\` varchar(36) NOT NULL,
        \`product_id\` varchar(36) DEFAULT NULL,
        \`quantity_planned\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`quantity_produced\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`wastage_qty\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`start_date\` date DEFAULT NULL,
        \`end_date\` date DEFAULT NULL,
        \`notes\` text DEFAULT NULL,
        \`created_by\` varchar(36) DEFAULT NULL,
        \`created_at\` datetime NOT NULL DEFAULT current_timestamp(),
        \`updated_at\` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_batch_number\` (\`batch_number\`,\`tenant_id\`),
        KEY \`idx_pb_tenant\` (\`tenant_id\`),
        KEY \`idx_pb_status\` (\`status\`),
        KEY \`idx_pb_order\` (\`production_order_id\`),
        KEY \`idx_pb_warehouse\` (\`warehouse_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `,
  },
];

const COLLATION_FIXES = [
  'production_orders',
  'production_order_materials',
  'production_order_outputs',
  'production_batches',
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

  // Fix collation on production tables to match existing DB tables (utf8mb4_general_ci)
  for (const table of COLLATION_FIXES) {
    try {
      await query(`ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
      logger.info(`Collation fix OK: ${table}`);
    } catch (err) {
      logger.error(`Collation fix failed: ${table}`, { error: err.message });
    }
  }
};

module.exports = { runMigrations };
