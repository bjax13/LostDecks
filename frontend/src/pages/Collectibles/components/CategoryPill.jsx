import { categoryLabels } from '../constants';

export default function CategoryPill({ category, label }) {
  const displayLabel = label ?? categoryLabels[category] ?? category;
  return <span className={`category-pill ${category}`}>{displayLabel}</span>;
}
