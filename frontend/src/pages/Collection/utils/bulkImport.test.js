import { describe, expect, it, vi } from "vitest";
import {
  applyBulkCollectionUpdate,
  createCollectionTemplateCsv,
  parseBulkCollectionCsv,
} from "./bulkImport.js";

const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  doc: (_, id) => ({ id }),
  serverTimestamp: () => ({}),
  writeBatch: () => ({
    delete: vi.fn(),
    set: vi.fn(),
    commit: mockBatchCommit,
  }),
}));

vi.mock("../../../lib/firebase", () => ({
  db: {},
}));

describe("bulkImport (unit)", () => {
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

    it("skips blank rows", () => {
      const csv = "skuId,quantity\nLT24-ELS-01-DUN,1\n  \n  ,  \n";
      const rows = parseBulkCollectionCsv(csv);
      expect(rows).toHaveLength(1);
    });
  });

  describe("createCollectionTemplateCsv", () => {
    it("starts with the expected header and includes a known catalog sku", () => {
      const csv = createCollectionTemplateCsv();
      const firstLine = csv.split("\n")[0];
      expect(firstLine).toBe("skuId,quantity,notes");
      expect(csv).toContain("LT24-ELS-01-DUN");
    });
  });

  describe("applyBulkCollectionUpdate", () => {
    it("throws when ownerUid is missing", async () => {
      await expect(
        applyBulkCollectionUpdate({ rows: [], existingEntries: [] }),
      ).rejects.toThrow("You need to be signed in to update your collection.");
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
      mockBatchCommit.mockClear();
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "2" }],
        existingEntries: [],
      });
      expect(result.created).toBe(1);
      expect(result.issues).toHaveLength(0);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("updates existing entry when row matches existing", async () => {
      mockBatchCommit.mockClear();
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "5" }],
        existingEntries: [{ id: "existing-1", skuId: "LT24-ELS-01-DUN" }],
      });
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("deletes when quantity is 0 and entry exists", async () => {
      mockBatchCommit.mockClear();
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [{ __lineNumber: 2, skuId: "LT24-ELS-01-DUN", quantity: "0" }],
        existingEntries: [{ id: "existing-1", skuId: "LT24-ELS-01-DUN" }],
      });
      expect(result.deleted).toBe(1);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("uses cardId+finish when skuId not provided", async () => {
      const result = await applyBulkCollectionUpdate({
        ownerUid: "u1",
        rows: [
          { __lineNumber: 2, cardId: "LT24-ELS-01", finish: "DUN", quantity: "1" },
        ],
        existingEntries: [],
      });
      expect(result.created).toBe(1);
      expect(result.issues).toHaveLength(0);
    });
  });
});
