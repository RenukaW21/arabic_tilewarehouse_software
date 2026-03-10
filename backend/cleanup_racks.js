'use strict';
const { query } = require('./src/config/db');

async function cleanup() {
    try {
        const r1 = await query(
            'DELETE pr FROM product_racks pr JOIN products p ON pr.product_id = p.id WHERE p.is_active = FALSE'
        );
        console.log('Deleted stale rows (inactive products):', r1.affectedRows);

        const r2 = await query(
            'DELETE pr FROM product_racks pr LEFT JOIN products p ON pr.product_id = p.id WHERE p.id IS NULL'
        );
        console.log('Deleted orphaned rows (missing products):', r2.affectedRows);

        console.log('Cleanup complete. Rack occupancy is now accurate.');
    } catch (err) {
        console.error('Cleanup failed:', err.message);
    }
    process.exit(0);
}

cleanup();
