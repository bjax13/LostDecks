"use strict";

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const DEFAULT_MIN_INTERVAL_MS = 3000;
const DEFAULT_WINDOW_MS = 3_600_000;
const DEFAULT_MAX_PER_WINDOW = 120;

function toMillis(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return null;
}

/**
 * Pure rate-limit evaluation for unit tests (no Firestore).
 * @param {{ lastCallAt?: number, windowStart?: number, windowCount?: number } | null | undefined} state
 * @param {number} now
 * @param {{ minIntervalMs?: number, windowMs?: number, maxPerWindow?: number }} [opts]
 * @returns {{ allowed: boolean, nextState: { lastCallAt: number, windowStart: number, windowCount: number } }}
 */
function evaluateRateLimit(state, now, opts = {}) {
  const minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const maxPerWindow = opts.maxPerWindow ?? DEFAULT_MAX_PER_WINDOW;

  const lastCallAt = typeof state?.lastCallAt === "number" ? state.lastCallAt : null;
  let windowStart = typeof state?.windowStart === "number" ? state.windowStart : now;
  let windowCount = typeof state?.windowCount === "number" ? state.windowCount : 0;

  if (now - windowStart >= windowMs) {
    windowStart = now;
    windowCount = 0;
  }

  if (lastCallAt != null && now - lastCallAt < minIntervalMs) {
    return {
      allowed: false,
      nextState: {
        lastCallAt,
        windowStart,
        windowCount,
      },
    };
  }

  if (windowCount >= maxPerWindow) {
    return {
      allowed: false,
      nextState: {
        lastCallAt: lastCallAt ?? now,
        windowStart,
        windowCount,
      },
    };
  }

  return {
    allowed: true,
    nextState: {
      lastCallAt: now,
      windowStart,
      windowCount: windowCount + 1,
    },
  };
}

/**
 * Server-only: rateLimits/{uid} = { lastCallAt, windowStart, windowCount }.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {{ minIntervalMs?: number, windowMs?: number, maxPerWindow?: number, now?: number }} [opts]
 */
async function enforceCallCooldown(db, uid, opts = {}) {
  const now = typeof opts.now === "number" ? opts.now : Date.now();
  const ref = db.collection("rateLimits").doc(uid);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.exists ? snapshot.data() : null;
    const state = data
      ? {
          lastCallAt: toMillis(data.lastCallAt),
          windowStart: toMillis(data.windowStart),
          windowCount: data.windowCount,
        }
      : null;

    const { allowed, nextState } = evaluateRateLimit(state, now, opts);
    if (!allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please wait a moment and try again.",
      );
    }

    tx.set(ref, {
      lastCallAt: admin.firestore.Timestamp.fromMillis(nextState.lastCallAt),
      windowStart: admin.firestore.Timestamp.fromMillis(nextState.windowStart),
      windowCount: nextState.windowCount,
    });
  });
}

module.exports = {
  evaluateRateLimit,
  enforceCallCooldown,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_WINDOW_MS,
  DEFAULT_MAX_PER_WINDOW,
};
