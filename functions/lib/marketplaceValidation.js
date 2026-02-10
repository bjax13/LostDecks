'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { asInt } = require('./validation');

function assertUsdCurrency(currency) {
  if (currency !== 'USD') {
    throw new HttpsError('failed-precondition', 'Unsupported currency');
  }
}

function assertListingType(listingType) {
  if (listingType !== 'BID' && listingType !== 'ASK') {
    throw new HttpsError('failed-precondition', 'Invalid listing type');
  }
}

function assertPriceCents(priceCents) {
  asInt(priceCents, 'priceCents');
  if (priceCents <= 0) {
    throw new HttpsError('failed-precondition', 'priceCents must be > 0');
  }
  // Basic sanity cap (avoid typos like $999999)
  if (priceCents > 10000000) {
    throw new HttpsError('failed-precondition', 'priceCents is too large');
  }
}

function assertQuantity(quantity) {
  asInt(quantity, 'quantity');
  if (quantity !== 1) {
    throw new HttpsError('failed-precondition', 'Only quantity=1 is supported for MVP');
  }
}

function assertCardId(cardId) {
  if (typeof cardId !== 'string' || cardId.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'cardId is required');
  }
}

module.exports = {
  assertUsdCurrency,
  assertListingType,
  assertPriceCents,
  assertQuantity,
  assertCardId,
};
