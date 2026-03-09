'use strict';

/**
 * Seed entry point. Run: npm run seed
 * Requires: DB connection (from .env). Optional: SEED_PASSWORD, FORCE_SEED=1
 */

require('dotenv').config();
const { runSeed } = require('../database/seed/seed-runner');
const { testConnection } = require('./db');

async function main() {
  console.log('[Seed] Starting...');
  await testConnection();
  await runSeed();
  console.log('[Seed] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Seed] Fatal:', err);
  process.exit(1);
});
