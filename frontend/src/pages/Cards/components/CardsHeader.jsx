export default function CardsHeader({ setName, totalCards, viewMode, onChangeView }) {
  return (
    <header className="cards-header">
      <div>
        <p className="cards-meta">Set: {setName}</p>
        <h1>Story Deck Explorer</h1>
        <p className="cards-description">
          Browse the {totalCards} cards from the Stormlight Lost Tales story deck. Use the tools below to
          search, filter, and sort story, herald, and nonsense variants.
        </p>
      </div>
      <div className="view-toggle" role="group" aria-label="View mode toggle">
        <button
          type="button"
          className={viewMode === 'grid' ? 'active' : ''}
          onClick={() => onChangeView('grid')}
        >
          Grid view
        </button>
        <button
          type="button"
          className={viewMode === 'table' ? 'active' : ''}
          onClick={() => onChangeView('table')}
        >
          Table view
        </button>
      </div>
    </header>
  );
}
