"use strict";

/**
 * Grant or revoke the Auth custom claim `admin: true` so it matches functions/admins.js.
 *
 * Production (credentials that can manage Firebase Auth on storydeck-16):
 *   npm run admin:claims --prefix functions
 *
 * Auth emulator:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run admin:claims --prefix functions
 *
 * Signed-in admins must refresh their ID token (reload the app) before the claim applies.
 */

const admin = require("firebase-admin");
const { ADMIN_EMAILS, planAdminClaimUpdates } = require("./admins");

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "storydeck-16";

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  console.log(
    emulatorHost
      ? `Updating Auth emulator at ${emulatorHost} (project ${PROJECT_ID}).`
      : `Updating production Auth for project ${PROJECT_ID}.`,
  );

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const auth = admin.auth();
  const users = await listAllUsers(auth);
  const { updates, missing } = planAdminClaimUpdates(users, ADMIN_EMAILS);

  for (const update of updates) {
    await auth.setCustomUserClaims(update.uid, update.claims);
    const action = update.claims.admin === true ? "granted" : "revoked";
    console.log(`${action} admin for ${update.email || update.uid}`);
  }

  if (updates.length === 0) {
    console.log("Admin claims already match the site creator list.");
  }

  if (missing.length > 0) {
    console.error(`No Auth user for admin email(s): ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { main };
