import { useMemo } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { datasetMeta, datasetSkus, pinDatasetMeta } from "../../../data/collectibles";
import {
  buildCollectionSummary,
  decorateCollectionEntries,
} from "../../Collection/collectionSummary";
import { useUserCollection } from "../../Collection/hooks/useUserCollection";

const foilCatalogTotal = datasetSkus.filter(
  (sku) => sku.finish && sku.finish.toUpperCase() === "FOIL",
).length;
const pinCatalogTotal = pinDatasetMeta?.totalUniquePins ?? 0;

function countOwnedFoilSkus(decoratedEntries) {
  const foilSkuIds = new Set();
  for (const entry of decoratedEntries) {
    if (entry.quantity > 0 && entry.finish?.toUpperCase() === "FOIL" && entry.skuId) {
      foilSkuIds.add(entry.skuId);
    }
  }
  return foilSkuIds.size;
}

export function useHomeCollectionStats() {
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { entries, loading, error } = useUserCollection(ownerUid);
  const isSignedIn = Boolean(ownerUid);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }),
    [],
  );

  const decoratedEntries = useMemo(
    () => decorateCollectionEntries(entries, dateFormatter),
    [entries, dateFormatter],
  );

  const summary = useMemo(() => buildCollectionSummary(decoratedEntries), [decoratedEntries]);

  const stats = useMemo(() => {
    const catalogTotal = datasetMeta?.totalUniqueCards ?? 0;
    const uniqueCardCount = isSignedIn ? summary.uniqueCardCount : null;
    const uniquePinCount = isSignedIn ? summary.uniquePinCount : null;
    const foilOwned = isSignedIn ? countOwnedFoilSkus(decoratedEntries) : null;
    const missingItems =
      isSignedIn && catalogTotal > 0 ? Math.max(0, catalogTotal - summary.uniqueCardCount) : null;
    const extras = isSignedIn ? Math.max(0, summary.totalQuantity - summary.uniqueSkuCount) : null;

    return {
      catalogTotal,
      foilCatalogTotal,
      pinCatalogTotal,
      uniqueCardCount,
      uniquePinCount,
      foilOwned,
      missingItems,
      extras,
      isSignedIn,
    };
  }, [decoratedEntries, isSignedIn, summary]);

  return {
    loading: isSignedIn && loading,
    error: isSignedIn ? error : null,
    stats,
  };
}
