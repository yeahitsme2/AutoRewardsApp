type TotalsInput = {
  labor_total?: number | null;
  parts_total?: number | null;
  fees_total?: number | null;
  tax_total?: number | null;
  supplies_amount?: number | null;
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

export const calculateTotalsWithSupplies = (input: TotalsInput) => {
  const labor_total = Number(input.labor_total || 0);
  const parts_total = Number(input.parts_total || 0);
  const fees_total = Number(input.fees_total || 0);
  const supplies_amount = Number(input.supplies_amount || 0);
  const tax_total = Number(input.tax_total || 0);
  const subtotal = roundToCents(labor_total + parts_total + fees_total + supplies_amount);
  const grand_total = roundToCents(subtotal + tax_total);
  return {
    labor_total,
    parts_total,
    fees_total,
    supplies_amount,
    tax_total,
    subtotal,
    grand_total,
  };
};
