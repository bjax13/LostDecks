import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { ITEM_ADDED } from "../../../analytics/events.js";
import { captureEvent } from "../../../analytics/posthog.js";
import { useAuth } from "../../../contexts/AuthContext";
import { isRetiredPinId, resolveSkuId } from "../../../data/collectibles";
import { MAX_COLLECTION_QUANTITY } from "../../../lib/collectionLimits";
import { db } from "../../../lib/firebase";
import { normalizeTradeFlag } from "../../../lib/tradeFlag.js";

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

function readGroupTradeFlag(existingDocs) {
  let flag = null;
  for (const existingDoc of existingDocs) {
    const next = normalizeTradeFlag(existingDoc.data()?.tradeFlag);
    if (next === "iso") return "iso";
    if (next) flag = next;
  }
  return flag;
}

function entryKeepsZeroQuantity(entry) {
  return Boolean(normalizeTradeFlag(entry?.tradeFlag));
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
      if (isRetiredPinId(skuId) || isRetiredPinId(card?.id)) {
        throw new Error("This pin is no longer listed.");
      }
      const addQuantity = normalizeQuantity(quantity) || 1;

      return runMutation("add to collection", async () => {
        const { collectionRef, existingDocs } = await loadExistingDocs(user.uid, skuId);

        if (existingDocs.length === 0) {
          if (addQuantity > MAX_COLLECTION_QUANTITY) {
            throw new Error(
              `Quantity cannot exceed ${MAX_COLLECTION_QUANTITY} for a single collection entry.`,
            );
          }
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
          captureEvent(ITEM_ADDED, {
            skuId,
            quantity: addQuantity,
            source: "collectibles",
          });
          return payload;
        }

        const keeper = existingDocs[0];
        const nextQuantity = sumQuantities(existingDocs) + addQuantity;
        if (nextQuantity > MAX_COLLECTION_QUANTITY) {
          throw new Error(
            `Quantity cannot exceed ${MAX_COLLECTION_QUANTITY} for a single collection entry.`,
          );
        }
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
        captureEvent(ITEM_ADDED, {
          skuId,
          quantity: addQuantity,
          source: "collectibles",
        });
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
        let tradeFlag = readGroupTradeFlag(existingDocs);
        const clearedUft = nextQuantity <= 0 && tradeFlag === "uft";
        if (clearedUft) {
          tradeFlag = null;
        }

        if (nextQuantity <= 0 && !tradeFlag && (deleteWhenZero || clearedUft)) {
          await deleteAllDocs(existingDocs);
          return {
            ownerUid: user.uid,
            skuId,
            quantity: 0,
            tradeFlag: null,
            deleted: true,
            clearedUft,
          };
        }

        const keeper = existingDocs[0];
        const updatePayload = {
          quantity: nextQuantity,
          updatedAt: serverTimestamp(),
        };
        if (tradeFlag) {
          updatePayload.tradeFlag = tradeFlag;
        } else if (readGroupTradeFlag(existingDocs)) {
          updatePayload.tradeFlag = deleteField();
        }
        await updateDoc(keeper.ref, updatePayload);
        await deleteExtraDocs(existingDocs);

        return {
          ownerUid: user.uid,
          skuId,
          quantity: nextQuantity,
          tradeFlag,
          deleted: false,
          clearedUft,
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

  const setCollectionTradeFlag = useCallback(
    async ({ card, finish = null, tradeFlag = null }) => {
      requireAuth(user);
      const { skuId } = resolveTargetSku(card, finish);
      if (isRetiredPinId(skuId) || isRetiredPinId(card?.id)) {
        throw new Error("This pin is no longer listed.");
      }
      const nextFlag = normalizeTradeFlag(tradeFlag);

      return runMutation("set trade status", async () => {
        const { collectionRef, existingDocs } = await loadExistingDocs(user.uid, skuId);
        const quantity = sumQuantities(existingDocs);

        if (nextFlag === "uft" && quantity < 1) {
          throw new Error("own at least 1 to mark up for trade.");
        }

        if (existingDocs.length === 0) {
          if (!nextFlag) {
            return {
              ownerUid: user.uid,
              skuId,
              quantity: 0,
              tradeFlag: null,
              deleted: false,
            };
          }
          const payload = {
            ownerUid: user.uid,
            skuId,
            quantity: 0,
            tradeFlag: nextFlag,
            updatedAt: serverTimestamp(),
          };
          await addDoc(collectionRef, payload);
          return { ...payload, deleted: false };
        }

        if (!nextFlag && quantity <= 0) {
          await deleteAllDocs(existingDocs);
          return {
            ownerUid: user.uid,
            skuId,
            quantity: 0,
            tradeFlag: null,
            deleted: true,
          };
        }

        const keeper = existingDocs[0];
        const updatePayload = {
          updatedAt: serverTimestamp(),
        };
        updatePayload.tradeFlag = nextFlag ?? deleteField();
        await updateDoc(keeper.ref, updatePayload);
        await deleteExtraDocs(existingDocs);
        return {
          ownerUid: user.uid,
          skuId,
          quantity,
          tradeFlag: nextFlag,
          deleted: false,
          updatedAt: updatePayload.updatedAt,
        };
      });
    },
    [runMutation, user],
  );

  /**
   * Hard-delete collection docs with quantity <= 0 and no trade flag.
   * Used by Collectibles page to purge soft-zero rows after a reload.
   */
  const purgeZeroQuantityEntries = useCallback(
    async (entries = []) => {
      requireAuth(user);
      const zeroEntries = (Array.isArray(entries) ? entries : []).filter(
        (entry) =>
          entry?.id &&
          entry?.ownerUid === user.uid &&
          normalizeQuantity(entry.quantity) <= 0 &&
          !entryKeepsZeroQuantity(entry),
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
    setCollectionTradeFlag,
    purgeZeroQuantityEntries,
    status,
    error,
    user,
    reset,
  };
}
