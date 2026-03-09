'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const repo = require('./repository');
const env = require('../../config/env');
const { query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const { ROLE_HIERARCHY } = require('../../constants/roles');
const { checkUserLinked } = require('../../utils/deleteGuard');
const { VALID_ROLES } = require('./validation');

/**
 * Parse role filter from query: role=warehouse_manager,sales | role[]=a&role[]=b | roles=a,b
 * Validate each value against VALID_ROLES; throw if invalid.
 */
function parseAndValidateRoles(queryParams) {
  let raw = queryParams.role ?? queryParams.roles;
  if (raw === undefined || raw === '') return undefined;
  const arr = Array.isArray(raw)
    ? raw.map((r) => String(r).trim()).filter(Boolean)
    : String(raw).split(',').map((r) => r.trim()).filter(Boolean);
  if (arr.length === 0) return undefined;
  const invalid = arr.filter((r) => !VALID_ROLES.includes(r));
  if (invalid.length > 0) {
    throw new AppError(
      `Invalid role(s): ${invalid.join(', ')}. Valid roles: ${VALID_ROLES.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return arr;
}

const getAll = async (tenantId, queryParams) => {
  const roles = parseAndValidateRoles(queryParams);
  return repo.findAll(tenantId, { ...queryParams, role: roles });
};

const getById = async (id, tenantId) => {
  const user = await repo.findById(id, tenantId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return user;
};

const create = async (tenantId, data) => {
  const existing = await repo.findByEmail(data.email, tenantId);
  if (existing) throw new AppError('Email already exists in this tenant', 409, 'DUPLICATE_EMAIL');

  const passwordHash = await bcrypt.hash(data.password, env.security.bcryptRounds);
  const id = uuidv4();
  await repo.create({
    id,
    tenant_id: tenantId,
    name: data.name,
    email: data.email,
    password_hash: passwordHash,
    role: data.role,
    phone: data.phone || null,
  });
  return repo.findById(id, tenantId);
};

const update = async (id, tenantId, currentUserId, currentUserRole, data) => {
  const user = await repo.findById(id, tenantId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  if (id === currentUserId) {
    if (data.role !== undefined && data.role !== user.role) {
      const currentIndex = ROLE_HIERARCHY.indexOf(currentUserRole);
      const newIndex = ROLE_HIERARCHY.indexOf(data.role);
      if (newIndex < currentIndex) {
        throw new AppError('You cannot lower your own role', 400, 'CANNOT_LOWER_OWN_ROLE');
      }
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.is_active !== undefined) updateData.is_active = data.is_active ? 1 : 0;
  if (data.password !== undefined && data.password !== null && String(data.password).trim() !== '') {
    updateData.password_hash = await bcrypt.hash(data.password, env.security.bcryptRounds);
  }

  if (Object.keys(updateData).length === 0) return repo.findById(id, tenantId);
  await repo.update(id, tenantId, updateData);
  return repo.findById(id, tenantId);
};

const remove = async (id, tenantId, currentUserId) => {
  const user = await repo.findById(id, tenantId);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  if (id === currentUserId) {
    throw new AppError('You cannot delete yourself', 400, 'CANNOT_DELETE_SELF');
  }
  await checkUserLinked(id, tenantId);
  await query('DELETE FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = { getAll, getById, create, update, remove };
