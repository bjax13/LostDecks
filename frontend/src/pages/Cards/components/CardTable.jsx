import CategoryPill from './CategoryPill';
import FinishPills from './FinishPills';
import BinderInfo from './BinderInfo';
import { categoryLabels } from '../constants';

export default function CardTable({ cards }) {
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
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
