"use strict";

const { Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const {
  GLOBAL_COUNTERS_DOC,
  USAGE_COLLECTION,
  resolveCapsFromConfig,
} = require("./aiPhotoImportConfig");

function utcDayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function utcMonthKey(ms) {
  return new Date(ms).toISOString().slice(0, 7);
}

/**
 * @param {{
 *   caps: { perUserDailyCap: number, perUserMonthlyCap: number, globalDailyCap: number },
 *   userState?: Record<string, unknown> | null,
 *   globalState?: Record<string, unknown> | null,
 *   now: number,
 *   imageCount: number,
 * }} input
 */
function evaluateAiPhotoImportCaps(input) {
  const { caps, userState, globalState, now, imageCount } = input;
  const dayKey = utcDayKey(now);
  const monthKey = utcMonthKey(now);

  let globalDailyDate = typeof globalState?.dailyDate === "string" ? globalState.dailyDate : dayKey;
  let globalDailyCount = typeof globalState?.dailyCount === "number" ? globalState.dailyCount : 0;
  if (globalDailyDate !== dayKey) {
    globalDailyDate = dayKey;
    globalDailyCount = 0;
  }

  if (globalDailyCount + imageCount > caps.globalDailyCap) {
    const nextGlobal = {
      dailyDate: globalDailyDate,
      dailyCount: globalDailyCount,
      featureDisabled: true,
    };
    return {
      allowed: false,
      reason: "global-daily-cap",
      message: "AI photo import is temporarily unavailable. Please try again tomorrow.",
      nextUserState: userState ?? {},
      nextGlobalState: nextGlobal,
    };
  }

  let userDailyDate = typeof userState?.dailyDate === "string" ? userState.dailyDate : dayKey;
  let userDailyCount = typeof userState?.dailyCount === "number" ? userState.dailyCount : 0;
  let userMonthlyMonth =
    typeof userState?.monthlyMonth === "string" ? userState.monthlyMonth : monthKey;
  let userMonthlyCount = typeof userState?.monthlyCount === "number" ? userState.monthlyCount : 0;

  if (userDailyDate !== dayKey) {
    userDailyDate = dayKey;
    userDailyCount = 0;
  }
  if (userMonthlyMonth !== monthKey) {
    userMonthlyMonth = monthKey;
    userMonthlyCount = 0;
  }

  if (userDailyCount + imageCount > caps.perUserDailyCap) {
    return {
      allowed: false,
      reason: "user-daily-cap",
      message: `You've reached today's AI photo import limit (${caps.perUserDailyCap} photos). Try again tomorrow.`,
      nextUserState: {
        dailyDate: userDailyDate,
        dailyCount: userDailyCount,
        monthlyMonth: userMonthlyMonth,
        monthlyCount: userMonthlyCount,
      },
      nextGlobalState: {
        dailyDate: globalDailyDate,
        dailyCount: globalDailyCount,
        featureDisabled: false,
      },
    };
  }

  if (userMonthlyCount + imageCount > caps.perUserMonthlyCap) {
    return {
      allowed: false,
      reason: "user-monthly-cap",
      message: `You've reached this month's AI photo import limit (${caps.perUserMonthlyCap} photos).`,
      nextUserState: {
        dailyDate: userDailyDate,
        dailyCount: userDailyCount,
        monthlyMonth: userMonthlyMonth,
        monthlyCount: userMonthlyCount,
      },
      nextGlobalState: {
        dailyDate: globalDailyDate,
        dailyCount: globalDailyCount,
        featureDisabled: false,
      },
    };
  }

  return {
    allowed: true,
    reason: null,
    message: null,
    nextUserState: {
      dailyDate: userDailyDate,
      dailyCount: userDailyCount + imageCount,
      monthlyMonth: userMonthlyMonth,
      monthlyCount: userMonthlyCount + imageCount,
      lastUsedAt: now,
    },
    nextGlobalState: {
      dailyDate: globalDailyDate,
      dailyCount: globalDailyCount + imageCount,
      featureDisabled: false,
    },
  };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {number} imageCount
 * @param {number} [now]
 * @param {{ caps?: ReturnType<typeof resolveCapsFromConfig> }} [opts]
 */
async function enforceAiPhotoImportCaps(db, uid, imageCount, now = Date.now(), opts = {}) {
  const caps = opts.caps ?? resolveCapsFromConfig(null);
  const userRef = db.collection(USAGE_COLLECTION).doc(uid);
  const globalRef = db.collection(GLOBAL_COUNTERS_DOC.collection).doc(GLOBAL_COUNTERS_DOC.id);

  await db.runTransaction(async (tx) => {
    const [userSnap, globalSnap] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const result = evaluateAiPhotoImportCaps({
      caps,
      userState: userSnap.exists ? userSnap.data() : null,
      globalState: globalSnap.exists ? globalSnap.data() : null,
      now,
      imageCount,
    });

    if (!result.allowed) {
      if (result.reason === "global-daily-cap") {
        tx.set(
          globalRef,
          {
            dailyDate: result.nextGlobalState.dailyDate,
            dailyCount: result.nextGlobalState.dailyCount,
            featureDisabled: true,
            disabledAt: Timestamp.fromMillis(now),
          },
          { merge: true },
        );
      }
      throw new HttpsError("resource-exhausted", result.message);
    }

    tx.set(
      userRef,
      {
        dailyDate: result.nextUserState.dailyDate,
        dailyCount: result.nextUserState.dailyCount,
        monthlyMonth: result.nextUserState.monthlyMonth,
        monthlyCount: result.nextUserState.monthlyCount,
        lastUsedAt: Timestamp.fromMillis(result.nextUserState.lastUsedAt ?? now),
      },
      { merge: true },
    );
    tx.set(
      globalRef,
      {
        dailyDate: result.nextGlobalState.dailyDate,
        dailyCount: result.nextGlobalState.dailyCount,
        featureDisabled: false,
      },
      { merge: true },
    );
  });
}

module.exports = {
  utcDayKey,
  utcMonthKey,
  evaluateAiPhotoImportCaps,
  enforceAiPhotoImportCaps,
};
