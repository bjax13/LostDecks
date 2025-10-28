import CategoryPill from './CategoryPill';
import FinishPills from './FinishPills';
import BinderInfo from './BinderInfo';

export default function CardGrid({ cards }) {
  return (
    <div className="cards-grid">
      {cards.map((card) => (
        <article key={card.id} className="card-tile">
          <header>
            <CategoryPill category={card.category} />
            <span className="card-id mono">{card.id}</span>
          </header>
          <h2>{card.displayName}</h2>
          <p className="card-detail">{card.detail}</p>
          <dl className="card-stats">
            <div>
              <dt>Story</dt>
              <dd>{card.storyTitle ?? '—'}</dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>{card.number ?? '—'}</dd>
            </div>
            <div>
              <dt>Rarity</dt>
              <dd>{card.rarity ?? '—'}</dd>
            </div>
          </dl>
          <div className="finishes">
            <h3>Finishes</h3>
            <FinishPills
              finishes={card.finishes}
              empty={<p className="muted">No finishes recorded</p>}
            />
          </div>
          <div className="binder">
            <h3>Binder location</h3>
            <BinderInfo binder={card.binder} layout="grid" />
          </div>
        </article>
      ))}
    </div>
  );
}
