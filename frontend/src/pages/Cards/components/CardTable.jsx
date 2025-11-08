import { useNavigate } from 'react-router-dom';
import CategoryPill from './CategoryPill';
import FinishPills from './FinishPills';
import BinderInfo from './BinderInfo';
import AddToCollectionButton from './AddToCollectionButton';
import { categoryLabels } from '../constants';

export default function CardTable({ cards }) {
  const navigate = useNavigate();

  const handleRowClick = (cardId, event) => {
    // Don't navigate if clicking on action buttons
    if (event.target.closest('.add-to-collection')) {
      return;
    }
    navigate(`/cards/${cardId}`);
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
          {cards.map((card) => (
            <tr
              key={card.id}
              className="cards-table__row--clickable"
              onClick={(e) => handleRowClick(card.id, e)}
            >
              <td className="mono">{card.id}</td>
              <td>
                <CategoryPill category={card.category} label={categoryLabels[card.category]} />
              </td>
              <td>{card.storyTitle ?? '—'}</td>
              <td>{card.number ?? '—'}</td>
              <td>
                <div className="cell-title">{card.displayName}</div>
                <div className="cell-subtitle">{card.detail}</div>
              </td>
              <td>{card.rarity ?? '—'}</td>
              <td>
                <FinishPills finishes={card.finishes} />
              </td>
              <td>
                <BinderInfo binder={card.binder} layout="table" />
              </td>
              <td>
                <AddToCollectionButton card={card} variant="table" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
