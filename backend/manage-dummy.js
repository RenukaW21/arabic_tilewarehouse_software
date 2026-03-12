'use strict';
const { query } = require('./src/config/db');
require('dotenv').config();

const TABLES = [
  'tenants', 'users', 'warehouses', 'racks', 'vendors', 'customers', 'products', 
  'shades', 'product_categories', 'batches', 'purchase_orders', 'grn', 
  'sales_orders', 'invoices', 'customer_payments', 'vendor_payments', 'notifications'
];

async function manageDummy() {
  const action = process.argv[2]; // 'hide' or 'show'

  if (!['hide', 'show'].includes(action)) {
    console.error('Usage: node manage-dummy.js [hide|show]');
    process.exit(1);
  }

  const is_active = action === 'hide' ? 0 : 1;
  const statusLabel = action === 'hide' ? 'HIDDEN' : 'RESTORED';

  try {
    console.log(`Action: ${action.toUpperCase()} dummy data...`);

    for (const table of TABLES) {
      const columns = await query(`SHOW COLUMNS FROM ${table} LIKE 'is_active'`);
      if (columns.length > 0) {
        await query(`UPDATE ${table} SET is_active = ? WHERE is_dummy = 1`, [is_active]);
        console.log(`- Table '${table}': Updated dummy records state to ${is_active}`);
      } else {
        console.log(`- Table '${table}': Skipped (no 'is_active' column)`);
      }
    }

    console.log(`\nSuccess: All dummy data has been ${statusLabel}.`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update dummy data:', err);
    process.exit(1);
  }
}

manageDummy();
