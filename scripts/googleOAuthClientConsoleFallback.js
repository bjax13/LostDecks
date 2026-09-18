const DEFAULT_PROJECT_ID = "storydeck-16";

function oauthOriginsAndRedirectsForSite(siteId) {
  const hosts = [`${siteId}.web.app`, `${siteId}.firebaseapp.com`];
  return {
    javascriptOrigins: hosts.map((host) => `https://${host}`),
    redirectUris: hosts.map((host) => `https://${host}/__/auth/handler`),
  };
}

function googleOAuthClientConsoleFallback(projectId = DEFAULT_PROJECT_ID, siteId = "shardstash") {
  const { javascriptOrigins, redirectUris } = oauthOriginsAndRedirectsForSite(siteId);
  const credentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${projectId}`;

  const lines = [
    "Firebase Auth authorized domains do not update the Google OAuth web client.",
    "If Google sign-in still says continue to storydeck-16.firebaseapp.com, or redirect_uri_mismatch appears,",
    "add the public Hosting host to the Firebase auto-created OAuth 2.0 web client:",
    `1. Open ${credentialsUrl}`,
    '2. Under OAuth 2.0 Client IDs, open the Web application client (often "Web client (auto created by Google Service)").',
    "3. Authorized JavaScript origins — add any that are missing, then save:",
    ...javascriptOrigins.map((origin) => `   - ${origin}`),
    "4. Authorized redirect URIs — add any that are missing, then save:",
    ...redirectUris.map((uri) => `   - ${uri}`),
    "5. Hard refresh https://shardstash.web.app and retry Google sign-in.",
    "The account chooser host comes from redirect_uri (must match VITE_FIREBASE_AUTH_DOMAIN / scripts/productionAuthDomain.js).",
  ];

  return lines.join("\n");
}

module.exports = {
  DEFAULT_PROJECT_ID,
  googleOAuthClientConsoleFallback,
  oauthOriginsAndRedirectsForSite,
};
