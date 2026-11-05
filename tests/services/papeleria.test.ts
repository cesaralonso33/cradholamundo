import { describe, expect, it } from 'vitest';
import { normalizeOrderItems, assertOrderCanClose } from '../../src/services/papeleria.js';

describe('papeleria order rules', () => {
  it('rejects missing, invalid, or non-positive item quantities', () => {
    expect(() => normalizeOrderItems([])).toThrow();
    expect(() => normalizeOrderItems([{ itemId: 'x', quantity: 0 }])).toThrow();
    expect(() => normalizeOrderItems([{ itemId: 'x', quantity: 1.5 }])).toThrow();
  });

  it('does not allow closing an already closed order', () => {
    expect(() => assertOrderCanClose('CLOSED')).toThrow();
    expect(() => assertOrderCanClose('OPEN')).not.toThrow();
  });
});
