import { describe, expect, it } from 'vitest';
import { normalizeMovementInput } from '../../src/services/inventory.js';

describe('normalizeMovementInput', () => {
  it('normalizes direction and preserves only positive integer quantities', () => {
    expect(normalizeMovementInput({ sku: 'A-1', type: 'in', quantity: 3, note: 'restock' })).toEqual({ sku: 'A-1', type: 'IN', quantity: 3, note: 'restock' });
  });

  it('rejects fractional, zero, and invalid movement quantities', () => {
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(() => normalizeMovementInput({ sku: 'A-1', type: 'OUT', quantity })).toThrow();
    }
  });

  it('rejects movement types other than IN and OUT', () => {
    expect(() => normalizeMovementInput({ sku: 'A-1', type: 'TRANSFER', quantity: 1 })).toThrow();
  });
});
