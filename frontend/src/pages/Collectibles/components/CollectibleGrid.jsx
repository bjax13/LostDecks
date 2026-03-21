import { Link } from "react-router-dom";
import AddToCollectionButton from "./AddToCollectionButton";
import BinderInfo from "./BinderInfo";
import CategoryPill from "./CategoryPill";
import FinishPills from "./FinishPills";

export default function CollectibleGrid({ collectibles }) {
  return (
    <div className="cards-grid">
      {collectibles.map((collectible) => (
        <Link
          key={collectible.id}
          to={`/collectibles/${collectible.id}`}
          className="card-tile card-tile--clickable"
          onClick={(e) => {
            if (e.target.closest(".card-actions")) {
              e.preventDefault();
            }
          }}
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
              <dd>{collectible.storyTitle ?? "—"}</dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>{collectible.number ?? "—"}</dd>
            </div>
            <div>
              <dt>Rarity</dt>
              <dd>{collectible.rarity ?? "—"}</dd>
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
        </Link>
      ))}
    </div>
  );
}
