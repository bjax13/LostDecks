import { MAX_COLLECTION_QUANTITY } from "../../../lib/collectionLimits.js";

/**
 * Merge review rows that target the same SKU before bulk import.
 * @param {Array<{ id: string, skuId: string, quantity: number, notes?: string }>} rows
 */
export function mergeDraftRowsForImport(rows) {
  /** @type {Map<string, { skuId: string, quantity: number, notes: string, sourceRowIds: string[] }>} */
  const bySku = new Map();

  for (const row of rows ?? []) {
    const skuId = typeof row.skuId === "string" ? row.skuId.trim().toUpperCase() : "";
    if (!skuId) {
      continue;
    }
    const quantity = Math.min(
      MAX_COLLECTION_QUANTITY,
      Math.max(0, Math.round(Number(row.quantity) || 0)),
    );
    const notes = typeof row.notes === "string" ? row.notes.trim() : "";
    const existing = bySku.get(skuId);
    if (!existing) {
      bySku.set(skuId, {
        skuId,
        quantity,
        notes,
        sourceRowIds: [row.id],
      });
      continue;
    }
    existing.quantity = Math.min(MAX_COLLECTION_QUANTITY, existing.quantity + quantity);
    existing.sourceRowIds.push(row.id);
    if (notes) {
      existing.notes = [existing.notes, notes].filter(Boolean).join(" | ");
    }
  }

  return [...bySku.values()].map((entry, index) => ({
    __lineNumber: index + 1,
    skuId: entry.skuId,
    quantity: String(entry.quantity),
    notes: entry.notes,
    sourceRowIds: entry.sourceRowIds,
  }));
}

/**
 * @param {Array<{ line: string | number, message: string }>} issues
 * @param {ReturnType<typeof mergeDraftRowsForImport>} mergedRows
 */
export function mapImportIssuesToRowIds(issues, mergedRows) {
  const lineToRowIds = new Map(
    mergedRows.map((row) => [String(row.__lineNumber), row.sourceRowIds ?? []]),
  );
  /** @type {Map<string, string>} */
  const messageByRowId = new Map();
  for (const issue of issues ?? []) {
    const rowIds = lineToRowIds.get(String(issue.line)) ?? [];
    for (const rowId of rowIds) {
      messageByRowId.set(rowId, issue.message);
    }
  }
  return messageByRowId;
}
