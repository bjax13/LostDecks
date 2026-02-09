'use strict';

const { HttpsError } = require('firebase-functions/v2/https');

function asInt(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.floor(value) !== value) {
    throw new HttpsError('invalid-argument', `${field} must be an integer`);
  }
  return value;
}

module.exports = {
  asInt,
};
