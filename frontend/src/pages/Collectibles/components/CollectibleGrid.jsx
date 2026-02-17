import { useNavigate } from 'react-router-dom';
import CategoryPill from './CategoryPill';
import FinishPills from './FinishPills';
import BinderInfo from './BinderInfo';
import AddToCollectionButton from './AddToCollectionButton';

export default function CollectibleGrid({ collectibles }) {
  const navigate = useNavigate();

  const handleCollectibleClick = (collectibleId, event) => {
    if (event.target.closest('.card-actions')) {
      return;
    }
    navigate(`/collectibles/${collectibleId}`);
  };

  return (
    <div className="cards-grid">
      {collectibles.map((collectible) => (
        <article
          key={collectible.id}
          className="card-tile card-tile--clickable"
          onClick={(e) => handleCollectibleClick(collectible.id, e)}
        >
          <header>
            <CategoryPill category={collectible.category} />
            <span className="card-id mono">{collectible.id}</span>
          </header>
          <h2>{collectible.displayName}</h2>
          <p className="card-detail">{collectible.detail}</p>
          <dl className="card-stats">
            <div>
              <dt>Story</dt>
              <dd>{collectible.storyTitle ?? '—'}</dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>{collectible.number ?? '—'}</dd>
            </div>
            <div>
              <dt>Rarity</dt>
              <dd>{collectible.rarity ?? '—'}</dd>
            </div>
          </dl>
          <div className="finishes">
            <h3>Finishes</h3>
            <FinishPills
              finishes={collectible.finishes}
              empty={<p className="muted">No finishes recorded</p>}
            />
          </div>
          <div className="binder">
            <h3>Binder location</h3>
            <BinderInfo binder={collectible.binder} layout="grid" />
          </div>
          <div className="card-actions">
            <AddToCollectionButton collectible={collectible} variant="card" />
          </div>
        </article>
      ))}
    </div>
  );
}
