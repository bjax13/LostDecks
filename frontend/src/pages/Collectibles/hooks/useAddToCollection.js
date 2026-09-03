import { useCollectionQuantityMutations } from "./useCollectionQuantityMutations";

/**
 * Thin wrapper around shared collection quantity mutations.
 * Preserves the existing `useAddToCollection` public API for current callers.
 */
export function useAddToCollection() {
  const { addToCollection, status, error, user, reset } = useCollectionQuantityMutations();

  return {
    addToCollection,
    status,
    error,
    user,
    reset,
  };
}
