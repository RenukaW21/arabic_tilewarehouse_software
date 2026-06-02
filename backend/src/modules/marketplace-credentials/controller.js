'use strict';
const service = require('./service');
const { success, created } = require('../../utils/response');
const { saveSchema } = require('./validation');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }
  req.body = value;
  next();
};

const list = async (req, res, next) => {
  try {
    const data = await service.getAll(req.tenantId);
    return success(res, data, 'Marketplace credentials fetched');
  } catch (err) { next(err); }
};

const getByPlatform = async (req, res, next) => {
  try {
    const data = await service.getByPlatform(req.tenantId, req.params.platform);
    return success(res, data, 'Credentials fetched');
  } catch (err) { next(err); }
};

const save = async (req, res, next) => {
  try {
    const data = await service.save(req.tenantId, req.user.id, req.params.platform, req.body);
    return created(res, data, 'Credentials saved');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.tenantId, req.user.id, req.params.id);
    return res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { list, getByPlatform, save, remove, validate };
