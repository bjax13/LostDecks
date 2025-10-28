import { useState } from 'react';
import CardsHeader from './components/CardsHeader';
import CardsToolbar from './components/CardsToolbar';
import CardGrid from './components/CardGrid';
import CardTable from './components/CardTable';
import { useCardsExplorer } from './hooks/useCardsExplorer';
import './Cards.css';

export default function Cards() {
  const [viewMode, setViewMode] = useState('grid');
  const {
    cards,
    totalCards,
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
    resetFilters
  } = useCardsExplorer();

  const handleViewChange = (mode) => {
    setViewMode(mode);
  };

  const handleToggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="cards-page">
      <CardsHeader
        setName={datasetMeta.setName}
        totalCards={totalCards}
        viewMode={viewMode}
        onChangeView={handleViewChange}
      />

      <CardsToolbar
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
        resultCount={cards.length}
        totalCount={totalCards}
        onReset={resetFilters}
      />

      {viewMode === 'table' ? <CardTable cards={cards} /> : <CardGrid cards={cards} />}
    </div>
  );
}
