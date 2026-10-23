import { sortOptions } from "../constants";

export default function CollectiblesToolbar({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  storyFilter,
  onStoryChange,
  rarityFilter,
  onRarityChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onToggleSortDirection,
  rarityOptions,
  stories,
  resultCount,
  totalCount,
  onReset,
}) {
  const isPinSubCategory = categoryFilter === "pin";
  const subCategoryDisabled = categoryFilter === "herald";

  return (
    <section className="cards-toolbar">
      <div className="search-control">
        <label htmlFor="collectible-search">Search</label>
        <input
          id="collectible-search"
          type="search"
          placeholder="Search by ID, story, series, or variant"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="filter-grid">
        <div className="filter-control">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="all">All categories</option>
            <option value="story">Story cards</option>
            <option value="herald">Heralds</option>
            <option value="nonsense">Nonsense variants</option>
            <option value="pin">Pins</option>
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="story-filter">Sub Category</label>
          <select
            id="story-filter"
            value={subCategoryDisabled ? "na" : storyFilter}
            onChange={(event) => onStoryChange(event.target.value)}
            disabled={subCategoryDisabled}
          >
            {subCategoryDisabled ? (
              <option value="na">NA</option>
            ) : (
              <>
                <option value="all">{isPinSubCategory ? "All series" : "All stories"}</option>
                {stories.map((story) => (
                  <option key={story.code} value={story.code}>
                    {story.title}
                  </option>
                ))}
                {!isPinSubCategory ? <option value="heralds">Heralds only</option> : null}
              </>
            )}
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="rarity-filter">Rarity</label>
          <select
            id="rarity-filter"
            value={rarityFilter}
            onChange={(event) => onRarityChange(event.target.value)}
          >
            <option value="all">All rarities</option>
            {rarityOptions.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
            <option value="none">No rarity (nonsense)</option>
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="sort-by">Sort by</label>
          <div className="sort-wrapper">
            <select
              id="sort-by"
              value={sortField}
              onChange={(event) => onSortFieldChange(event.target.value)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="sort-direction"
              onClick={onToggleSortDirection}
              aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar-footer">
        <p>
          Showing <strong>{resultCount}</strong> of <strong>{totalCount}</strong> collectibles
        </p>
        <button type="button" className="reset-button" onClick={onReset}>
          Reset filters
        </button>
      </div>
    </section>
  );
}
