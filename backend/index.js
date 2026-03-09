'use strict';
const app = require('./src/app');
const env = require('./src/config/env');
const { testConnection } = require('./src/config/db');
const logger = require('./src/utils/logger');

const start = async () => {
  await testConnection();

  const server = app.listen(env.PORT, () => {
    logger.info(`Tiles WMS API running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`API Base: http://localhost:${env.PORT}/api/${env.API_VERSION}`);
    logger.info(`Health:  http://localhost:${env.PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException',  (err) => { logger.error('Uncaught Exception', { error: err.message }); process.exit(1); });
  process.on('unhandledRejection', (err) => { logger.error('Unhandled Rejection', { error: err?.message }); process.exit(1); });
};

start();
