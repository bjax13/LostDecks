'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { asInt } = require('./validation');

test('asInt returns the value for finite integers', () => {
  assert.equal(asInt(0, 'field'), 0);
  assert.equal(asInt(1, 'field'), 1);
  assert.equal(asInt(-5, 'field'), -5);
});

test('asInt throws for non-integers', () => {
  assert.throws(() => asInt(1.2, 'priceCents'), (err) => {
    assert.equal(err?.code, 'invalid-argument');
    assert.match(String(err?.message ?? ''), /priceCents must be an integer/);
    return true;
  });
});

test('asInt throws for NaN/Infinity/non-number', () => {
  for (const value of [NaN, Infinity, -Infinity, '1', null, undefined]) {
    assert.throws(() => asInt(value, 'qty'), (err) => {
      assert.equal(err?.code, 'invalid-argument');
      return true;
    });
  }
});
