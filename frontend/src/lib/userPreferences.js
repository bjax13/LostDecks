import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  matchingOptOut: false,
});

function normalizeUserPreferences(data) {
  if (!data || typeof data !== "object") {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  return {
    matchingOptOut:
      typeof data.matchingOptOut === "boolean"
        ? data.matchingOptOut
        : DEFAULT_USER_PREFERENCES.matchingOptOut,
  };
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
