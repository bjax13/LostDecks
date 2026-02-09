import { describe, expect, it } from 'vitest';
import { parseBulkCollectionCsv } from './bulkImport';

describe('parseBulkCollectionCsv', () => {
  it('returns [] for empty input', () => {
    expect(parseBulkCollectionCsv('')).toEqual([]);
    expect(parseBulkCollectionCsv('   ')).toEqual([]);
    expect(parseBulkCollectionCsv(null)).toEqual([]);
  });

  it('normalizes header aliases and trims values', () => {
    const csv = [
      'card,qty,finish,notes',
      ' LT24-S-001 , 2 , dun ,  hello ',
      'LT24-S-002,0,FOIL,',
    ].join('\n');

    const rows = parseBulkCollectionCsv(csv);

    expect(rows).toEqual([
      {
        __lineNumber: 2,
        cardId: 'LT24-S-001',
        quantity: '2',
        finish: 'dun',
        notes: 'hello',
      },
      {
        __lineNumber: 3,
        cardId: 'LT24-S-002',
        quantity: '0',
        finish: 'FOIL',
        notes: '',
      },
    ]);
  });

  it('handles BOM and quoted fields with commas', () => {
    const csv = [
      '\uFEFFcardId,quantity,notes',
      'LT24-S-001,1,"hello, world"',
    ].join('\n');

    const rows = parseBulkCollectionCsv(csv);

    expect(rows).toEqual([
      {
        __lineNumber: 2,
        cardId: 'LT24-S-001',
        quantity: '1',
        notes: 'hello, world',
      },
    ]);
  });
});
