const test = require("node:test");
const assert = require("node:assert/strict");
const {
  expectedRedirectUriForHost,
  parseRedirectUriFromGoogleUrl,
} = require("./verifyGoogleAuthRedirectHost");

test("parseRedirectUriFromGoogleUrl reads redirect_uri from Google OAuth URL", () => {
  const url =
    "https://accounts.google.com/v3/signin/identifier?redirect_uri=https%3A%2F%2Fshardstash.web.app%2F__%2Fauth%2Fhandler&client_id=test";
  assert.equal(parseRedirectUriFromGoogleUrl(url), "https://shardstash.web.app/__/auth/handler");
});

test("expectedRedirectUriForHost builds Firebase auth handler URI", () => {
  assert.equal(
    expectedRedirectUriForHost("shardstash.web.app"),
    "https://shardstash.web.app/__/auth/handler",
  );
});
