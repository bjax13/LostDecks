import { useState } from 'react';
import CollectiblesHeader from './components/CollectiblesHeader';
import CollectiblesToolbar from './components/CollectiblesToolbar';
import CollectibleGrid from './components/CollectibleGrid';
import CollectibleTable from './components/CollectibleTable';
import { useCollectiblesExplorer } from './hooks/useCollectiblesExplorer';
import './Collectibles.css';

export default function CollectiblesPage() {
  const [viewMode, setViewMode] = useState('grid');
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
  } = useCollectiblesExplorer();

  const handleViewChange = (mode) => {
    setViewMode(mode);
  };

  const handleToggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
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

      {viewMode === 'table' ? (
        <CollectibleTable collectibles={collectibles} />
      ) : (
        <CollectibleGrid collectibles={collectibles} />
      )}
    </div>
  );
}
