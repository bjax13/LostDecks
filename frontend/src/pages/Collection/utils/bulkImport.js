import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { datasetSkus, getSkuRecord, toSkuId } from "../../../data/collectibles";
import { db } from "../../../lib/firebase";

const csvHeaders = ["skuId", "quantity", "notes"];

export function isPinSkuId(skuId) {
  if (!skuId) {
    return false;
  }
  const record = getSkuRecord(String(skuId).trim());
  if (!record?.card) {
    return false;
  }
  return record.card.collectibleType === "pin" || record.card.category === "pin";
}

export function getStoryDeckCatalogSkus() {
  return datasetSkus.filter((sku) => !isPinSkuId(sku.skuId));
}

function normalizeQuantityValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 0;
}

/**
 * Group collection docs by uppercased skuId.
 * @returns {Map<string, { skuId: string, quantity: number, docs: Array<{id: string, notes?: string}> }>}
 */
export function groupCollectionEntriesBySku(entries) {
  const grouped = new Map();

  for (const entry of entries ?? []) {
    const rawSkuId = typeof entry?.skuId === "string" ? entry.skuId.trim() : "";
    if (!rawSkuId) {
      continue;
    }
    const key = rawSkuId.toUpperCase();
    const quantity = normalizeQuantityValue(
      entry.quantity ?? entry.count ?? entry.copies ?? entry.total,
    );
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        skuId: key,
        quantity,
        docs: [{ id: entry.id, notes: entry.notes }],
      });
      continue;
    }
    existing.quantity += quantity;
    existing.docs.push({ id: entry.id, notes: entry.notes });
  }

  return grouped;
}

function sortStoryDeckSkus(skus) {
  return [...skus].sort((a, b) => {
    const finishA = a.finish ? a.finish.toUpperCase() : "";
    const finishB = b.finish ? b.finish.toUpperCase() : "";

    if (finishA !== finishB) {
      if (!finishA) return 1;
      if (!finishB) return -1;
      if (finishA === "DUN") return -1;
      if (finishB === "DUN") return 1;
      return finishA.localeCompare(finishB);
    }

    return a.cardId.localeCompare(b.cardId);
  });
}

function escapeCsvValue(value) {
  if (value == null) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * @param {"zeros" | "ones" | "current"} mode
 * @param {Array} [entries] required for mode "current"
 */
export function createStoryDeckCollectionCsv({ mode, entries = [] } = {}) {
  if (mode !== "zeros" && mode !== "ones" && mode !== "current") {
    throw new Error(`Unknown Story Deck CSV mode: ${mode}`);
  }

  const ownedBySku = mode === "current" ? groupCollectionEntriesBySku(entries) : null;
  const sortedSkus = sortStoryDeckSkus(getStoryDeckCatalogSkus());

  const rows = sortedSkus.map((sku) => {
    const skuId = String(sku.skuId).toUpperCase();
    let quantity = 0;
    if (mode === "ones") {
      quantity = 1;
    } else if (mode === "current") {
      quantity = ownedBySku.get(skuId)?.quantity ?? 0;
    }
    return [sku.skuId, String(quantity), ""];
  });

  const csvLines = [csvHeaders, ...rows].map((row) => row.map(escapeCsvValue).join(","));
  return csvLines.join("\n");
}

/** @deprecated Prefer createStoryDeckCollectionCsv({ mode: "ones" }) */
export function createCollectionTemplateCsv() {
  return createStoryDeckCollectionCsv({ mode: "ones" });
}

const headerAliases = {
  skuid: "skuId",
  sku: "skuId",
  card: "cardId",
  cardid: "cardId",
  cardcode: "cardId",
  id: "cardId",
  finish: "finish",
  foil: "finish",
  variant: "finish",
  quantity: "quantity",
  qty: "quantity",
  count: "quantity",
  copies: "quantity",
  total: "quantity",
  notes: "notes",
  note: "notes",
};

function normalizeHeader(header) {
  if (!header) {
    return null;
  }
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return headerAliases[normalized] ?? normalized;
}

function sanitizeRows(text) {
  if (typeof text !== "string") {
    return [];
  }

  let source = text;
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }
  source = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }

    if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

export function parseBulkCollectionCsv(text) {
  const matrix = sanitizeRows(text);
  if (matrix.length === 0) {
    return [];
  }

  const headers = matrix[0].map(normalizeHeader);
  const rows = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const rawRow = matrix[i];
    const values = rawRow ?? [];
    if (values.every((value) => (value ?? "").trim().length === 0)) {
      continue;
    }

    const record = { __lineNumber: i + 1 };
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }
      if (record[header] !== undefined) {
        return;
      }
      const value = values[index] ?? "";
      record[header] = value.trim();
    });

    rows.push(record);
  }

  return rows;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUniqueKey(skuId) {
  return skuId ? `sku:${skuId}` : null;
}

export async function applyBulkCollectionUpdate({ ownerUid, rows, existingEntries }) {
  if (!ownerUid) {
    throw new Error("You need to be signed in to update your collection.");
  }

  const existingBySku = groupCollectionEntriesBySku(existingEntries);
  const seenKeys = new Set();
  const operations = [];
  const issues = [];

  let created = 0;
  let updated = 0;
  let deleted = 0;

  const collectionRef = collection(db, "collections");

  rows.forEach((row) => {
    const line = row.__lineNumber ?? "?";
    const rawSku = row.skuId ?? row.skuid ?? null;
    const rawCard = row.cardId ?? row.card ?? null;
    const rawFinish = row.finish ?? null;

    let skuId = rawSku ? String(rawSku).trim().toUpperCase() : null;
    if (!skuId && rawCard && rawFinish) {
      skuId = toSkuId(String(rawCard).trim().toUpperCase(), String(rawFinish).trim().toUpperCase());
    }

    if (!skuId) {
      issues.push({ line, message: "Missing skuId, or cardId+finish." });
      return;
    }

    const skuRecord = getSkuRecord(skuId);
    if (!skuRecord) {
      issues.push({ line, message: `SKU "${skuId}" not found in catalog.` });
      return;
    }

    if (isPinSkuId(skuId)) {
      issues.push({
        line,
        message: "Pins are not included in Story Deck bulk import.",
      });
      return;
    }

    const uniqueKey = toUniqueKey(skuId);
    if (uniqueKey && seenKeys.has(uniqueKey)) {
      issues.push({ line, message: "Duplicate row for the same SKU." });
      return;
    }
    if (uniqueKey) {
      seenKeys.add(uniqueKey);
    }

    const quantityValue = row.quantity ?? null;
    const quantityNumber = toNumber(quantityValue);
    if (quantityNumber === null) {
      return;
    }

    const normalizedQuantity = Math.max(0, Math.round(quantityNumber));
    const existingGroup = existingBySku.get(skuId);
    const existingDocs = existingGroup?.docs ?? [];

    if (normalizedQuantity === 0) {
      existingDocs.forEach((existingDoc) => {
        if (!existingDoc.id) {
          return;
        }
        operations.push({ type: "delete", ref: doc(collectionRef, existingDoc.id) });
        deleted += 1;
      });
      return;
    }

    const keeper = existingDocs[0];
    const docRef = keeper?.id ? doc(collectionRef, keeper.id) : doc(collectionRef);
    const payload = {
      ownerUid,
      skuId,
      quantity: normalizedQuantity,
      updatedAt: serverTimestamp(),
    };
    if (typeof row.notes === "string" && row.notes.trim().length > 0) {
      payload.notes = row.notes.trim();
    }

    operations.push({ type: "set", ref: docRef, data: payload, merge: true });
    if (keeper?.id) {
      updated += 1;
    } else {
      created += 1;
    }

    // Consolidate duplicates: keep one doc, delete the rest.
    for (let index = 1; index < existingDocs.length; index += 1) {
      const extra = existingDocs[index];
      if (!extra?.id) {
        continue;
      }
      operations.push({ type: "delete", ref: doc(collectionRef, extra.id) });
      deleted += 1;
    }
  });

  if (operations.length > 0) {
    const chunkSize = 400;
    for (let start = 0; start < operations.length; start += chunkSize) {
      const batch = writeBatch(db);
      const slice = operations.slice(start, start + chunkSize);
      slice.forEach((operation) => {
        if (operation.type === "delete") {
          batch.delete(operation.ref);
        } else {
          batch.set(operation.ref, operation.data, { merge: operation.merge });
        }
      });
      await batch.commit();
    }
  }

  return {
    created,
    updated,
    deleted,
    issues,
  };
}
