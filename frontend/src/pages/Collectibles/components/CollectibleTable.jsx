import { useNavigate } from "react-router-dom";
import { categoryLabels } from "../constants";
import AddToCollectionButton from "./AddToCollectionButton";
import BinderInfo from "./BinderInfo";
import CategoryPill from "./CategoryPill";
import FinishPills from "./FinishPills";

export default function CollectibleTable({ collectibles }) {
  const navigate = useNavigate();

  const handleRowClick = (collectibleId, event) => {
    if (event.target.closest(".add-to-collection")) {
      return;
    }
    navigate(`/collectibles/${collectibleId}`);
  };

  return (
    <section className="cards-table-wrapper" aria-label="Collectibles table">
      <table className="cards-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Category</th>
            <th>Story</th>
            <th>#</th>
            <th>Name / Detail</th>
            <th>Rarity</th>
            <th>Finishes</th>
            <th>Binder</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {collectibles.map((collectible) => (
            <tr
              key={collectible.id}
              className="cards-table__row--clickable"
              onClick={(e) => handleRowClick(collectible.id, e)}
            >
              <td className="mono">{collectible.id}</td>
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
              <td>{collectible.rarity ?? "—"}</td>
              <td>
                <FinishPills finishes={collectible.finishes} />
              </td>
              <td>
                <BinderInfo binder={collectible.binder} layout="table" />
              </td>
              <td>
                <AddToCollectionButton collectible={collectible} variant="table" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
