import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildTradeFlagBySkuId,
  tradeStatusEmptyMessage,
  withFlaggedZeroQuantities,
} from "../../lib/tradeFlag.js";
import { useUserCollection } from "../Collection/hooks/useUserCollection";
import CollectibleGrid from "./components/CollectibleGrid";
import CollectiblesHeader from "./components/CollectiblesHeader";
import CollectiblesToolbar from "./components/CollectiblesToolbar";
import CollectibleTable from "./components/CollectibleTable";
import { useCollectiblesExplorer } from "./hooks/useCollectiblesExplorer";
import { usePurgeSoftZeroEntriesOnMount } from "./hooks/usePurgeSoftZeroEntriesOnMount";
import { categoryFilterFromQuery, categoryQueryForFilter } from "./utils/categoryQuery";
import { buildOwnedQuantityBySkuId } from "./utils/ownedQuantities";
import "./Collectibles.css";

function searchParamsWithCategory(prev, filter) {
  const next = new URLSearchParams(prev);
  const queryValue = categoryQueryForFilter(filter);
  if (queryValue) next.set("category", queryValue);
  else next.delete("category");
  return next;
}

export default function CollectiblesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromQuery = categoryFilterFromQuery(searchParams.get("category"));
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { entries, status } = useUserCollection(ownerUid);
  const loading = status === "loading";
  const [quantityOverrides, setQuantityOverrides] = useState({});

  usePurgeSoftZeroEntriesOnMount(ownerUid, entries, loading);

  const tradeFlagBySkuId = useMemo(() => buildTradeFlagBySkuId(entries), [entries]);
  const ownedBySkuId = useMemo(() => {
    const base = withFlaggedZeroQuantities(buildOwnedQuantityBySkuId(entries), entries);
    return { ...base, ...quantityOverrides };
  }, [entries, quantityOverrides]);

  const handleQuantityChange = ({ skuId, quantity }) => {
    if (!skuId) return;
    setQuantityOverrides((prev) => {
      const next = { ...prev };
      if (quantity > 0) {
        delete next[skuId];
      } else {
        next[skuId] = 0;
      }
      return next;
    });
  };

  const [viewMode, setViewMode] = useState("grid");
  const {
    collectibles,
    totalCollectibles,
    datasetMeta,
    rarityOptions,
    stories,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    storyFilter,
    setStoryFilter,
    rarityFilter,
    setRarityFilter,
    tradeStatusFilter,
    setTradeStatusFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  } = useCollectiblesExplorer({
    initialCategoryFilter: categoryFromQuery,
    tradeFlagBySkuId,
  });

  // Sync Category from the URL only when the query changes (back/forward, deep links).
  // Do not depend on categoryFilter — pairing local setCategoryFilter with setSearchParams
  // used to fight the still-stale query (A→B→A→B) and flicker the page.
  useEffect(() => {
    setCategoryFilter(categoryFromQuery);
  }, [categoryFromQuery, setCategoryFilter]);

  useEffect(() => {
    if (!user) setTradeStatusFilter("all");
  }, [user, setTradeStatusFilter]);

  const handleCategoryChange = (nextCategory) => {
    setCategoryFilter(nextCategory);
    setSearchParams((prev) => searchParamsWithCategory(prev, nextCategory), { replace: true });
  };

  const handleReset = () => {
    resetFilters();
    setSearchParams((prev) => searchParamsWithCategory(prev, "all"), { replace: true });
  };

  const handleViewChange = (mode) => {
    setViewMode(mode);
  };

  const handleToggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="cards-page">
      <CollectiblesHeader
        setName={datasetMeta.setName}
        totalCollectibles={totalCollectibles}
        viewMode={viewMode}
        onChangeView={handleViewChange}
      />

      <CollectiblesToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoryFilter={categoryFilter}
        onCategoryChange={handleCategoryChange}
        storyFilter={storyFilter}
        onStoryChange={setStoryFilter}
        rarityFilter={rarityFilter}
        onRarityChange={setRarityFilter}
        tradeStatusFilter={tradeStatusFilter}
        onTradeStatusChange={setTradeStatusFilter}
        showTradeStatus={Boolean(user)}
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortDirection={sortDirection}
        onToggleSortDirection={handleToggleSortDirection}
        rarityOptions={rarityOptions}
        stories={stories}
        resultCount={collectibles.length}
        totalCount={totalCollectibles}
        onReset={handleReset}
      />

      {tradeStatusEmptyMessage(tradeStatusFilter) && collectibles.length === 0 ? (
        <p className="cards-empty">{tradeStatusEmptyMessage(tradeStatusFilter)}</p>
      ) : null}

      {viewMode === "table" ? (
        <CollectibleTable
          collectibles={collectibles}
          ownedBySkuId={ownedBySkuId}
          tradeFlagBySkuId={tradeFlagBySkuId}
          deleteWhenZero={false}
          onQuantityChange={handleQuantityChange}
        />
      ) : (
        <CollectibleGrid
          collectibles={collectibles}
          ownedBySkuId={ownedBySkuId}
          tradeFlagBySkuId={tradeFlagBySkuId}
          deleteWhenZero={false}
          onQuantityChange={handleQuantityChange}
        />
      )}
    </div>
  );
}
