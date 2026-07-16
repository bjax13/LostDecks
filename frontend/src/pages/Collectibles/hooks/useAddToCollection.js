import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useCallback, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { resolveSkuId } from "../../../data/collectibles";
import { db } from "../../../lib/firebase";

const COLLECTIONS_PATH = "collections";

function isPinCollectible(collectible) {
  return collectible?.collectibleType === "pin" || collectible?.category === "pin";
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

      setStatus("loading");
      setError(null);

      try {
        const payload = {
          ownerUid: user.uid,
          skuId,
          quantity,
          updatedAt: serverTimestamp(),
        };
        if (typeof notes === "string" && notes.trim().length > 0) {
          payload.notes = notes.trim();
        }

        await addDoc(collection(db, COLLECTIONS_PATH), payload);
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
