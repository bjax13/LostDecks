function formatStatValue(owned, total, isSignedIn) {
  if (!isSignedIn) {
    return `— / ${total}`;
  }
  if (owned == null) {
    return "—";
  }
  if (total != null) {
    return `${owned} / ${total}`;
  }
  return String(owned);
}

function SnapshotStat({ label, value, hint }) {
  return (
    <div className="home-snapshot__stat">
      <span className="home-snapshot__label">{label}</span>
      <span className="home-snapshot__value">{value}</span>
      {hint ? <span className="home-snapshot__hint">{hint}</span> : null}
    </div>
  );
}

export default function HomeCollectionSnapshot({ stats, loading }) {
  const { isSignedIn, catalogTotal, foilCatalogTotal } = stats;

  return (
    <section className="home-snapshot" aria-labelledby="home-snapshot-heading">
      <h2 id="home-snapshot-heading">Collection Snapshot</h2>
      {loading ? (
        <div
          className="home-snapshot__bar home-snapshot__bar--loading"
          data-testid="snapshot-loading"
        >
          <div className="home-snapshot__skeleton" />
          <div className="home-snapshot__skeleton" />
          <div className="home-snapshot__skeleton" />
          <div className="home-snapshot__skeleton" />
          <div className="home-snapshot__skeleton" />
        </div>
      ) : (
        <div className="home-snapshot__bar">
          <SnapshotStat
            label="Story Deck Cards"
            value={formatStatValue(stats.uniqueCardCount, catalogTotal, isSignedIn)}
            hint={!isSignedIn ? "Sign in" : null}
          />
          <SnapshotStat
            label="Foils"
            value={formatStatValue(stats.foilOwned, foilCatalogTotal, isSignedIn)}
            hint={!isSignedIn ? "Sign in" : null}
          />
          <SnapshotStat label="Chasm Friend Pins" value="Coming soon" />
          <SnapshotStat
            label="Missing Items"
            value={isSignedIn ? String(stats.missingItems ?? "—") : "—"}
            hint={!isSignedIn ? "Sign in" : null}
          />
          <SnapshotStat
            label="Extras"
            value={isSignedIn ? String(stats.extras ?? "—") : "—"}
            hint={!isSignedIn ? "Sign in" : null}
          />
        </div>
      )}
    </section>
  );
}
