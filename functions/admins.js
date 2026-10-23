"use strict";

/**
 * Site creators. This array is the only admin list.
 * `node set-admin-claims.js` copies it onto the Auth custom claim `admin: true`.
 * Firestore rules and the admin callable both check that claim, not a second copy of these emails.
 */
const ADMIN_EMAILS = Object.freeze(["corbyagain@gmail.com", "bjack13@gmail.com"]);

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * Decide which Auth users need a custom-claim write so `admin: true` matches ADMIN_EMAILS exactly.
 * Other claims on the same user are preserved.
 * @param {Array<{ uid?: string, email?: string, customClaims?: Record<string, unknown> }>} users
 * @param {readonly string[]} [adminEmails]
 */
function planAdminClaimUpdates(users, adminEmails = ADMIN_EMAILS) {
  const wanted = new Set(adminEmails.map((email) => normalizeEmail(email)).filter(Boolean));
  const found = new Set();
  const updates = [];

  for (const user of users) {
    const uid = typeof user?.uid === "string" ? user.uid : "";
    if (!uid) {
      continue;
    }

    const email = normalizeEmail(user.email);
    const claims =
      user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
    const hasAdmin = claims.admin === true;
    const shouldAdmin = Boolean(email) && wanted.has(email);
    if (shouldAdmin) {
      found.add(email);
    }
    if (hasAdmin === shouldAdmin) {
      continue;
    }

    if (shouldAdmin) {
      claims.admin = true;
    } else {
      delete claims.admin;
    }
    updates.push({ uid, email, claims });
  }

  const missing = [...wanted].filter((email) => !found.has(email));
  return { updates, missing };
}

function callerIsSiteAdmin(request) {
  const uid = request?.auth?.uid;
  return request?.auth?.token?.admin === true && typeof uid === "string" && uid.length > 0;
}

module.exports = {
  ADMIN_EMAILS,
  callerIsSiteAdmin,
  normalizeEmail,
  planAdminClaimUpdates,
};
