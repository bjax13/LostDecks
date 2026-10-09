import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { updateUserPreferences } from "./userPreferences.js";

const SHARE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const PUBLIC_TRADE_LIST_SHARE_ID_LENGTH = 12;
export const MAX_PUBLIC_DISPLAY_NAME_LENGTH = 60;
export const MAX_PUBLIC_DISCORD_HANDLE_LENGTH = 100;
export const MAX_PUBLIC_REGION_LENGTH = 60;
export const MAX_PUBLIC_ISO_LENGTH = 500;
export const MAX_PUBLIC_UFT_LENGTH = 500;
export const PUBLIC_TRADE_LIST_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function generateShareId(length = PUBLIC_TRADE_LIST_SHARE_ID_LENGTH) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i += 1) {
    id += SHARE_ID_ALPHABET[bytes[i] % SHARE_ID_ALPHABET.length];
  }
  return id;
}

export function truncatePublicString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

export function buildPublicTradeListPayload({
  ownerUid,
  displayName,
  discordHandle = "",
  region = "",
  iso = [],
  uft = [],
}) {
  const payload = {
    ownerUid,
    displayName: truncatePublicString(displayName, MAX_PUBLIC_DISPLAY_NAME_LENGTH) || "Collector",
    iso: iso.slice(0, MAX_PUBLIC_ISO_LENGTH).map((skuId) => String(skuId).trim().toUpperCase()),
    uft: uft.slice(0, MAX_PUBLIC_UFT_LENGTH).map((row) => ({
      skuId: String(row.skuId).trim().toUpperCase(),
      quantity: Math.max(1, Math.floor(Number(row.quantity) || 1)),
    })),
    updatedAt: serverTimestamp(),
    version: 1,
  };

  const discord = truncatePublicString(discordHandle, MAX_PUBLIC_DISCORD_HANDLE_LENGTH);
  if (discord) {
    payload.discordHandle = discord;
  }

  const regionValue = truncatePublicString(region, MAX_PUBLIC_REGION_LENGTH);
  if (regionValue) {
    payload.region = regionValue;
  }

  return payload;
}

export async function upsertPublicTradeList(shareId, payload) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }
  if (!shareId) {
    throw new Error("shareId is required.");
  }
  await setDoc(doc(db, "publicTradeLists", shareId), payload, { merge: false });
}

export async function deletePublicTradeList(shareId) {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }
  if (!shareId) {
    return;
  }
  await deleteDoc(doc(db, "publicTradeLists", shareId));
}

export async function fetchPublicTradeList(shareId) {
  if (!db || !shareId) {
    return null;
  }
  const snapshot = await getDoc(doc(db, "publicTradeLists", shareId));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() };
}

export async function enablePublicTradeList({
  ownerUid,
  existingShareId = null,
  displayName,
  discordHandle,
  region,
  iso,
  uft,
}) {
  const shareId = existingShareId || generateShareId();
  const payload = buildPublicTradeListPayload({
    ownerUid,
    displayName,
    discordHandle,
    region,
    iso,
    uft,
  });
  await upsertPublicTradeList(shareId, payload);
  await updateUserPreferences(ownerUid, { publicShareId: shareId });
  return shareId;
}

export async function refreshPublicTradeList({
  ownerUid,
  shareId,
  displayName,
  discordHandle,
  region,
  iso,
  uft,
}) {
  if (!shareId) {
    throw new Error("shareId is required to refresh a public list.");
  }
  const payload = buildPublicTradeListPayload({
    ownerUid,
    displayName,
    discordHandle,
    region,
    iso,
    uft,
  });
  await upsertPublicTradeList(shareId, payload);
  return shareId;
}

export async function disablePublicTradeList({ ownerUid, shareId }) {
  if (shareId) {
    await deletePublicTradeList(shareId);
  }
  await updateUserPreferences(ownerUid, { publicShareId: "" });
}

export function isPublicTradeListStale(updatedAt, now = Date.now()) {
  if (!updatedAt) {
    return false;
  }
  const millis =
    typeof updatedAt.toMillis === "function"
      ? updatedAt.toMillis()
      : updatedAt instanceof Date
        ? updatedAt.getTime()
        : Number(updatedAt);
  if (!Number.isFinite(millis)) {
    return false;
  }
  return now - millis > PUBLIC_TRADE_LIST_STALE_MS;
}
