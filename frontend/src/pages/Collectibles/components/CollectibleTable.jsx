import { useNavigate } from 'react-router-dom';
import CategoryPill from './CategoryPill';
import FinishPills from './FinishPills';
import BinderInfo from './BinderInfo';
import AddToCollectionButton from './AddToCollectionButton';
import { categoryLabels } from '../constants';

export default function CollectibleTable({ collectibles }) {
  const navigate = useNavigate();

  const handleRowClick = (collectibleId, event) => {
    if (event.target.closest('.add-to-collection')) {
      return;
    }
    navigate(`/collectibles/${collectibleId}`);
  };

  return (
    <div className="cards-table-wrapper">
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
              <td>{collectible.storyTitle ?? '—'}</td>
              <td>{collectible.number ?? '—'}</td>
              <td>
                <div className="cell-title">{collectible.displayName}</div>
                <div className="cell-subtitle">{collectible.detail}</div>
              </td>
              <td>{collectible.rarity ?? '—'}</td>
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
    </div>
  );
}
