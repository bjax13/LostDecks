import { Link } from "react-router-dom";
import AddToCollectionButton from "./AddToCollectionButton";
import BinderInfo from "./BinderInfo";
import CategoryPill from "./CategoryPill";
import FinishPills from "./FinishPills";

export default function CollectibleGrid({ collectibles, ownedBySkuId = {} }) {
  return (
    <div className="cards-grid">
      {collectibles.map((collectible) => (
        <article key={collectible.id} className="card-tile">
          <details className="card-details">
            <summary className="card-glance">
              <CategoryPill category={collectible.category} />
              <h2>{collectible.displayName}</h2>
            </summary>
            <div className="card-details__body">
              <Link to={`/collectibles/${collectible.id}`} className="card-id mono">
                {collectible.id}
              </Link>
              {collectible.detail ? <p className="card-detail">{collectible.detail}</p> : null}
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
            </div>
          </details>
          <div className="card-actions">
            <AddToCollectionButton
              collectible={collectible}
              variant="card"
              ownedBySkuId={ownedBySkuId}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
