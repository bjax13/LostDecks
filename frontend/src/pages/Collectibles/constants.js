export const categoryLabels = {
  story: "Story",
  herald: "Herald",
  nonsense: "Nonsense",
  pin: "Pin",
};

export const defaultSort = {
  field: "grouped",
  direction: "asc",
};

export const sortOptions = [
  { value: "grouped", label: "Grouped" },
  { value: "number", label: "Card Number", pinLabel: "Pin Number" },
  { value: "id", label: "Card ID", pinLabel: "Pin ID" },
  { value: "category", label: "Category" },
  { value: "story", label: "Story", pinLabel: "Series" },
  { value: "rarity", label: "Rarity", cardsOnly: true },
];

/** Sort labels for the category currently in view. Pins drop card-only sorts. */
export function sortOptionsForView(categoryFilter) {
  const pinView = categoryFilter === "pin";
  return sortOptions
    .filter((option) => !(pinView && option.cardsOnly))
    .map((option) => ({
      value: option.value,
      label: pinView && option.pinLabel ? option.pinLabel : option.label,
    }));
}
