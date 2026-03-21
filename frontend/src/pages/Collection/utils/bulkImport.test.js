import { describe, it, expect } from 'vitest';
import { parseBulkCollectionCsv, createCollectionTemplateCsv } from './bulkImport.js';

describe('bulkImport (unit)', () => {
  describe('parseBulkCollectionCsv', () => {
    it('maps header aliases and normalizes row values', () => {
      const csv = 'sku,qty\nLT24-ELS-01-DUN,3';
      const rows = parseBulkCollectionCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        skuId: 'LT24-ELS-01-DUN',
        quantity: '3',
        __lineNumber: 2,
      });
    });

    it('strips a UTF-8 BOM and ignores blank lines', () => {
      const csv = '\uFEFFskuId,quantity\nLT24-ELS-01-DUN,1\n\n';
      expect(parseBulkCollectionCsv(csv)).toHaveLength(1);
    });

    it('returns an empty array for empty input', () => {
      expect(parseBulkCollectionCsv('')).toEqual([]);
    });
  });

  describe('createCollectionTemplateCsv', () => {
    it('starts with the expected header and includes a known catalog sku', () => {
      const csv = createCollectionTemplateCsv();
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toBe('skuId,quantity,notes');
      expect(csv).toContain('LT24-ELS-01-DUN');
    });
  });
});
