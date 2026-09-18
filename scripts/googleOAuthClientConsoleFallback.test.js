const test = require("node:test");
const assert = require("node:assert/strict");
const {
  googleOAuthClientConsoleFallback,
  oauthOriginsAndRedirectsForSite,
} = require("./googleOAuthClientConsoleFallback");

test("oauthOriginsAndRedirectsForSite includes web.app and firebaseapp.com handler URIs", () => {
  assert.deepEqual(oauthOriginsAndRedirectsForSite("shardstash"), {
    javascriptOrigins: ["https://shardstash.web.app", "https://shardstash.firebaseapp.com"],
    redirectUris: [
      "https://shardstash.web.app/__/auth/handler",
      "https://shardstash.firebaseapp.com/__/auth/handler",
    ],
  });
});

test("googleOAuthClientConsoleFallback points at GCP Credentials for storydeck-16", () => {
  const text = googleOAuthClientConsoleFallback("storydeck-16", "shardstash");
  assert.match(
    text,
    /https:\/\/console\.cloud\.google\.com\/apis\/credentials\?project=storydeck-16/,
  );
  assert.match(text, /https:\/\/shardstash\.web\.app\/__\/auth\/handler/);
  assert.match(text, /Authorized JavaScript origins/);
  assert.match(text, /productionAuthDomain\.js/);
});
