import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { resolveSkuId } from "../../../data/collectibles";
import { db } from "../../../lib/firebase";

const COLLECTIONS_PATH = "collections";

function isPinCollectible(collectible) {
  return collectible?.collectibleType === "pin" || collectible?.category === "pin";
}

export function normalizeQuantity(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return 0;
}

function requireAuth(user) {
  if (!user) {
    const authError = new Error("Authentication required");
    authError.code = "auth-required";
    throw authError;
  }
}

function resolveTargetSku(card, finish) {
  if (!card?.id) {
    throw new Error("A valid collectible is required to add to the collection.");
  }

  const pin = isPinCollectible(card);
  if (!pin && !finish) {
    throw new Error("A finish is required (e.g. DUN or FOIL).");
  }

  const skuId = resolveSkuId(card, finish);
  if (!skuId) {
    throw new Error(pin ? "Invalid pin collectible." : "Invalid card or finish.");
  }

  return { skuId, pin };
}

async function loadExistingDocs(ownerUid, skuId) {
  const collectionRef = collection(db, COLLECTIONS_PATH);
  const existingQuery = query(
    collectionRef,
    where("ownerUid", "==", ownerUid),
    where("skuId", "==", skuId),
  );
  const snapshot = await getDocs(existingQuery);
  return { collectionRef, existingDocs: snapshot.docs };
}

function sumQuantities(existingDocs) {
  let summedQuantity = 0;
  for (const existingDoc of existingDocs) {
    summedQuantity += normalizeQuantity(existingDoc.data()?.quantity);
  }
  return summedQuantity;
}

async function deleteExtraDocs(existingDocs) {
  for (let index = 1; index < existingDocs.length; index += 1) {
    await deleteDoc(existingDocs[index].ref);
  }
}

async function deleteAllDocs(existingDocs) {
  await Promise.all(existingDocs.map((docSnap) => deleteDoc(docSnap.ref)));
}

/**
 * Shared Firestore mutations for collection quantity changes.
 * Auth user is sourced from context; callers never pass ownerUid.
 */
export function useCollectionQuantityMutations() {
  const { user } = useAuth();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const runMutation = useCallback(async (operationName, mutate) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await mutate();
      setStatus("success");
      return result;
    } catch (err) {
      console.error(`Failed to ${operationName}`, err);
      setError(err);
      setStatus("error");
      throw err;
    }
  }, []);

  const addToCollection = useCallback(
    async ({ card, finish = null, quantity = 1, notes }) => {
      requireAuth(user);
      const { skuId } = resolveTargetSku(card, finish);
      const addQuantity = normalizeQuantity(quantity) || 1;

      return runMutation("add to collection", async () => {
        const { collectionRef, existingDocs } = await loadExistingDocs(user.uid, skuId);

        if (existingDocs.length === 0) {
          const payload = {
            ownerUid: user.uid,
            skuId,
            quantity: addQuantity,
            updatedAt: serverTimestamp(),
          };
          if (typeof notes === "string" && notes.trim().length > 0) {
            payload.notes = notes.trim();
          }
          await addDoc(collectionRef, payload);
          return payload;
        }

        const keeper = existingDocs[0];
        const nextQuantity = sumQuantities(existingDocs) + addQuantity;
        const updatePayload = {
          quantity: nextQuantity,
          updatedAt: serverTimestamp(),
        };
        if (typeof notes === "string" && notes.trim().length > 0) {
          updatePayload.notes = notes.trim();
        }

        await updateDoc(keeper.ref, updatePayload);
        await deleteExtraDocs(existingDocs);

        const payload = {
          ownerUid: user.uid,
          skuId,
          quantity: nextQuantity,
          updatedAt: updatePayload.updatedAt,
        };
        if (updatePayload.notes) {
          payload.notes = updatePayload.notes;
        }
        return payload;
      });
    },
    [runMutation, user],
  );

  const decrementFromCollection = useCallback(
    async ({ card, finish = null, quantity = 1, deleteWhenZero = true }) => {
      requireAuth(user);
      const { skuId } = resolveTargetSku(card, finish);
      const removeQuantity = normalizeQuantity(quantity) || 1;

      return runMutation("decrement from collection", async () => {
        const { existingDocs } = await loadExistingDocs(user.uid, skuId);

        if (existingDocs.length === 0) {
          return {
            ownerUid: user.uid,
            skuId,
            quantity: 0,
            deleted: false,
          };
        }

        const summedQuantity = sumQuantities(existingDocs);
        const nextQuantity = Math.max(0, summedQuantity - removeQuantity);

        if (nextQuantity <= 0 && deleteWhenZero) {
          await deleteAllDocs(existingDocs);
          return {
            ownerUid: user.uid,
            skuId,
            quantity: 0,
            deleted: true,
          };
        }

        const keeper = existingDocs[0];
        const updatePayload = {
          quantity: nextQuantity,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(keeper.ref, updatePayload);
        await deleteExtraDocs(existingDocs);

        return {
          ownerUid: user.uid,
          skuId,
          quantity: nextQuantity,
          deleted: false,
          updatedAt: updatePayload.updatedAt,
        };
      });
    },
    [runMutation, user],
  );

  const removeFromCollection = useCallback(
    async ({ card, finish = null }) => {
      requireAuth(user);
      const { skuId } = resolveTargetSku(card, finish);

      return runMutation("remove from collection", async () => {
        const { existingDocs } = await loadExistingDocs(user.uid, skuId);
        if (existingDocs.length > 0) {
          await deleteAllDocs(existingDocs);
        }
        return {
          ownerUid: user.uid,
          skuId,
          quantity: 0,
          deleted: existingDocs.length > 0,
        };
      });
    },
    [runMutation, user],
  );

  /**
   * Hard-delete all collection docs with quantity <= 0 for the signed-in user.
   * Used by Collectibles page to purge soft-zero rows after a reload.
   */
  const purgeZeroQuantityEntries = useCallback(
    async (entries = []) => {
      requireAuth(user);
      const zeroEntries = (Array.isArray(entries) ? entries : []).filter(
        (entry) =>
          entry?.id && entry?.ownerUid === user.uid && normalizeQuantity(entry.quantity) <= 0,
      );
      if (zeroEntries.length === 0) {
        return { deleted: 0 };
      }

      return runMutation("purge zero-quantity entries", async () => {
        await Promise.all(
          zeroEntries.map((entry) => deleteDoc(doc(db, COLLECTIONS_PATH, entry.id))),
        );
        return { deleted: zeroEntries.length };
      });
    },
    [runMutation, user],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return {
    addToCollection,
    decrementFromCollection,
    removeFromCollection,
    purgeZeroQuantityEntries,
    status,
    error,
    user,
    reset,
  };
}
