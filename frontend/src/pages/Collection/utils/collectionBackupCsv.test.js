import { describe, expect, it } from "vitest";
import { datasetMeta, getSkuRecord, pinDatasetMeta } from "../../../data/collectibles";
import {
  backupSetNameForCollectible,
  backupTypeForCollectible,
  COLLECTION_BACKUP_HEADERS,
  collectionBackupFilename,
  createCollectionBackupCsv,
} from "./collectionBackupCsv.js";

const HEADER = COLLECTION_BACKUP_HEADERS.join(",");

function linesOf(csv) {
  return csv.split("\n");
}

describe("collectionBackupCsv", () => {
  it("uses stable backup type values and passes unknown catalog types through", () => {
    expect(backupTypeForCollectible(null)).toBe("");
    expect(backupTypeForCollectible({})).toBe("");
    expect(backupTypeForCollectible({ collectibleType: "card" })).toBe("story_card");
    expect(backupTypeForCollectible({ collectibleType: "pin" })).toBe("pin");
    expect(backupTypeForCollectible({ category: "pin" })).toBe("pin");
    expect(backupTypeForCollectible({ collectibleType: "sticker" })).toBe("sticker");
  });

  it("reads the human set name stored on the catalog record", () => {
    expect(backupSetNameForCollectible(null)).toBe("");
    expect(backupSetNameForCollectible({ setName: 12 })).toBe("");
    expect(backupSetNameForCollectible(getSkuRecord("LT24-ELS-01-DUN").card)).toBe(
      datasetMeta.setName,
    );
    expect(backupSetNameForCollectible(getSkuRecord("PIN-CF-01").card)).toBe(
      pinDatasetMeta.setName,
    );
    expect(datasetMeta.setName).toBe("Stormlight Lost Tales — Story Deck");
    expect(pinDatasetMeta.setName).toBe("ChasmFriends Pins");
  });

  it("exports a header-only file when nothing is owned", () => {
    expect(createCollectionBackupCsv()).toBe(HEADER);
    expect(createCollectionBackupCsv({ entries: [] })).toBe(HEADER);
    expect(
      createCollectionBackupCsv({
        entries: [
          { skuId: "LT24-ELS-01-DUN", quantity: 0 },
          { skuId: "PIN-CF-01", quantity: 0 },
          { skuId: "   ", quantity: 4 },
          { quantity: 2 },
        ],
      }),
    ).toBe(HEADER);
  });

  it("exports one row per owned card and pin sku, skipping zeros", () => {
    const earlier = new Date("2026-09-01T12:00:00.000Z");
    const later = new Date("2026-09-03T23:34:00.000Z");
    const csv = createCollectionBackupCsv({
      entries: [
        {
          id: "old",
          skuId: "lt24-els-01-dun",
          quantity: 1,
          notes: "old",
          updatedAt: earlier,
        },
        {
          id: "new",
          skuId: "LT24-ELS-01-DUN",
          quantity: 2,
          notes: "new",
          updatedAt: { toDate: () => later },
        },
        { id: "zero-card", skuId: "LT24-ELS-01-FOIL", quantity: 0, notes: "gone" },
        { id: "pin", skuId: "PIN-CF-01", quantity: 2, updatedAt: later },
        { id: "zero-pin", skuId: "PIN-CF-02", quantity: 0 },
      ],
    });

    expect(linesOf(csv)).toEqual([
      HEADER,
      "story_card,Stormlight Lost Tales — Story Deck,LT24-ELS-01-DUN,Elsecaller #01,DUN,3,new,2026-09-03T23:34:00.000Z",
      "pin,ChasmFriends Pins,PIN-CF-01,Shreadad,,2,,2026-09-03T23:34:00.000Z",
    ]);
    expect(csv).not.toContain("skuId,quantity,notes");
    expect(csv).not.toContain("LT24-ELS-01-FOIL");
    expect(csv).not.toContain("PIN-CF-02");
  });

  it("includes heralds and nonsense as story cards and keeps uncatalogued skus", () => {
    const csv = createCollectionBackupCsv({
      entries: [
        { skuId: "PIN-CF-01", quantity: 1 },
        { skuId: "LT24-HLD-01-DUN", quantity: 1, notes: "  herald note  " },
        { skuId: "LT24-NS-ELS-02-FOIL", count: 2 },
        { skuId: "CUSTOM-1", quantity: 1, notes: 'say "hi", friend' },
      ],
    });
    const lines = linesOf(csv);

    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toContain("story_card,Stormlight Lost Tales — Story Deck,LT24-HLD-01-DUN,");
    expect(lines[1]).toContain(",DUN,1,herald note,");
    expect(lines[2]).toContain(
      "story_card,Stormlight Lost Tales — Story Deck,LT24-NS-ELS-02-FOIL,",
    );
    expect(lines[2]).toContain(",FOIL,2,,");
    expect(lines[3]).toBe("pin,ChasmFriends Pins,PIN-CF-01,Shreadad,,1,,");
    expect(lines[4]).toBe(',,CUSTOM-1,,,1,"say ""hi"", friend",');
    expect(lines.filter((line) => line.startsWith("story_card"))).toHaveLength(2);
  });

  it("keeps older notes when a newer ownership row does not store notes", () => {
    const earlier = new Date("2026-08-01T00:00:00.000Z");
    const later = new Date("2026-08-02T00:00:00.000Z");
    const csv = createCollectionBackupCsv({
      entries: [
        { skuId: "PIN-CF-01", quantity: 1, notes: "bag", updatedAt: earlier },
        { skuId: "PIN-CF-01", quantity: 1, updatedAt: later },
      ],
    });

    expect(linesOf(csv)[1]).toBe(
      "pin,ChasmFriends Pins,PIN-CF-01,Shreadad,,2,bag,2026-08-02T00:00:00.000Z",
    );
  });

  it("clears notes when the latest ownership row stores an empty note", () => {
    const earlier = new Date("2026-08-01T00:00:00.000Z");
    const later = new Date("2026-08-02T00:00:00.000Z");
    const csv = createCollectionBackupCsv({
      entries: [
        { skuId: "PIN-CF-01", quantity: 1, notes: "bag", updatedAt: earlier },
        { skuId: "PIN-CF-01", quantity: 1, notes: "   ", updatedAt: later },
      ],
    });

    expect(linesOf(csv)[1]).toBe(
      "pin,ChasmFriends Pins,PIN-CF-01,Shreadad,,2,,2026-08-02T00:00:00.000Z",
    );
  });

  it("quotes notes that contain commas, quotes, or newlines", () => {
    const csv = createCollectionBackupCsv({
      entries: [{ skuId: "PIN-CF-01", quantity: 1, notes: 'line1\nline2, say "hi"' }],
    });

    expect(csv).toContain('"line1\nline2, say ""hi"""');
  });

  it("floors fractional quantities and ignores non-owned rows", () => {
    const csv = createCollectionBackupCsv({
      entries: [
        { skuId: "PIN-CF-01", quantity: 2.9 },
        { skuId: "PIN-CF-02", quantity: Number.NaN, count: 4 },
        { skuId: "PIN-CF-03", quantity: 0.2 },
      ],
    });
    const lines = linesOf(csv);

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("PIN-CF-01,Shreadad,,2,");
    expect(lines[2]).toContain("PIN-CF-02,Howlerina,,4,");
    expect(csv).not.toContain("PIN-CF-03");
  });

  it("builds a dated backup filename", () => {
    expect(collectionBackupFilename(new Date(2026, 8, 3))).toBe(
      "shardstash-collection-2026-09-03.csv",
    );
    expect(collectionBackupFilename(new Date(2026, 0, 9))).toBe(
      "shardstash-collection-2026-01-09.csv",
    );
  });
});
