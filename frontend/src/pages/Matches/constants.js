export const DEFAULT_MATCH_PAGE_SIZE = 20;

export const MATCH_LANE_ALL = "all";

export const matchLaneOptions = [
  { value: MATCH_LANE_ALL, label: "All lanes" },
  { value: "dun", label: "Dun" },
  { value: "foil", label: "Foil" },
  { value: "pins", label: "Pins" },
];

export const matchSortOptions = [
  { value: "displayName", label: "Collector name" },
  { value: "tradeCount", label: "Trade count" },
];

export const matchLaneLabels = {
  dun: "Dun cards",
  foil: "Foil cards",
  pins: "Pins",
};
