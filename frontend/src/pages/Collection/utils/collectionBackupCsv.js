import { getSkuRecord } from "../../../data/collectibles";
import { normalizeQuantity, resolveTimestamp } from "../collectionPresentation.jsx";

export const COLLECTION_BACKUP_HEADERS = [
  "type",
  "set",
  "skuId",
  "name",
  "finish",
  "quantity",
  "notes",
  "lastUpdated",
];

/**
 * Backup `type` values. Catalog cards export as `story_card` and pins as `pin`.
 * Unknown catalog types pass through so later types can be added without renaming these.
 */
const BACKUP_TYPE_BY_CATALOG_TYPE = {
  card: "story_card",
  pin: "pin",
};

const BACKUP_TYPE_ORDER = {
  story_card: 0,
  pin: 1,
};

export function backupTypeForCollectible(card) {
  if (!card) {
    return "";
  }
  const catalogType =
    card.collectibleType === "pin" || card.category === "pin"
      ? "pin"
      : (card.collectibleType ?? "");
  if (!catalogType) {
    return "";
  }
  return BACKUP_TYPE_BY_CATALOG_TYPE[catalogType] ?? String(catalogType);
}

export function backupSetNameForCollectible(card) {
  if (typeof card?.setName !== "string") {
    return "";
  }
  return card.setName;
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

function ownedQuantity(entry) {
  return Math.max(0, Math.floor(normalizeQuantity(entry ?? {})));
}

function storedNotes(entry) {
  if (typeof entry?.notes !== "string") {
    return null;
  }
  return entry.notes.trim();
}

function groupOwnedSkus(entries) {
  const grouped = new Map();

  for (const entry of entries ?? []) {
    const rawSkuId = typeof entry?.skuId === "string" ? entry.skuId.trim() : "";
    if (!rawSkuId) {
      continue;
    }

    const key = rawSkuId.toUpperCase();
    const quantity = ownedQuantity(entry);
    const notes = storedNotes(entry);
    const updatedAt = resolveTimestamp(entry);
    const updatedAtMs = updatedAt ? updatedAt.getTime() : null;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        lookupSkuId: key,
        quantity,
        notes,
        notesAtMs: notes == null ? null : updatedAtMs,
        updatedAt,
        updatedAtMs,
      });
      continue;
    }

    existing.quantity += quantity;

    if (
      updatedAtMs != null &&
      (existing.updatedAtMs == null || updatedAtMs >= existing.updatedAtMs)
    ) {
      existing.updatedAt = updatedAt;
      existing.updatedAtMs = updatedAtMs;
    }

    if (notes == null) {
      continue;
    }

    const notesAreNewer =
      existing.notes == null ||
      (updatedAtMs != null && (existing.notesAtMs == null || updatedAtMs >= existing.notesAtMs)) ||
      (updatedAtMs == null && existing.notesAtMs == null);

    if (notesAreNewer) {
      existing.notes = notes;
      existing.notesAtMs = updatedAtMs;
    }
  }

  return [...grouped.values()].filter((row) => row.quantity >= 1);
}

function backupRowFromGroup(group) {
  const sku = getSkuRecord(group.lookupSkuId);
  const card = sku?.card ?? null;
  const finish = sku?.finish ? String(sku.finish).toUpperCase() : "";

  return {
    type: backupTypeForCollectible(card),
    set: backupSetNameForCollectible(card),
    skuId: sku?.skuId ?? group.lookupSkuId,
    name: card?.displayName ?? "",
    finish,
    quantity: String(group.quantity),
    notes: group.notes ?? "",
    lastUpdated: group.updatedAt ? group.updatedAt.toISOString() : "",
  };
}

function compareBackupRows(a, b) {
  const typeA = BACKUP_TYPE_ORDER[a.type] ?? 50;
  const typeB = BACKUP_TYPE_ORDER[b.type] ?? 50;
  if (typeA !== typeB) {
    return typeA - typeB;
  }
  if (a.type !== b.type) {
    return a.type.localeCompare(b.type);
  }
  return a.skuId.localeCompare(b.skuId);
}

/**
 * Backup CSV of owned SKUs (quantity >= 1), all collectible types.
 * Schema is intentionally different from the Story Deck bulk-upload file.
 */
export function createCollectionBackupCsv({ entries = [] } = {}) {
  const rows = groupOwnedSkus(entries).map(backupRowFromGroup).sort(compareBackupRows);
  const lines = [
    COLLECTION_BACKUP_HEADERS,
    ...rows.map((row) => COLLECTION_BACKUP_HEADERS.map((header) => row[header])),
  ];
  return lines.map((line) => line.map(escapeCsvValue).join(",")).join("\n");
}

export function collectionBackupFilename(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `shardstash-collection-${year}-${month}-${day}.csv`;
}
