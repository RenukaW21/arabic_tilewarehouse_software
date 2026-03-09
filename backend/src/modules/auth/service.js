'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../../config/env');
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');

const generateTokens = (user) => {
  const payload = {
    sub: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: user.email,
    name: user.name,
  };

  const accessToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  const refreshToken = jwt.sign({ sub: user.id, tenantId: user.tenant_id }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
};

const login = async ({ email, password, tenantSlug }) => {
  // Resolve tenant
  if (!tenantSlug) throw new AppError('Tenant slug is required', 400, 'TENANT_MISSING');

  const tenant = await repo.findTenantBySlug(tenantSlug);
  if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  if (tenant.status === 'suspended') throw new AppError('Tenant account is suspended', 403, 'TENANT_SUSPENDED');

  const user = await repo.findUserByEmail(email, tenant.id);
  if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  await repo.updateLastLogin(user.id);

  const { accessToken, refreshToken } = generateTokens(user);

  // Store refresh token (expires in 7d)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.saveRefreshToken(user.id, user.tenant_id, refreshToken, expiresAt);

  return {
    accessToken,
    refreshToken,
    expiresIn: env.jwt.expiresIn,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      tenantSlug: user.tenant_slug,
    },
  };
};

const refreshAccessToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const storedToken = await repo.findRefreshToken(refreshToken);
  if (!storedToken) throw new AppError('Refresh token not found or expired', 401, 'INVALID_REFRESH_TOKEN');
  if (!storedToken.is_active) throw new AppError('User account is inactive', 403, 'ACCOUNT_INACTIVE');

  const user = await repo.findUserById(decoded.sub, storedToken.tenant_id);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const { accessToken, refreshToken: newRefreshToken } = generateTokens({ ...user, tenant_id: storedToken.tenant_id });

  // Rotate refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await repo.deleteRefreshToken(refreshToken);
  await repo.saveRefreshToken(user.id, storedToken.tenant_id, newRefreshToken, expiresAt);

  return { accessToken, refreshToken: newRefreshToken, expiresIn: env.jwt.expiresIn };
};

const logout = async (refreshToken) => {
  await repo.deleteRefreshToken(refreshToken);
};

const registerTenant = async ({ tenantName, tenantSlug, plan, adminName, adminEmail, adminPassword, adminPhone }) => {
  const existing = await repo.findTenantBySlug(tenantSlug);
  if (existing) throw new AppError(`Slug '${tenantSlug}' is already taken`, 409, 'SLUG_TAKEN');

  const passwordHash = await bcrypt.hash(adminPassword, env.security.bcryptRounds);
  const tenantId = uuidv4();
  const adminId = uuidv4();

  await repo.createTenantWithAdmin({
    tenantId, tenantName, slug: tenantSlug, plan: plan || 'basic',
    adminId, name: adminName, email: adminEmail, passwordHash, phone: adminPhone,
  });

  return { tenantId, tenantSlug, adminId, message: 'Tenant registered successfully' };
};

const changePassword = async (userId, tenantId, { currentPassword, newPassword }) => {
  const rows = await repo.findUserById(userId, tenantId);
  if (!rows) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  // Re-fetch with hash
  const { query } = require('../../config/db');
  const users = await query(`SELECT password_hash FROM users WHERE id = ? AND tenant_id = ?`, [userId, tenantId]);
  if (!users.length) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const match = await bcrypt.compare(currentPassword, users[0].password_hash);
  if (!match) throw new AppError('Current password is incorrect', 400, 'WRONG_PASSWORD');

  const newHash = await bcrypt.hash(newPassword, env.security.bcryptRounds);
  await repo.updateUserPassword(userId, tenantId, newHash);
};

const getProfile = async (userId, tenantId) => {
  const user = await repo.findUserById(userId, tenantId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};

module.exports = { login, refreshAccessToken, logout, registerTenant, changePassword, getProfile };
