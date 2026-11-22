import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyBulkCollectionUpdate } from "../Collection/utils/bulkImport.js";
import {
  buildGettingStartedNonDestructiveSaveRows,
  createCoverageState,
  filterGettingStartedTree,
  gettingStartedTree,
} from "./gettingStartedCatalog.js";

const mockBatchDelete = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  doc: (_, id) => ({ id: id ?? "new-doc" }),
  serverTimestamp: () => ({}),
  writeBatch: () => ({
    delete: mockBatchDelete,
    set: mockBatchSet,
    commit: mockBatchCommit,
  }),
}));

vi.mock("../../lib/firebase", () => ({
  db: {},
}));

vi.mock("../../data/collectibles", async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

const PROD_EXISTING = [
  { id: "LT24-CHM-01-DUN", quantity: 1 },
  { id: "PIN-CF-01", quantity: 1 },
];

describe("Getting Started non-destructive save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("emits no rows for an all-None review, so bulk update cannot delete owned SKUs", async () => {
    const reviewTree = filterGettingStartedTree(gettingStartedTree);
    const coverage = createCoverageState("none", reviewTree);
    const rows = buildGettingStartedNonDestructiveSaveRows(coverage, {}, reviewTree, PROD_EXISTING);

    expect(rows).toEqual([]);

    const result = await applyBulkCollectionUpdate({
      ownerUid: "user-1",
      rows,
      existingEntries: PROD_EXISTING,
      allowPins: true,
    });

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });

  it("still allows raising quantity above the owned count", async () => {
    const reviewTree = filterGettingStartedTree(gettingStartedTree);
    const chasmGroup = reviewTree
      .flatMap((section) => section.children)
      .find((group) => group.skus.some((sku) => sku.skuId === "LT24-CHM-01-DUN"));
    const coverage = createCoverageState("none", reviewTree);
    coverage[chasmGroup.id] = "some";
    const rows = buildGettingStartedNonDestructiveSaveRows(
      coverage,
      { "LT24-CHM-01-DUN": "3" },
      reviewTree,
      PROD_EXISTING,
    );

    expect(rows).toEqual([expect.objectContaining({ skuId: "LT24-CHM-01-DUN", quantity: "3" })]);

    await applyBulkCollectionUpdate({
      ownerUid: "user-1",
      rows,
      existingEntries: PROD_EXISTING,
      allowPins: true,
    });

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalled();
  });
});
