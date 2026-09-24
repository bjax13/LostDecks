import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const MATCH_CONTACT_SHARING = Object.freeze({
  TRUE_EMAIL: "trueEmail",
  TRADING_EMAIL: "tradingEmail",
  DISCORD: "discord",
});

export const DEFAULT_DISCORD_CHANNEL = "Sanderson Collectors Guild";

export const MAX_TRADING_EMAIL_LENGTH = 320;
export const MAX_DISCORD_HANDLE_LENGTH = 100;
export const MAX_DISCORD_CHANNEL_LENGTH = 100;

export const MATCH_LANE_IDS = Object.freeze(["dun", "foil", "pins"]);

export const DEFAULT_MATCH_LANES = Object.freeze({
  dun: true,
  foil: true,
  pins: true,
});

export const DEFAULT_MATCH_KEEP = 1;
export const MIN_MATCH_KEEP = 1;
export const MAX_MATCH_KEEP = 3;

export const DEFAULT_MATCH_KEEP_BY_LANE = Object.freeze({
  dun: DEFAULT_MATCH_KEEP,
  foil: DEFAULT_MATCH_KEEP,
  pins: DEFAULT_MATCH_KEEP,
});

export const MATCH_KEEP_OPTIONS = Object.freeze([1, 2, 3]);

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  matchingOptOut: false,
  matchLanes: DEFAULT_MATCH_LANES,
  matchKeep: DEFAULT_MATCH_KEEP_BY_LANE,
  matchContactSharing: MATCH_CONTACT_SHARING.TRUE_EMAIL,
  tradingEmail: "",
  discordHandle: "",
  discordChannel: DEFAULT_DISCORD_CHANNEL,
});

function normalizeOptionalString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

export function normalizeMatchLanes(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    dun: typeof source.dun === "boolean" ? source.dun : DEFAULT_MATCH_LANES.dun,
    foil: typeof source.foil === "boolean" ? source.foil : DEFAULT_MATCH_LANES.foil,
    pins: typeof source.pins === "boolean" ? source.pins : DEFAULT_MATCH_LANES.pins,
  };
}

export function normalizeMatchKeepCount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MATCH_KEEP;
  }

  const count = Math.floor(value);
  if (count < MIN_MATCH_KEEP || count > MAX_MATCH_KEEP) {
    return DEFAULT_MATCH_KEEP;
  }

  return count;
}

export function normalizeMatchKeep(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    dun: normalizeMatchKeepCount(source.dun),
    foil: normalizeMatchKeepCount(source.foil),
    pins: normalizeMatchKeepCount(source.pins),
  };
}

export function normalizeMatchContactSharing(value) {
  if (
    value === MATCH_CONTACT_SHARING.TRUE_EMAIL ||
    value === MATCH_CONTACT_SHARING.TRADING_EMAIL ||
    value === MATCH_CONTACT_SHARING.DISCORD
  ) {
    return value;
  }
  return DEFAULT_USER_PREFERENCES.matchContactSharing;
}

export function normalizeUserPreferences(data) {
  if (!data || typeof data !== "object") {
    return {
      ...DEFAULT_USER_PREFERENCES,
      matchLanes: { ...DEFAULT_MATCH_LANES },
      matchKeep: { ...DEFAULT_MATCH_KEEP_BY_LANE },
    };
  }

  const discordChannel = normalizeOptionalString(data.discordChannel, MAX_DISCORD_CHANNEL_LENGTH);

  return {
    matchingOptOut:
      typeof data.matchingOptOut === "boolean"
        ? data.matchingOptOut
        : DEFAULT_USER_PREFERENCES.matchingOptOut,
    matchLanes: normalizeMatchLanes(data.matchLanes),
    matchKeep: normalizeMatchKeep(data.matchKeep),
    matchContactSharing: normalizeMatchContactSharing(data.matchContactSharing),
    tradingEmail: normalizeOptionalString(data.tradingEmail, MAX_TRADING_EMAIL_LENGTH),
    discordHandle: normalizeOptionalString(data.discordHandle, MAX_DISCORD_HANDLE_LENGTH),
    discordChannel: discordChannel || DEFAULT_DISCORD_CHANNEL,
  };
}

export function isValidTradingEmail(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TRADING_EMAIL_LENGTH) {
    return false;
  }
  // mailto: treats `;`, `,`, and `:` as header/query separators. Reject those
  // here so Account saves and Matches Email links share one gate. `%` is also
  // rejected so percent-encoded separators cannot survive a later decode.
  return /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed);
}

export function subscribeUserPreferences(userId, onNext, onError) {
  if (!db || !userId) {
    onNext?.({ ...DEFAULT_USER_PREFERENCES });
    return () => {};
  }

  const preferencesRef = doc(db, "userPreferences", userId);
  return onSnapshot(
    preferencesRef,
    (snapshot) => {
      onNext?.(normalizeUserPreferences(snapshot.data()));
    },
    (err) => {
      onError?.(err);
    },
  );
}

export async function updateUserPreferences(userId, updates) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }
  if (!userId) {
    throw new Error("User is required to update preferences.");
  }

  const preferencesRef = doc(db, "userPreferences", userId);
  await setDoc(preferencesRef, updates, { merge: true });
}
