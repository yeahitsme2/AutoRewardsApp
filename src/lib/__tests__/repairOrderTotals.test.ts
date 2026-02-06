import { describe, expect, it } from 'vitest';
import { calculateTotalsWithSupplies } from '../repairOrderTotals';

describe('calculateTotalsWithSupplies', () => {
  it('adds supplies to subtotal and grand total', () => {
    const totals = calculateTotalsWithSupplies({
      labor_total: 100,
      parts_total: 0,
      fees_total: 0,
      tax_total: 5,
      supplies_amount: 5,
    });
    expect(totals.subtotal).toBe(105);
    expect(totals.grand_total).toBe(110);
  });

  it('handles empty values safely', () => {
    const totals = calculateTotalsWithSupplies({});
    expect(totals.subtotal).toBe(0);
    expect(totals.grand_total).toBe(0);
  });
});
