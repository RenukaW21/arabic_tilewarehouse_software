'use strict';

const normalizeEmail = (email) => {
  if (email === undefined || email === null) return null;
  const value = String(email).trim();
  return value ? value.toLowerCase() : null;
};

module.exports = { normalizeEmail };
