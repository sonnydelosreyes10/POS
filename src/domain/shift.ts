import { round2 } from './money';

export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1] as const;

export function countedCash(counts: Record<number, number>): number {
  return round2(DENOMINATIONS.reduce((a, d) => a + d * (counts[d] || 0), 0));
}

/** Spec 7.6. */
export function reconcile(p: {
  openingFloat: number; cashSales: number; cashRefunds: number; payouts: number; counted: number; tolerance: number;
}) {
  const expected = round2(p.openingFloat + p.cashSales - p.cashRefunds - p.payouts);
  const overShort = round2(p.counted - expected);
  return {
    expected,
    overShort,
    withinTolerance: Math.abs(overShort) <= p.tolerance,
    label: overShort === 0 ? 'Balanced' : overShort > 0 ? 'Over' : 'Short',
  } as const;
}
