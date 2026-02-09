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
  // MVP constraints (keep things simple + consistent)
  asInt(priceCents, 'priceCents');
}

module.exports = {
  assertUsdCurrency,
  assertListingType,
  assertPriceCents,
};
