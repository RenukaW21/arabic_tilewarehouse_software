'use strict';

const service = require('./service');
const { success } = require('../../utils/response');

const getConfig = async (req, res) => {
  const config = await service.getConfig(req.user.id, req.tenantId);
  return success(res, config, 'Dashboard config fetched');
};

const saveConfig = async (req, res) => {
  const config = await service.saveConfig(req.user.id, req.tenantId, req.body);
  return success(res, config, 'Dashboard config saved');
};

const resetConfig = async (req, res) => {
  await service.resetConfig(req.user.id, req.tenantId);
  return res.status(204).send();
};

module.exports = { getConfig, saveConfig, resetConfig };
