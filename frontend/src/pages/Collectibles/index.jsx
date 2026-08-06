import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useUserCollection } from "../Collection/hooks/useUserCollection";
import CollectibleGrid from "./components/CollectibleGrid";
import CollectiblesHeader from "./components/CollectiblesHeader";
import CollectiblesToolbar from "./components/CollectiblesToolbar";
import CollectibleTable from "./components/CollectibleTable";
import { useCollectiblesExplorer } from "./hooks/useCollectiblesExplorer";
import { usePurgeSoftZeroEntriesOnMount } from "./hooks/usePurgeSoftZeroEntriesOnMount";
import { buildOwnedQuantityBySkuId } from "./utils/ownedQuantities";
import "./Collectibles.css";

export default function CollectiblesPage() {
  const location = useLocation();
  const { user } = useAuth();
  const ownerUid = user?.uid ?? null;
  const { entries, loading } = useUserCollection(ownerUid);
  const [quantityOverrides, setQuantityOverrides] = useState({});

  usePurgeSoftZeroEntriesOnMount(ownerUid, entries, loading);

  const ownedBySkuId = useMemo(() => {
    const base = buildOwnedQuantityBySkuId(entries);
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

  const initialCategoryFilter =
    typeof location.state?.categoryFilter === "string" ? location.state.categoryFilter : "all";
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
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  } = useCollectiblesExplorer({ initialCategoryFilter });

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
        onCategoryChange={setCategoryFilter}
        storyFilter={storyFilter}
        onStoryChange={setStoryFilter}
        rarityFilter={rarityFilter}
        onRarityChange={setRarityFilter}
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortDirection={sortDirection}
        onToggleSortDirection={handleToggleSortDirection}
        rarityOptions={rarityOptions}
        stories={stories}
        resultCount={collectibles.length}
        totalCount={totalCollectibles}
        onReset={resetFilters}
      />

      {viewMode === "table" ? (
        <CollectibleTable
          collectibles={collectibles}
          ownedBySkuId={ownedBySkuId}
          deleteWhenZero={false}
          onQuantityChange={handleQuantityChange}
        />
      ) : (
        <CollectibleGrid
          collectibles={collectibles}
          ownedBySkuId={ownedBySkuId}
          deleteWhenZero={false}
          onQuantityChange={handleQuantityChange}
        />
      )}
    </div>
  );
}
