'use strict';
const repo = require('./repository');

const getHealth = async (tenantId) => repo.getHealth(tenantId);

const getLogs = async (tenantId, queryParams) => repo.getLogs(tenantId, queryParams);

module.exports = { getHealth, getLogs };
