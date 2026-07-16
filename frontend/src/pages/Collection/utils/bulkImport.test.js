import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyBulkCollectionUpdate,
  createCollectionTemplateCsv,
  createStoryDeckCollectionCsv,
  groupCollectionEntriesBySku,
  isPinSkuId,
  parseBulkCollectionCsv,
} from "./bulkImport.js";

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

vi.mock("../../../lib/firebase", () => ({
  db: {},
}));

const collectiblesState = vi.hoisted(() => ({
  skus: [
    { skuId: "LT24-ELS-01-DUN", cardId: "LT24-ELS-01", finish: "DUN" },
    { skuId: "LT24-ELS-01-FOIL", cardId: "LT24-ELS-01", finish: "FOIL" },
    { skuId: "PIN-CF-01", cardId: "PIN-CF-01", finish: null },
  ],
  records: {
    "LT24-ELS-01-DUN": {
      skuId: "LT24-ELS-01-DUN",
      cardId: "LT24-ELS-01",
      finish: "DUN",
      card: { collectibleType: "card", category: "story" },
    },
    "LT24-ELS-01-FOIL": {
      skuId: "LT24-ELS-01-FOIL",
      cardId: "LT24-ELS-01",
      finish: "FOIL",
      card: { collectibleType: "card", category: "story" },
    },
    "PIN-CF-01": {
      skuId: "PIN-CF-01",
      cardId: "PIN-CF-01",
      finish: null,
      card: { collectibleType: "pin", category: "pin" },
    },
  },
}));

vi.mock("../../../data/collectibles", () => ({
  get datasetSkus() {
    return collectiblesState.skus;
  },
  getSkuRecord: (skuId) => collectiblesState.records[skuId] ?? null,
  toSkuId: (cardId, finish) => `${cardId}-${finish}`,
}));

describe("bulkImport (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  describe("parseBulkCollectionCsv", () => {
    it("maps header aliases and normalizes row values", () => {
      const csv = "sku,qty\nLT24-ELS-01-DUN,3";
      const rows = parseBulkCollectionCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        skuId: "LT24-ELS-01-DUN",
        quantity: "3",
        __lineNumber: 2,
      });
    });

    it("strips a UTF-8 BOM and ignores blank lines", () => {
      const csv = "\uFEFFskuId,quantity\nLT24-ELS-01-DUN,1\n\n";
      expect(parseBulkCollectionCsv(csv)).toHaveLength(1);
    });

    it("returns an empty array for empty input", () => {
      expect(parseBulkCollectionCsv("")).toEqual([]);
    });
  });

  describe("pin helpers and grouping", () => {
    it("detects pin SKUs", () => {
      expect(isPinSkuId("PIN-CF-01")).toBe(true);
      expect(isPinSkuId("LT24-ELS-01-DUN")).toBe(false);
    });

    it("groups and sums duplicate collection docs by skuId", () => {
      const grouped = groupCollectionEntriesBySku([
        { id: "a", skuId: "LT24-ELS-01-DUN", quantity: 1 },
        { id: "b", skuId: "lt24-els-01-dun", quantity: 2 },
        { id: "c", skuId: "LT24-ELS-01-FOIL", quantity: 1 },
      ]);
      expect(grouped.get("LT24-ELS-01-DUN").quantity).toBe(3);
      expect(grouped.get("LT24-ELS-01-DUN").docs).toHaveLength(2);
      expect(grouped.get("LT24-ELS-01-FOIL").quantity).toBe(1);
    });
  });

  describe("createStoryDeckCollectionCsv", () => {
    it("exports all 0s without pins", () => {
      const csv = createStoryDeckCollectionCsv({ mode: "zeros" });
      expect(csv.split("\n")[0]).toBe("skuId,quantity,notes");
      expect(csv).toContain("LT24-ELS-01-DUN,0,");
      expect(csv).toContain("LT24-ELS-01-FOIL,0,");
      expect(csv).not.toContain("PIN-CF-01");
    });

    it("exports all 1s without pins", () => {
      const csv = createStoryDeckCollectionCsv({ mode: "ones" });
      expect(csv).toContain("LT24-ELS-01-DUN,1,");
      expect(csv).toContain("LT24-ELS-01-FOIL,1,");
      expect(csv).not.toContain("PIN-CF-01");
    });

    it("exports current aggregated quantities without pins", () => {
      const csv = createStoryDeckCollectionCsv({
        mode: "current",
        entries: [
          { id: "a", skuId: "LT24-ELS-01-DUN", quantity: 1 },
          { id: "b", skuId: "LT24-ELS-01-DUN", quantity: 2 },
          { id: "pin", skuId: "PIN-CF-01", quantity: 9 },
        ],
      });
      expect(csv).toContain("LT24-ELS-01-DUN,3,");
      expect(csv).toContain("LT24-ELS-01-FOIL,0,");
      expect(csv).not.toContain("PIN-CF-01");
    });

    it("keeps createCollectionTemplateCsv as all-1s Story Deck export", () => {
      expect(createCollectionTemplateCsv()).toBe(createStoryDeckCollectionCsv({ mode: "ones" }));
    });
  });

  describe("applyBulkCollectionUpdate", () => {
    it("throws when ownerUid is missing", async () => {
      await expect(applyBulkCollectionUpdate({ rows: [], existingEntries: [] })).rejects.toThrow(
        "You need to be signed in to update your collection.",
      );
    });

    it("returns issues when skuId and cardId+finish are missing", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, quantity: "1" }],
        existingEntries: [],
      });
      expect(result.issues).toContainEqual({
        line: 2,
        message: "Missing skuId, or cardId+finish.",
      });
      expect(result.created).toBe(0);
    });

    it("returns issues when SKU not in catalog", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "UNKNOWN-SKU", quantity: "1" }],
        existingEntries: [],
      });
      expect(result.issues).toContainEqual({
        line: 2,
        message: 'SKU "UNKNOWN-SKU" not found in catalog.',
      });
    });

    it("skips pin SKUs without mutating them", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "PIN-CF-01", quantity: "5" }],
        existingEntries: [{ id: "pin-doc", skuId: "PIN-CF-01", quantity: 1 }],
      });
      expect(result.issues).toContainEqual({
        line: 2,
        message: "Pins are not included in Story Deck bulk import.",
      });
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it("returns issues when duplicate SKU in rows", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [
          { __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "1" },
          { __lineNumber: 3, skuId: "LT24-ELS-01-DUN", quantity: "2" },
        ],
        existingEntries: [],
      });
      expect(result.issues).toContainEqual({
        line: 3,
        message: "Duplicate row for the same SKU.",
      });
    });

    it("creates new entry for valid row", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "2" }],
        existingEntries: [],
      });
      expect(result.created).toBe(1);
      expect(result.issues).toHaveLength(0);
      expect(mockBatchSet).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("sets absolute quantity on existing entry", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "5" }],
        existingEntries: [{ id: "existing-1", skuId: "LT24-ELS-01-DUN", quantity: 2 }],
      });
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(mockBatchSet).toHaveBeenCalledWith(
        { id: "existing-1" },
        expect.objectContaining({ quantity: 5 }),
        { merge: true },
      );
    });

    it("deletes all duplicate docs when quantity is 0", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "0" }],
        existingEntries: [
          { id: "existing-1", skuId: "LT24-ELS-01-DUN", quantity: 1 },
          { id: "existing-2", skuId: "LT24-ELS-01-DUN", quantity: 1 },
        ],
      });
      expect(result.deleted).toBe(2);
      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    });

    it("consolidates duplicate docs when setting a positive absolute quantity", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "4" }],
        existingEntries: [
          { id: "keep", skuId: "LT24-ELS-01-DUN", quantity: 1 },
          { id: "dup", skuId: "LT24-ELS-01-DUN", quantity: 1 },
        ],
      });
      expect(result.updated).toBe(1);
      expect(result.deleted).toBe(1);
      expect(mockBatchSet).toHaveBeenCalledWith(
        { id: "keep" },
        expect.objectContaining({ quantity: 4 }),
        { merge: true },
      );
      expect(mockBatchDelete).toHaveBeenCalledWith({ id: "dup" });
    });

    it("uses cardId+finish when skuId not provided", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, cardId: "LT24-ELS-01", finish: "DUN", quantity: "1" }],
        existingEntries: [],
      });
      expect(result.created).toBe(1);
      expect(result.issues).toHaveLength(0);
    });
  });
});
