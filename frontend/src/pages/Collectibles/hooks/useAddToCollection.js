import {
  addDoc,
  collection,
  deleteDoc,
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

function normalizeQuantity(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return 0;
}

export function useAddToCollection() {
  const { user } = useAuth();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const addToCollection = useCallback(
    async ({ card, finish = null, quantity = 1, notes }) => {
      if (!card?.id) {
        throw new Error("A valid collectible is required to add to the collection.");
      }

      const pin = isPinCollectible(card);
      if (!pin && !finish) {
        throw new Error("A finish is required (e.g. DUN or FOIL).");
      }

      if (!user) {
        const authError = new Error("Authentication required");
        authError.code = "auth-required";
        throw authError;
      }

      const skuId = resolveSkuId(card, finish);
      if (!skuId) {
        throw new Error(pin ? "Invalid pin collectible." : "Invalid card or finish.");
      }

      const addQuantity = normalizeQuantity(quantity) || 1;

      setStatus("loading");
      setError(null);

      try {
        const collectionRef = collection(db, COLLECTIONS_PATH);
        const existingQuery = query(
          collectionRef,
          where("ownerUid", "==", user.uid),
          where("skuId", "==", skuId),
        );
        const snapshot = await getDocs(existingQuery);
        const existingDocs = snapshot.docs;

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
          setStatus("success");
          return payload;
        }

        const keeper = existingDocs[0];
        let summedQuantity = 0;
        for (const existingDoc of existingDocs) {
          summedQuantity += normalizeQuantity(existingDoc.data()?.quantity);
        }

        const nextQuantity = summedQuantity + addQuantity;
        const updatePayload = {
          quantity: nextQuantity,
          updatedAt: serverTimestamp(),
        };
        if (typeof notes === "string" && notes.trim().length > 0) {
          updatePayload.notes = notes.trim();
        }

        await updateDoc(keeper.ref, updatePayload);

        for (let index = 1; index < existingDocs.length; index += 1) {
          await deleteDoc(existingDocs[index].ref);
        }

        const payload = {
          ownerUid: user.uid,
          skuId,
          quantity: nextQuantity,
          updatedAt: updatePayload.updatedAt,
        };
        if (updatePayload.notes) {
          payload.notes = updatePayload.notes;
        }

        setStatus("success");
        return payload;
      } catch (err) {
        console.error("Failed to add to collection", err);
        setError(err);
        setStatus("error");
        throw err;
      }
    },
    [user],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return {
    addToCollection,
    status,
    error,
    user,
    reset,
  };
}
