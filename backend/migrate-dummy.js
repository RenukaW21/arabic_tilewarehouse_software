'use strict';
const { query } = require('./src/config/db');
require('dotenv').config();

const TABLES = [
  'tenants', 'users', 'warehouses', 'racks', 'vendors', 'customers', 'products',
  'shades', 'product_categories', 'batches', 'purchase_orders', 'grn',
  'sales_orders', 'invoices', 'customer_payments', 'vendor_payments', 'notifications',
  'gst_configurations', 'stock_summary', 'stock_ledger'
];

async function migrate() {
  try {
    console.log('Starting migration to add is_dummy column...');
    
    for (const table of TABLES) {
      const columns = await query(`SHOW COLUMNS FROM ${table} LIKE 'is_dummy'`);
      if (columns.length === 0) {
        console.log(`Adding 'is_dummy' to table '${table}'...`);
        await query(`ALTER TABLE ${table} ADD COLUMN is_dummy TINYINT(1) DEFAULT 0`);
      } else {
        console.log(`'is_dummy' already exists in table '${table}'.`);
      }
    }

    // Mark current seeded data as dummy
    // We can identify dummy data by tenant slug or specific names used in fixtures
    console.log('Marking existing seeded data as dummy...');
    
    // Tenants
    await query("UPDATE tenants SET is_dummy = 1 WHERE slug IN ('tiles-india', 'ceramic-world')");
    
    // Everything else linked to those tenants
    for (const table of TABLES) {
      if (table === 'tenants') continue;
      await query(`
        UPDATE ${table} t
        JOIN tenants ten ON t.tenant_id = ten.id
        SET t.is_dummy = 1
        WHERE ten.slug IN ('tiles-india', 'ceramic-world')
      `);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
