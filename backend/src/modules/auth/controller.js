'use strict';
const service = require('./service');
const { success, created } = require('../../utils/response');
const { writeAuditLog, extractRequestMeta } = require('../../utils/auditLog');

const login = async (req, res) => {
  const result = await service.login(req.body);
  const meta = extractRequestMeta(req);
  await writeAuditLog({
    tenantId: result.user.tenantId, userId: result.user.id,
    action: 'LOGIN', tableName: 'users', recordId: result.user.id,
    ...meta,
  });
  return success(res, result, 'Login successful');
};

const refresh = async (req, res) => {
  const result = await service.refreshAccessToken(req.body.refreshToken);
  return success(res, result, 'Token refreshed');
};

const logout = async (req, res) => {
  await service.logout(req.body.refreshToken);
  return success(res, {}, 'Logged out successfully');
};

const register = async (req, res) => {
  const result = await service.registerTenant(req.body);
  return created(res, result, 'Tenant registered successfully');
};

const changePassword = async (req, res) => {
  await service.changePassword(req.user.id, req.tenantId, req.body);
  const meta = extractRequestMeta(req);
  await writeAuditLog({
    tenantId: req.tenantId, userId: req.user.id,
    action: 'CHANGE_PASSWORD', tableName: 'users', recordId: req.user.id,
    ...meta,
  });
  return success(res, {}, 'Password changed successfully');
};

const getProfile = async (req, res) => {
  const profile = await service.getProfile(req.user.id, req.tenantId);
  return success(res, profile, 'Profile fetched');
};

module.exports = { login, refresh, logout, register, changePassword, getProfile };
