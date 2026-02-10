'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertListingType,
  assertPriceCents,
  assertUsdCurrency,
  assertQuantity,
  assertCardId,
} = require('./marketplaceValidation');

test('assertUsdCurrency allows USD', () => {
  assert.doesNotThrow(() => assertUsdCurrency('USD'));
});

test('assertUsdCurrency throws for non-USD', () => {
  assert.throws(() => assertUsdCurrency('EUR'), (err) => {
    assert.equal(err?.code, 'failed-precondition');
    assert.match(String(err?.message ?? ''), /Unsupported currency/);
    return true;
  });
});

test('assertListingType allows BID/ASK', () => {
  assert.doesNotThrow(() => assertListingType('BID'));
  assert.doesNotThrow(() => assertListingType('ASK'));
});

test('assertListingType throws for invalid values', () => {
  for (const value of ['BUY', 'SELL', '', null, undefined]) {
    assert.throws(() => assertListingType(value), (err) => {
      assert.equal(err?.code, 'failed-precondition');
      assert.match(String(err?.message ?? ''), /Invalid listing type/);
      return true;
    });
  }
});

test('assertPriceCents allows integer cents > 0', () => {
  assert.doesNotThrow(() => assertPriceCents(1));
  assert.doesNotThrow(() => assertPriceCents(9999));
});

test('assertPriceCents throws for non-integers', () => {
  for (const value of [1.25, NaN, Infinity, '1', null, undefined]) {
    assert.throws(() => assertPriceCents(value), (err) => {
      assert.equal(err?.code, 'invalid-argument');
      return true;
    });
  }
});

test('assertPriceCents throws for <= 0', () => {
  for (const value of [0, -1]) {
    assert.throws(() => assertPriceCents(value), (err) => {
      assert.equal(err?.code, 'failed-precondition');
      assert.match(String(err?.message ?? ''), /> 0/);
      return true;
    });
  }
});

test('assertQuantity allows 1 only', () => {
  assert.doesNotThrow(() => assertQuantity(1));
  assert.throws(() => assertQuantity(2), (err) => {
    assert.equal(err?.code, 'failed-precondition');
    return true;
  });
});

test('assertCardId requires non-empty string', () => {
  assert.doesNotThrow(() => assertCardId('LT24-001'));
  for (const value of ['', '  ', null, undefined, 123]) {
    assert.throws(() => assertCardId(value), (err) => {
      assert.equal(err?.code, 'invalid-argument');
      return true;
    });
  }
});
