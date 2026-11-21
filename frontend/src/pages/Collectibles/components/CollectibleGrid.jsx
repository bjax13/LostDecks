import { Link } from "react-router-dom";
import PinImage from "../../../components/PinImage/PinImage.jsx";
import { collectibleDetailPath } from "../../../lib/collectibleDetailPath";
import AddToCollectionButton from "./AddToCollectionButton";
import BinderInfo from "./BinderInfo";
import CategoryPill from "./CategoryPill";
import CollectibleDetailsLink from "./CollectibleDetailsLink";
import FinishPills from "./FinishPills";

function isPinCollectible(collectible) {
  return collectible?.collectibleType === "pin" || collectible?.category === "pin";
}

export default function CollectibleGrid({
  collectibles,
  ownedBySkuId = {},
  tradeFlagBySkuId = {},
  deleteWhenZero = true,
  onQuantityChange,
}) {
  return (
    <div className="cards-grid">
      {collectibles.map((collectible) => {
        const pin = isPinCollectible(collectible);
        return (
          <article key={collectible.id} className="card-tile">
            <div className="card-header">
              <details className="card-details">
                <summary className={pin ? "card-glance card-glance--pin" : "card-glance"}>
                  {pin ? (
                    <PinImage
                      pinId={collectible.id}
                      name={collectible.displayName}
                      image={collectible.image}
                      variant="grid"
                    />
                  ) : null}
                  <div className="card-glance__body">
                    <div className="card-glance__meta">
                      <CategoryPill category={collectible.category} />
                    </div>
                    <h2>{collectible.displayName}</h2>
                  </div>
                </summary>
                <div className="card-details__body">
                  <Link
                    to={collectibleDetailPath(collectible.id)}
                    className="card-id card-id--link mono"
                  >
                    {collectible.id}
                  </Link>
                  {collectible.detail ? <p className="card-detail">{collectible.detail}</p> : null}
                  <dl className={pin ? "card-stats card-stats--pin" : "card-stats"}>
                    <div className={pin ? "card-stats__wide" : undefined}>
                      <dt>{pin ? "Series" : "Story"}</dt>
                      <dd>{collectible.storyTitle ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Number</dt>
                      <dd>{collectible.number ?? "—"}</dd>
                    </div>
                    {pin ? (
                      <>
                        {collectible.country ? (
                          <div>
                            <dt>Country</dt>
                            <dd>{collectible.country}</dd>
                          </div>
                        ) : null}
                        {collectible.release ? (
                          <div className="card-stats__wide">
                            <dt>Release</dt>
                            <dd>{collectible.release}</dd>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div>
                        <dt>Rarity</dt>
                        <dd>{collectible.rarity ?? "—"}</dd>
                      </div>
                    )}
                  </dl>
                  {pin ? null : (
                    <>
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
                    </>
                  )}
                </div>
              </details>
              <CollectibleDetailsLink
                collectibleId={collectible.id}
                name={collectible.displayName}
                className="card-details-link"
              />
            </div>
            <div className="card-actions">
              <AddToCollectionButton
                collectible={collectible}
                variant="card"
                ownedBySkuId={ownedBySkuId}
                tradeFlagBySkuId={tradeFlagBySkuId}
                deleteWhenZero={deleteWhenZero}
                onQuantityChange={onQuantityChange}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
