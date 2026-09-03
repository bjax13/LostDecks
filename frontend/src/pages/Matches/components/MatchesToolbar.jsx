import { MATCH_SCOPE_ANY, matchSortOptions } from "../constants";

export default function MatchesToolbar({
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
  return (
    <section className="matches-toolbar cards-toolbar">
      <div className="search-control">
        <label htmlFor="matches-search">Search</label>
        <input
          id="matches-search"
          type="search"
          placeholder="Search by collector, ID, story, or variant"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="filter-grid">
        <div className="filter-control">
          <label htmlFor="matches-category-filter">Category</label>
          <select
            id="matches-category-filter"
            value={categoryFilter}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value={MATCH_SCOPE_ANY}>Show any valid trade</option>
            <option value="all">All categories</option>
            <option value="story">Story cards</option>
            <option value="herald">Heralds</option>
            <option value="nonsense">Nonsense variants</option>
            <option value="pin">Pins</option>
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="matches-story-filter">Story</label>
          <select
            id="matches-story-filter"
            value={storyFilter}
            onChange={(event) => onStoryChange(event.target.value)}
            disabled={categoryFilter === MATCH_SCOPE_ANY}
          >
            <option value="all">All stories</option>
            {stories.map((story) => (
              <option key={story.code} value={story.code}>
                {story.title}
              </option>
            ))}
            <option value="heralds">Heralds only</option>
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="matches-rarity-filter">Rarity</label>
          <select
            id="matches-rarity-filter"
            value={rarityFilter}
            onChange={(event) => onRarityChange(event.target.value)}
            disabled={categoryFilter === MATCH_SCOPE_ANY}
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
          <label htmlFor="matches-sort-by">Sort by</label>
          <div className="sort-wrapper">
            <select
              id="matches-sort-by"
              value={sortField}
              onChange={(event) => onSortFieldChange(event.target.value)}
            >
              {matchSortOptions.map((option) => (
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
          Showing <strong>{resultCount}</strong> of <strong>{totalCount}</strong> collectors on this
          page
        </p>
        <button type="button" className="reset-button" onClick={onReset}>
          Reset filters
        </button>
      </div>
    </section>
  );
}
