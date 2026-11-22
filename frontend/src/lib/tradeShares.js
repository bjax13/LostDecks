import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { buildIsoUftSkuLists } from "../pages/Collection/utils/isoUftPost.js";
import { db } from "./firebase";
import { updateUserPreferences } from "./userPreferences.js";

const SHARE_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SHARE_DOC_VERSION = 1;
export const SHARE_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function generateShareId(byteLength = 9) {
  const alphabetLength = SHARE_ID_ALPHABET.length;
  const unbiasedLimit = Math.floor(256 / alphabetLength) * alphabetLength;
  let id = "";
  while (id.length < byteLength) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= unbiasedLimit) {
        continue;
      }
      id += SHARE_ID_ALPHABET[byte % alphabetLength];
      if (id.length >= byteLength) {
        break;
      }
    }
  }
  return id;
}

export function buildShareDocument({
  ownerUid,
  displayName,
  entries,
  matchKeep,
  discordHandle = "",
  region = "",
}) {
  const trimmedName =
    typeof displayName === "string" ? displayName.trim().slice(0, 60) : "Collector";
  const { iso, uft } = buildIsoUftSkuLists(entries ?? [], { matchKeep });

  const docData = {
    ownerUid,
    displayName: trimmedName || "Collector",
    iso,
    uft,
    updatedAt: serverTimestamp(),
    version: SHARE_DOC_VERSION,
  };

  const handle = typeof discordHandle === "string" ? discordHandle.trim().slice(0, 100) : "";
  const regionCode = typeof region === "string" ? region.trim().slice(0, 60) : "";
  if (handle) {
    docData.discordHandle = handle;
  }
  if (regionCode) {
    docData.region = regionCode;
  }

  return docData;
}

export async function fetchShareSnapshot(shareId) {
  if (!db || !shareId) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "shares", shareId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  if (data?.revokedAt) {
    return null;
  }

  return { id: snapshot.id, ...data };
}

export async function enablePublicShare({ userId, shareId, payload }) {
  if (!db || !userId || !shareId) {
    throw new Error("Firestore or user is not configured.");
  }

  await updateUserPreferences(userId, { publicShareId: shareId });
  await setDoc(doc(db, "shares", shareId), payload);
  return shareId;
}

export async function refreshPublicShare({ userId, shareId, payload }) {
  if (!db || !userId || !shareId) {
    throw new Error("Firestore or user is not configured.");
  }

  await updateDoc(doc(db, "shares", shareId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  return shareId;
}

export async function revokePublicShare({ userId, shareId }) {
  if (!db || !userId || !shareId) {
    throw new Error("Firestore or user is not configured.");
  }

  await setDoc(doc(db, "shares", shareId), {
    ownerUid: userId,
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    version: SHARE_DOC_VERSION,
  });
  await updateUserPreferences(userId, { publicShareId: deleteField() });
}

export function formatShareUpdatedAt(value, formatter) {
  if (!value) {
    return null;
  }

  const date =
    typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return typeof formatter === "function" ? formatter.format(date) : date.toISOString();
}

export function isShareStale(updatedAt, nowMs = Date.now()) {
  const date =
    typeof updatedAt?.toDate === "function"
      ? updatedAt.toDate()
      : updatedAt instanceof Date
        ? updatedAt
        : null;
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }
  return nowMs - date.getTime() > SHARE_STALE_MS;
}
