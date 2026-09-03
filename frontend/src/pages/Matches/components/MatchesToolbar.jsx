import { matchLaneOptions, matchSortOptions } from "../constants";

export default function MatchesToolbar({
  searchTerm,
  onSearchChange,
  laneFilter,
  onLaneChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onToggleSortDirection,
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
          placeholder="Search by collector or collectible"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="filter-grid">
        <div className="filter-control">
          <label htmlFor="matches-lane-filter">Lane</label>
          <select
            id="matches-lane-filter"
            value={laneFilter}
            onChange={(event) => onLaneChange(event.target.value)}
          >
            {matchLaneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
