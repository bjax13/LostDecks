import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

const COLLECTIONS_PATH = "collections";

function normalizeQuantity(entry) {
  const candidates = [entry?.quantity, entry?.count, entry?.copies, entry?.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 1;
}

function requireOwnerUid(ownerUid) {
  if (!ownerUid) {
    const authError = new Error("Authentication required");
    authError.code = "auth-required";
    throw authError;
  }
}

function collectionRef() {
  return collection(db, COLLECTIONS_PATH);
}

function pickEntryToDecrement(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  return [...entries].sort((a, b) => normalizeQuantity(b) - normalizeQuantity(a))[0];
}

export async function adjustCollectionEntryQuantity({ entry, delta = -1 }) {
  if (!entry?.id) {
    throw new Error("A collection entry is required to update quantity.");
  }

  const ref = doc(collectionRef(), entry.id);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      return { deleted: true, quantity: 0, entryId: entry.id };
    }

    const current = Math.max(0, normalizeQuantity({ id: snapshot.id, ...snapshot.data() }));
    const next = current + delta;

    if (next <= 0) {
      transaction.delete(ref);
      return { deleted: true, quantity: 0, entryId: entry.id };
    }

    transaction.update(ref, {
      quantity: next,
      updatedAt: serverTimestamp(),
    });
    return { deleted: false, quantity: next, entryId: entry.id };
  });
}

export async function decrementCollectionBySku({ ownerUid, skuId, amount = 1 }) {
  requireOwnerUid(ownerUid);

  if (!skuId) {
    throw new Error("A SKU is required to update the collection.");
  }

  const decrementBy = Math.max(1, Math.round(amount));
  const snapshot = await getDocs(
    query(collectionRef(), where("ownerUid", "==", ownerUid), where("skuId", "==", skuId)),
  );

  const entries = snapshot.docs.map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  }));
  const target = pickEntryToDecrement(entries);
  if (!target) {
    return { deleted: false, quantity: 0, entryId: null };
  }

  return adjustCollectionEntryQuantity({ entry: target, delta: -decrementBy });
}
