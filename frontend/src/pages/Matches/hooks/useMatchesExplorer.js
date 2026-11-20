import { useCallback, useMemo, useState } from "react";
import { getSkuRecord, isRetiredPinId } from "../../../data/collectibles";
import { MATCH_LANE_ALL } from "../constants";

const defaultSortState = {
  field: "displayName",
  direction: "asc",
};

export function countTradeItems(counterparty) {
  return (counterparty?.lanes || []).reduce(
    (sum, lane) => sum + lane.theyCanSend.length + lane.youCanSend.length,
    0,
  );
}

function cardMatchesSearch(card, term, skuId) {
  if (!term) return true;
  if (typeof skuId === "string" && skuId.toLowerCase().includes(term)) {
    return true;
  }
  if (!card) return false;
  if (typeof card.searchTokens === "string" && card.searchTokens.includes(term)) {
    return true;
  }
  if (typeof card.id === "string" && card.id.toLowerCase().includes(term)) {
    return true;
  }
  if (typeof card.displayName === "string" && card.displayName.toLowerCase().includes(term)) {
    return true;
  }
  return false;
}

function pileItemMatchesSearch(item, term) {
  return cardMatchesSearch(getSkuRecord(item.skuId)?.card ?? null, term, item.skuId);
}

function laneMatchesSearch(lane, term) {
  if (!term) return true;
  return (
    lane.theyCanSend.some((item) => pileItemMatchesSearch(item, term)) ||
    lane.youCanSend.some((item) => pileItemMatchesSearch(item, term))
  );
}

function lanesForFilter(lanes, laneFilter) {
  if (laneFilter === MATCH_LANE_ALL) {
    return lanes;
  }
  return lanes.filter((lane) => lane.id === laneFilter);
}

function lanesWithoutRetired(lanes) {
  return (lanes || [])
    .map((lane) => ({
      ...lane,
      theyCanSend: (lane.theyCanSend || []).filter((item) => !isRetiredPinId(item.skuId)),
      youCanSend: (lane.youCanSend || []).filter((item) => !isRetiredPinId(item.skuId)),
    }))
    .filter((lane) => lane.theyCanSend.length > 0 || lane.youCanSend.length > 0);
}

function compareCounterparties(a, b, sortField, sortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;

  if (sortField === "tradeCount") {
    const compare = countTradeItems(a) - countTradeItems(b);
    return (compare === 0 ? a.displayName.localeCompare(b.displayName) : compare) * direction;
  }

  const compare = a.displayName.localeCompare(b.displayName);
  return (compare === 0 ? a.userId.localeCompare(b.userId) : compare) * direction;
}

export function useMatchesExplorer({ matches = [] } = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [laneFilter, setLaneFilter] = useState(MATCH_LANE_ALL);
  const [sortField, setSortField] = useState(defaultSortState.field);
  const [sortDirection, setSortDirection] = useState(defaultSortState.direction);

  const listedMatches = useMemo(
    () =>
      matches
        .map((counterparty) => {
          const lanes = lanesWithoutRetired(counterparty.lanes || []);
          if (lanes.length === 0) return null;
          return { ...counterparty, lanes };
        })
        .filter(Boolean),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const items = listedMatches
      .map((counterparty) => {
        const lanes = lanesForFilter(counterparty.lanes || [], laneFilter);
        if (lanes.length === 0) {
          return null;
        }

        if (!term) {
          return { ...counterparty, lanes };
        }

        if (counterparty.displayName?.toLowerCase().includes(term)) {
          return { ...counterparty, lanes };
        }

        const matchingLanes = lanes.filter((lane) => laneMatchesSearch(lane, term));
        if (matchingLanes.length === 0) {
          return null;
        }
        return { ...counterparty, lanes: matchingLanes };
      })
      .filter(Boolean);

    return items.sort((a, b) => compareCounterparties(a, b, sortField, sortDirection));
  }, [listedMatches, searchTerm, laneFilter, sortField, sortDirection]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setLaneFilter(MATCH_LANE_ALL);
    setSortField(defaultSortState.field);
    setSortDirection(defaultSortState.direction);
  }, []);

  return {
    matches: filteredMatches,
    totalMatches: listedMatches.length,
    searchTerm,
    setSearchTerm,
    laneFilter,
    setLaneFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    resetFilters,
  };
}
