const { query } = require('./src/config/db');

async function check() {
    try {
        const tenants = await query('SELECT id, name, slug FROM tenants');
        console.log('--- Registered Tenants (Copy EXACTLY) ---');
        tenants.forEach(t => console.log(`Slug: ${t.slug} (Name: ${t.name})`));
        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err.message);
        process.exit(1);
    }
}

check();
