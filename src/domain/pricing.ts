import { round2 } from './money';

export interface PricedLine {
  productId: number;
  /** VAT-inclusive unit price. */
  unitPrice: number;
  qty: number;
  vatExempt: boolean;
  /** Absolute line discount in pesos, applied before the transaction discount. */
  lineDiscount?: number;
}

export interface LineResult extends PricedLine {
  gross: number;
  /** Line total after line and prorated transaction discount. */
  net: number;
  transactionDiscountShare: number;
}

export interface Totals {
  lines: LineResult[];
  itemCount: number;
  subtotal: number;
  lineDiscounts: number;
  transactionDiscount: number;
  discount: number;
  vatableGross: number;
  vatable: number;
  vat: number;
  exempt: number;
  total: number;
  vatRate: number;
}

/**
 * Cart totals, recomputed from scratch — README "State Management", spec 7.1 / 7.2.
 * 1. line gross = round(unit_price × qty)
 * 2. line discounts, never below zero
 * 3. transaction discount = round(subtotal_after_line_discounts × pct)
 * 4. prorate transaction discount across lines by line total (largest remainder, so shares sum exactly)
 * 5. split into vatable and exempt buckets
 * 6. vatable = round(vatable_gross ÷ (1 + r)), vat = vatable_gross − vatable
 * 7. total = vatable_gross + exempt
 * Statutory SC/PWD discounts are an open decision and are not modelled here.
 */
export function computeTotals(input: PricedLine[], transactionDiscountPct: number, vatRate: number): Totals {
  const staged = input.map((l) => {
    const gross = round2(l.unitPrice * l.qty);
    const lineDisc = Math.min(Math.max(round2(l.lineDiscount ?? 0), 0), gross);
    return { ...l, gross, afterLine: round2(gross - lineDisc), lineDisc };
  });

  const subtotal = round2(staged.reduce((a, l) => a + l.gross, 0));
  const lineDiscounts = round2(staged.reduce((a, l) => a + l.lineDisc, 0));
  const base = round2(subtotal - lineDiscounts);
  const pct = Math.min(Math.max(transactionDiscountPct, 0), 100);
  const transactionDiscount = round2(base * (pct / 100));

  // Prorate in centavos using largest remainder.
  const discCents = Math.round(transactionDiscount * 100);
  const baseCents = Math.round(base * 100);
  const shares = staged.map((l) => {
    const cents = Math.round(l.afterLine * 100);
    const exact = baseCents > 0 ? (discCents * cents) / baseCents : 0;
    return { floor: Math.floor(exact), rem: exact - Math.floor(exact), cap: cents };
  });
  let left = discCents - shares.reduce((a, s) => a + s.floor, 0);
  const order = shares.map((_, i) => i).sort((a, b) => shares[b].rem - shares[a].rem);
  for (const i of order) {
    if (left <= 0) break;
    if (shares[i].floor < shares[i].cap) {
      shares[i].floor += 1;
      left -= 1;
    }
  }

  let vatableGross = 0;
  let exempt = 0;
  const lines: LineResult[] = staged.map((l, i) => {
    const share = shares[i].floor / 100;
    const net = round2(Math.max(l.afterLine - share, 0));
    if (l.vatExempt) exempt += net;
    else vatableGross += net;
    return {
      productId: l.productId,
      unitPrice: l.unitPrice,
      qty: l.qty,
      vatExempt: l.vatExempt,
      lineDiscount: l.lineDisc,
      gross: l.gross,
      net,
      transactionDiscountShare: share,
    };
  });

  vatableGross = round2(vatableGross);
  exempt = round2(exempt);
  const vatable = round2(vatableGross / (1 + vatRate));
  const vat = round2(vatableGross - vatable);
  const total = round2(vatableGross + exempt);

  return {
    lines,
    itemCount: input.reduce((a, l) => a + l.qty, 0),
    subtotal,
    lineDiscounts,
    transactionDiscount,
    discount: round2(lineDiscounts + transactionDiscount),
    vatableGross,
    vatable,
    vat,
    exempt,
    total,
    vatRate,
  };
}

/** Change due; negative means tender is short. */
export function changeDue(tendered: number, total: number): number {
  return round2(tendered - total);
}
