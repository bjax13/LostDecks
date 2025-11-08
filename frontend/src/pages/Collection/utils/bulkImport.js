import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
  datasetSkus,
  getCardRecord,
  getSkuRecord
} from '../../../data/cards';

const csvHeaders = ['skuId', 'cardId', 'story', 'category', 'finish', 'displayName', 'quantity'];

function escapeCsvValue(value) {
  if (value == null) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function createCollectionTemplateCsv() {
  const sortedSkus = [...datasetSkus].sort((a, b) => {
    const finishA = a.finish.toUpperCase();
    const finishB = b.finish.toUpperCase();
    
    // Sort by finish: DUN comes before FOIL
    if (finishA !== finishB) {
      if (finishA === 'DUN') return -1;
      if (finishB === 'DUN') return 1;
      return finishA.localeCompare(finishB);
    }
    
    // Secondary sort by cardId within each finish group
    return a.cardId.localeCompare(b.cardId);
  });

  const rows = sortedSkus.map((sku) => {
    const card = getCardRecord(sku.cardId);
    return [
      sku.skuId,
      sku.cardId,
      card?.storyTitle ?? '',
      card?.category ?? '',
      sku.finish.toUpperCase(),
      card?.displayName ?? '',
      ''
    ];
  });

  const csvLines = [csvHeaders, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  return csvLines.join('\n');
}

const headerAliases = {
  card: 'cardId',
  cardid: 'cardId',
  cardcode: 'cardId',
  id: 'cardId',
  skuid: 'skuId',
  sku: 'skuId',
  finish: 'finish',
  foil: 'finish',
  variant: 'finish',
  quantity: 'quantity',
  qty: 'quantity',
  count: 'quantity',
  copies: 'quantity',
  total: 'quantity',
  notes: 'notes',
  note: 'notes'
};

function normalizeHeader(header) {
  if (!header) {
    return null;
  }
  const normalized = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return headerAliases[normalized] ?? normalized;
}

function sanitizeRows(text) {
  if (typeof text !== 'string') {
    return [];
  }

  let source = text;
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }
  source = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows = [];
  let current = '';
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

    if (char === ',') {
      row.push(current);
      current = '';
      continue;
    }

    if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
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
    if (values.every((value) => (value ?? '').trim().length === 0)) {
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
      const value = values[index] ?? '';
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
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUniqueKey(skuId, cardId) {
  if (skuId) {
    return `sku:${skuId}`;
  }
  if (cardId) {
    return `card:${cardId}`;
  }
  return null;
}

export async function applyBulkCollectionUpdate({ ownerUid, rows, existingEntries }) {
  if (!ownerUid) {
    throw new Error('You need to be signed in to update your collection.');
  }

  const existingBySku = new Map();
  const existingByCard = new Map();

  (existingEntries ?? []).forEach((entry) => {
    if (entry.skuId) {
      existingBySku.set(String(entry.skuId).toUpperCase(), entry);
    }
    if (entry.cardId) {
      existingByCard.set(String(entry.cardId).toUpperCase(), entry);
    }
  });

  const seenKeys = new Set();
  const operations = [];
  const issues = [];

  let created = 0;
  let updated = 0;
  let deleted = 0;

  const collectionRef = collection(db, 'collections');

  rows.forEach((row) => {
    const line = row.__lineNumber ?? '?';
    const rawSku = row.skuId ?? row.skuid ?? null;
    const rawCard = row.cardId ?? row.card ?? null;
    const skuId = rawSku ? String(rawSku).toUpperCase() : null;
    let cardId = rawCard ? String(rawCard).toUpperCase() : null;

    if (!skuId && !cardId) {
      issues.push({ line, message: 'Missing SKU or card identifier.' });
      return;
    }

    const uniqueKey = toUniqueKey(skuId, cardId);
    if (uniqueKey && seenKeys.has(uniqueKey)) {
      issues.push({ line, message: 'Duplicate row for the same card or SKU.' });
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

    const skuRecord = skuId ? getSkuRecord(skuId) : null;
    const cardRecord = skuRecord?.card ?? (cardId ? getCardRecord(cardId) : null);

    if (!cardRecord) {
      issues.push({ line, message: 'Card could not be found in the Stormlight Lost Tales catalog.' });
      return;
    }

    if (!cardId && cardRecord?.id) {
      cardId = cardRecord.id;
    }

    let finish = row.finish ? String(row.finish).toUpperCase() : null;
    if (!finish && skuRecord?.finish) {
      finish = skuRecord.finish;
    }

    const existing = skuId
      ? existingBySku.get(skuId)
      : existingByCard.get(cardId ?? '');

    if (normalizedQuantity === 0) {
      if (existing) {
        operations.push({ type: 'delete', ref: doc(collectionRef, existing.id) });
        deleted += 1;
      }
      return;
    }

    const docRef = existing ? doc(collectionRef, existing.id) : doc(collectionRef);
    const payload = {
      ownerUid,
      quantity: normalizedQuantity,
      updatedAt: serverTimestamp()
    };

    if (cardId) {
      payload.cardId = cardId;
    }
    if (skuId) {
      payload.skuId = skuId;
    }
    if (finish) {
      payload.finish = finish;
    }

    if (typeof row.notes === 'string' && row.notes.trim().length > 0) {
      payload.notes = row.notes.trim();
    }

    operations.push({ type: 'set', ref: docRef, data: payload, merge: true });
    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  });

  if (operations.length > 0) {
    const chunkSize = 400;
    for (let start = 0; start < operations.length; start += chunkSize) {
      const batch = writeBatch(db);
      const slice = operations.slice(start, start + chunkSize);
      slice.forEach((operation) => {
        if (operation.type === 'delete') {
          batch.delete(operation.ref);
        } else {
          batch.set(operation.ref, operation.data, { merge: operation.merge });
        }
      });
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
    }
  }

  return {
    created,
    updated,
    deleted,
    issues
  };
}
