import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyBulkCollectionUpdate } from "../Collection/utils/bulkImport.js";
import {
  buildGettingStartedManualReviewSaveRows,
  buildGettingStartedNonDestructiveSaveRows,
  createCoverageState,
  filterChasmFriendsTree,
  filterGettingStartedTree,
  gettingStartedTree,
  isCollectionConfirmedLoadedForOwner,
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

describe("Getting Started explicit None removals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("deletes owned SKUs in a group the user explicitly set to None when collection is loaded", async () => {
    const reviewTree = filterGettingStartedTree(gettingStartedTree);
    const chasmGroup = reviewTree
      .flatMap((section) => section.children)
      .find((group) => group.skus.some((sku) => sku.skuId === "LT24-CHM-01-DUN"));
    const coverage = createCoverageState("all", reviewTree);
    coverage[chasmGroup.id] = "none";
    const explicitZeroGroupIds = new Set([chasmGroup.id]);

    const rows = buildGettingStartedManualReviewSaveRows(coverage, {}, reviewTree, PROD_EXISTING, {
      explicitZeroGroupIds,
      collectionConfirmedLoaded: true,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skuId: "LT24-CHM-01-DUN", quantity: "0" }),
      ]),
    );
    expect(rows.some((row) => row.skuId === "PIN-CF-01")).toBe(false);

    const result = await applyBulkCollectionUpdate({
      ownerUid: "user-1",
      rows,
      existingEntries: PROD_EXISTING,
      allowPins: true,
    });

    expect(mockBatchDelete).toHaveBeenCalled();
    expect(result.deleted).toBeGreaterThan(0);
  });

  it("does not emit deletes for untouched all-None review or when collection is not loaded", async () => {
    const reviewTree = filterGettingStartedTree(gettingStartedTree);
    const coverage = createCoverageState("none", reviewTree);
    const chasmGroup = reviewTree
      .flatMap((section) => section.children)
      .find((group) => group.skus.some((sku) => sku.skuId === "LT24-CHM-01-DUN"));

    expect(
      buildGettingStartedManualReviewSaveRows(coverage, {}, reviewTree, PROD_EXISTING, {
        explicitZeroGroupIds: new Set(),
        collectionConfirmedLoaded: true,
      }),
    ).toEqual([]);

    const explicitNone = buildGettingStartedManualReviewSaveRows(
      coverage,
      {},
      reviewTree,
      PROD_EXISTING,
      { explicitZeroGroupIds: new Set([chasmGroup.id]), collectionConfirmedLoaded: false },
    );
    expect(explicitNone).toEqual([]);

    await applyBulkCollectionUpdate({
      ownerUid: "user-1",
      rows: explicitNone,
      existingEntries: PROD_EXISTING,
      allowPins: true,
    });
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });

  it("ignores unresolvable existing docs when building explicit-None deletes", () => {
    const reviewTree = filterGettingStartedTree(gettingStartedTree);
    const chasmGroup = reviewTree
      .flatMap((section) => section.children)
      .find((group) => group.skus.some((sku) => sku.skuId === "LT24-CHM-01-DUN"));
    const coverage = createCoverageState("none", reviewTree);
    coverage[chasmGroup.id] = "none";
    const existing = [
      { id: "weird-doc", quantity: 1 },
      { id: "LT24-CHM-01-DUN", quantity: 1 },
    ];

    const rows = buildGettingStartedManualReviewSaveRows(coverage, {}, reviewTree, existing, {
      explicitZeroGroupIds: new Set([chasmGroup.id]),
      collectionConfirmedLoaded: true,
    });

    expect(rows).toEqual([expect.objectContaining({ skuId: "LT24-CHM-01-DUN", quantity: "0" })]);
    expect(rows.some((row) => row.skuId === "weird-doc")).toBe(false);
  });

  it("isCollectionConfirmedLoadedForOwner gates deletes without review UI hydration", () => {
    expect(
      isCollectionConfirmedLoadedForOwner({ ownerUid: "user-1", collectionReady: false }),
    ).toBe(false);
    expect(isCollectionConfirmedLoadedForOwner({ ownerUid: null, collectionReady: false })).toBe(
      false,
    );
    expect(isCollectionConfirmedLoadedForOwner({ ownerUid: "user-1", collectionReady: true })).toBe(
      true,
    );
  });

  it("does not emit zero rows for owned SKUs left unselected after partial edit (no explicit None)", () => {
    const reviewTree = filterGettingStartedTree(gettingStartedTree);
    const chasmGroup = reviewTree
      .flatMap((section) => section.children)
      .find((group) => group.skus.some((sku) => sku.skuId === "LT24-CHM-01-DUN"));
    const keptSku = "LT24-CHM-01-DUN";
    const otherSku = chasmGroup.skus.find((sku) => sku.skuId !== keptSku)?.skuId;
    expect(otherSku).toBeTruthy();

    const coverage = createCoverageState("none", reviewTree);
    coverage[chasmGroup.id] = "some";
    const existing = [
      { id: keptSku, quantity: 1 },
      { id: otherSku, quantity: 1 },
    ];

    const rows = buildGettingStartedManualReviewSaveRows(
      coverage,
      { [keptSku]: "1", [otherSku]: "0" },
      reviewTree,
      existing,
      { explicitZeroGroupIds: new Set(), collectionConfirmedLoaded: true },
    );

    expect(rows.some((row) => row.skuId === otherSku && row.quantity === "0")).toBe(false);
    expect(rows.filter((row) => Number(row.quantity) === 0)).toEqual([]);
  });

  it("allows explicit None deletes on the Chasm Friends tree when collection is confirmed loaded", () => {
    const reviewTree = filterChasmFriendsTree();
    const pinGroup = reviewTree
      .flatMap((section) => section.children)
      .find((group) => group.skus.some((sku) => sku.skuId === "PIN-CF-01"));
    const coverage = createCoverageState("all", reviewTree);
    coverage[pinGroup.id] = "none";

    const rows = buildGettingStartedManualReviewSaveRows(coverage, {}, reviewTree, PROD_EXISTING, {
      explicitZeroGroupIds: new Set([pinGroup.id]),
      collectionConfirmedLoaded: true,
    });

    expect(rows).toEqual([expect.objectContaining({ skuId: "PIN-CF-01", quantity: "0" })]);
  });
});
