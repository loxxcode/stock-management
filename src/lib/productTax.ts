export function calculateProductTax(subtotal: number, isTaxable: boolean, taxRate: number): number {
  if (!isTaxable || !Number.isFinite(subtotal) || !Number.isFinite(taxRate)) return 0;
  const normalizedRate = Math.min(100, Math.max(0, taxRate));
  return Math.round(subtotal * normalizedRate / 100);
}