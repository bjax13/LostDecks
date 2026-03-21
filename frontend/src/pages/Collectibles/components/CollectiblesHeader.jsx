export default function CollectiblesHeader({ setName, totalCollectibles, viewMode, onChangeView }) {
  return (
    <header className="cards-header">
      <div>
        <p className="cards-meta">Set: {setName}</p>
        <h1>Collectibles</h1>
        <p className="cards-description">
          Browse the {totalCollectibles} collectibles from the Stormlight Lost Tales story deck. Use
          the tools below to search, filter, and sort story, herald, and nonsense variants.
        </p>
      </div>
      <fieldset className="view-toggle">
        <legend className="view-toggle__legend">View mode</legend>
        <button
          type="button"
          className={viewMode === "grid" ? "active" : ""}
          onClick={() => onChangeView("grid")}
        >
          Grid view
        </button>
        <button
          type="button"
          className={viewMode === "table" ? "active" : ""}
          onClick={() => onChangeView("table")}
        >
          Table view
        </button>
      </fieldset>
    </header>
  );
}
