"use strict";

/** Defaults when Firestore config/aiPhotoImport is missing or incomplete. */
const DEFAULT_PER_USER_DAILY_CAP = 20;
const DEFAULT_PER_USER_MONTHLY_CAP = 100;
const DEFAULT_GLOBAL_DAILY_CAP = 500;

const CONFIG_DOC_PATH = { collection: "config", id: "aiPhotoImport" };
const GLOBAL_COUNTERS_DOC = { collection: "aiPhotoImportGlobal", id: "counters" };
const USAGE_COLLECTION = "aiPhotoImportUsage";

/** Estimated USD per analyzed image (Gemini Flash-Lite tier, inclusive of output). */
const ESTIMATED_USD_PER_IMAGE = 0.002;

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 */
function resolveCapsFromConfig(data) {
  return {
    perUserDailyCap: normalizePositiveInt(data?.perUserDailyCap, DEFAULT_PER_USER_DAILY_CAP),
    perUserMonthlyCap: normalizePositiveInt(data?.perUserMonthlyCap, DEFAULT_PER_USER_MONTHLY_CAP),
    globalDailyCap: normalizePositiveInt(data?.globalDailyCap, DEFAULT_GLOBAL_DAILY_CAP),
  };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 */
async function loadAiPhotoImportCaps(db) {
  const snapshot = await db.collection(CONFIG_DOC_PATH.collection).doc(CONFIG_DOC_PATH.id).get();
  return resolveCapsFromConfig(snapshot.exists ? snapshot.data() : null);
}

module.exports = {
  CONFIG_DOC_PATH,
  GLOBAL_COUNTERS_DOC,
  USAGE_COLLECTION,
  DEFAULT_PER_USER_DAILY_CAP,
  DEFAULT_PER_USER_MONTHLY_CAP,
  DEFAULT_GLOBAL_DAILY_CAP,
  ESTIMATED_USD_PER_IMAGE,
  resolveCapsFromConfig,
  loadAiPhotoImportCaps,
};
