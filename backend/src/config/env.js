'use strict';
require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_VERSION: process.env.API_VERSION || 'v1',
  isProd: process.env.NODE_ENV === 'production',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tiles_wms',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0', 10),
    waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== 'false',
    charset: 'utf8mb4',
    timezone: '+00:00',
  },

  jwt: {
    secret: process.env.NODE_ENV === 'production'
      ? required('JWT_SECRET')
      : (process.env.JWT_SECRET || 'dev_secret_change_in_prod_minimum_32_chars'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.NODE_ENV === 'production'
      ? required('JWT_REFRESH_SECRET')
      : (process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_prod_min_32'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:8080'],
  },

  tenant: {
    resolution: process.env.TENANT_RESOLUTION || 'jwt', // 'jwt' | 'header' | 'subdomain'
  },

  log: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};
