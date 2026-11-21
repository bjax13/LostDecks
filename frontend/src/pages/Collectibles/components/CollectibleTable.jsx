import { useNavigate } from "react-router-dom";
import PinImage from "../../../components/PinImage/PinImage.jsx";
import TradeFlagTag from "../../../components/TradeFlagTag.jsx";
import { resolveSkuId } from "../../../data/collectibles";
import { collectibleDetailPath } from "../../../lib/collectibleDetailPath";
import { normalizeTradeFlag } from "../../../lib/tradeFlag.js";
import { categoryLabels } from "../constants";
import AddToCollectionButton from "./AddToCollectionButton";
import BinderInfo from "./BinderInfo";
import CategoryPill from "./CategoryPill";
import CollectibleDetailsLink from "./CollectibleDetailsLink";
import FinishPills from "./FinishPills";

function isPinCollectible(collectible) {
  return collectible?.collectibleType === "pin" || collectible?.category === "pin";
}

function tradeFlagByFinish(collectible, tradeFlagBySkuId) {
  const flags = {};
  for (const finish of collectible?.finishes ?? []) {
    const skuId = resolveSkuId(collectible, finish);
    const flag = normalizeTradeFlag(tradeFlagBySkuId?.[skuId]);
    if (flag) flags[finish] = flag;
  }
  return flags;
}

function pinTradeFlag(collectible, tradeFlagBySkuId) {
  const skuId = resolveSkuId(collectible, null);
  return normalizeTradeFlag(tradeFlagBySkuId?.[skuId]);
}

export default function CollectibleTable({
  collectibles,
  ownedBySkuId = {},
  tradeFlagBySkuId = {},
  deleteWhenZero = true,
  onQuantityChange,
}) {
  const navigate = useNavigate();
  const pinsOnly =
    collectibles.length > 0 && collectibles.every((collectible) => isPinCollectible(collectible));

  const handleRowClick = (collectibleId, event) => {
    if (event.target.closest(".add-to-collection, a, button")) {
      return;
    }
    const path = collectibleDetailPath(collectibleId);
    if (path) {
      navigate(path);
    }
  };

  return (
    <section className="cards-table-wrapper" aria-label="Collectibles table">
      <table className="cards-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Category</th>
            <th>{pinsOnly ? "Series" : "Story"}</th>
            <th>#</th>
            <th>Name / Detail</th>
            {pinsOnly ? null : (
              <>
                <th>Rarity</th>
                <th>Finishes</th>
                <th>Binder</th>
              </>
            )}
            <th>Actions</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {collectibles.map((collectible) => {
            const pin = isPinCollectible(collectible);
            return (
              <tr
                key={collectible.id}
                className="cards-table__row--clickable"
                onClick={(e) => handleRowClick(collectible.id, e)}
              >
                <td className="mono">
                  <div className="cards-table__identity">
                    {pin ? (
                      <PinImage
                        pinId={collectible.id}
                        name={collectible.displayName}
                        image={collectible.image}
                        variant="row"
                      />
                    ) : null}
                    <span>{collectible.id}</span>
                  </div>
                </td>
                <td>
                  <CategoryPill
                    category={collectible.category}
                    label={categoryLabels[collectible.category]}
                  />
                </td>
                <td>{collectible.storyTitle ?? "—"}</td>
                <td>{collectible.number ?? "—"}</td>
                <td>
                  <div className="cell-title">{collectible.displayName}</div>
                  <div className="cell-subtitle">{collectible.detail}</div>
                </td>
                {pinsOnly ? null : pin ? (
                  <>
                    <td />
                    <td>
                      {pinTradeFlag(collectible, tradeFlagBySkuId) ? (
                        <TradeFlagTag flag={pinTradeFlag(collectible, tradeFlagBySkuId)} />
                      ) : null}
                    </td>
                    <td />
                  </>
                ) : (
                  <>
                    <td>{collectible.rarity ?? "—"}</td>
                    <td>
                      <FinishPills
                        finishes={collectible.finishes}
                        tradeFlagByFinish={tradeFlagByFinish(collectible, tradeFlagBySkuId)}
                      />
                    </td>
                    <td>
                      <BinderInfo binder={collectible.binder} layout="table" />
                    </td>
                  </>
                )}
                <td>
                  <AddToCollectionButton
                    collectible={collectible}
                    variant="table"
                    ownedBySkuId={ownedBySkuId}
                    tradeFlagBySkuId={tradeFlagBySkuId}
                    deleteWhenZero={deleteWhenZero}
                    onQuantityChange={onQuantityChange}
                  />
                </td>
                <td className="cards-table__details">
                  <CollectibleDetailsLink
                    collectibleId={collectible.id}
                    name={collectible.displayName}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
