const { query } = require('./src/config/db');
async function run() {
    try {
        const [tenant] = await query('SELECT id FROM tenants WHERE slug = "ceramic-world"');
        const tenantId = tenant.id;
        const result = await query(`
            SELECT amount, payment_date FROM customer_payments WHERE tenant_id = ? AND invoice_id IS NULL AND status = 'cleared'
        `, [tenantId]);
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
