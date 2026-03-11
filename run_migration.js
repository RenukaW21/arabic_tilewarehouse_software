const { query } = require('./backend/src/config/db');

async function runSQL() {
    try {
        await query("ALTER TABLE grn_items ADD COLUMN batch_number VARCHAR(100) AFTER batch_id;");
        console.log("Success");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists.");
        } else {
            console.error(err);
        }
    }
    process.exit();
}
runSQL();
