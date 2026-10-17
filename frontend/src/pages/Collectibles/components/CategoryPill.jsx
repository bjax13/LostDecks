import { categoryLabels } from "../constants";

/** @param {{ category: string, label?: string }} props */
export default function CategoryPill({ category, label }) {
  const displayLabel = label ?? categoryLabels[category] ?? category;
  return <span className={`category-pill ${category}`}>{displayLabel}</span>;
}
