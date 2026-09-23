import { useState } from "react";
import {
  DEFAULT_MANUAL_QUANTITY,
  formatCollectionQuantitySummary,
  formatGroupQuantitySummary,
  formatReviewGroupLabel,
  getDefaultExpandedReviewIds,
  resolveSkuQuantity,
} from "../../pages/GettingStarted/gettingStartedCatalog";

function parseBulkQuantity(value) {
  if (value === "") return { valid: false };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { valid: false };
  return { valid: true, quantity: Math.floor(parsed) };
}

export function useCollectionReviewEditor({
  reviewTree,
  collectibleType,
  coverage,
  setCoverage,
  quantities,
  setQuantities,
  initialExpandedReviewIds = null,
}) {
  const [expandedReviewIds, setExpandedReviewIds] = useState(
    () => initialExpandedReviewIds ?? getDefaultExpandedReviewIds(coverage, reviewTree),
  );
  const [noneConfirmRequest, setNoneConfirmRequest] = useState(null);

  const collectionSummary = formatCollectionQuantitySummary(
    reviewTree,
    coverage,
    quantities,
    DEFAULT_MANUAL_QUANTITY,
    collectibleType,
  );

  const setGroupCoverage = (groupId, status) => {
    setCoverage((current) => ({ ...current, [groupId]: status }));
  };

  const resetExpandedReviewIds = (nextCoverage = coverage) => {
    setExpandedReviewIds(getDefaultExpandedReviewIds(nextCoverage, reviewTree));
  };

  const toggleReviewNode = (nodeId) => {
    setExpandedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const findReviewGroup = (groupId) => {
    for (const section of reviewTree) {
      const group = section.children.find((child) => child.id === groupId);
      if (group) return group;
    }
    return null;
  };

  const syncCoverageAfterQuantityChange = (
    group,
    nextQuantities,
    groupStatus = coverage[group.id],
  ) => {
    if (groupStatus === "some") {
      return;
    }

    const resolved = group.skus.map((sku) =>
      resolveSkuQuantity(sku.skuId, groupStatus, nextQuantities, DEFAULT_MANUAL_QUANTITY),
    );

    const allZero = resolved.every((qty) => qty === 0);
    const anyZero = resolved.some((qty) => qty === 0);
    const anyPositive = resolved.some((qty) => qty > 0);

    if (groupStatus === "all") {
      if (allZero) {
        setGroupCoverage(group.id, "none");
      } else if (anyZero) {
        setGroupCoverage(group.id, "some");
      }
      return;
    }

    if (groupStatus === "none" && anyPositive) {
      setGroupCoverage(group.id, "some");
    }
  };

  const getSkuDisplayQuantity = (skuId, groupId) =>
    String(resolveSkuQuantity(skuId, coverage[groupId], quantities, DEFAULT_MANUAL_QUANTITY));

  const setGroupQuantities = (group, quantity) => {
    const parsed = parseBulkQuantity(String(quantity));
    if (!parsed.valid) return;
    const nextValue = String(parsed.quantity);
    const groupStatus = coverage[group.id];
    const nextQuantities = { ...quantities };
    for (const sku of group.skus) {
      nextQuantities[sku.skuId] = nextValue;
    }
    syncCoverageAfterQuantityChange(group, nextQuantities, groupStatus);
    setQuantities(nextQuantities);
  };

  const fillGroupQuantitiesToAtLeastOne = (group, previousGroupStatus) => {
    setQuantities((current) => {
      const next = { ...current };
      for (const sku of group.skus) {
        const qty = resolveSkuQuantity(
          sku.skuId,
          previousGroupStatus,
          current,
          DEFAULT_MANUAL_QUANTITY,
        );
        if (qty < 1) {
          next[sku.skuId] = "1";
        }
      }
      return next;
    });
  };

  const setReviewGroupCoverage = (group, section, status) => {
    const previousGroupStatus = coverage[group.id];

    setGroupCoverage(group.id, status);

    if (status === "some") {
      setExpandedReviewIds((current) => {
        const next = new Set(current);
        next.add(section.id);
        next.add(group.id);
        return next;
      });
      return;
    }

    if (status === "all") {
      fillGroupQuantitiesToAtLeastOne(group, previousGroupStatus);
      return;
    }

    setQuantities((current) => {
      const next = { ...current };
      for (const sku of group.skus) {
        next[sku.skuId] = "0";
      }
      return next;
    });
  };

  const handleReviewGroupCoverage = (group, section, status) => {
    if (status === "none") {
      if (coverage[group.id] === "none") return;
      const groupTitle = formatReviewGroupLabel(group, section);
      setNoneConfirmRequest({ group, section, groupTitle });
      return;
    }
    setReviewGroupCoverage(group, section, status);
  };

  const confirmNoneCoverage = () => {
    if (!noneConfirmRequest) return;
    setReviewGroupCoverage(noneConfirmRequest.group, noneConfirmRequest.section, "none");
    setNoneConfirmRequest(null);
  };

  const cancelNoneCoverage = () => {
    setNoneConfirmRequest(null);
  };

  const adjustSkuQuantity = (skuId, groupId, delta) => {
    const group = findReviewGroup(groupId);
    if (!group) return;

    const groupStatus = coverage[groupId];
    const base = resolveSkuQuantity(skuId, groupStatus, quantities, DEFAULT_MANUAL_QUANTITY);
    const nextQuantities = {
      ...quantities,
      [skuId]: String(Math.max(0, base + delta)),
    };
    syncCoverageAfterQuantityChange(group, nextQuantities, groupStatus);
    setQuantities(nextQuantities);
  };

  const getGroupSummary = (group) =>
    formatGroupQuantitySummary(group, coverage, quantities, DEFAULT_MANUAL_QUANTITY);

  return {
    coverage,
    quantities,
    expandedReviewIds,
    noneConfirmRequest,
    collectionSummary,
    toggleReviewNode,
    handleReviewGroupCoverage,
    confirmNoneCoverage,
    cancelNoneCoverage,
    setGroupQuantities,
    getSkuDisplayQuantity,
    adjustSkuQuantity,
    getGroupSummary,
    resetExpandedReviewIds,
  };
}
