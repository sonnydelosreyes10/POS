import { round2 } from './money';

export interface SaleLine {
  productId: number;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  returnedQty: number;
  /** VAT-inclusive unit price paid at sale time. */
  unitPrice: number;
  /** Line total after line and prorated transaction discount — refund basis, spec 7.5. */
  net: number;
  vatExempt: boolean;
}

export type SaleStatus = 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED';

export interface PostedSale {
  receiptNo: string;
  /** ISO yyyy-mm-dd sale date, used for the return-window check. */
  date: string;
  at: string;
  cashier: string;
  terminal: string;
  method: string;
  tendered: number;
  lines: SaleLine[];
  total: number;
  discount: number;
}

/** Whole days between two ISO dates (today − sale date). */
export function daysSince(dateISO: string, todayISO: string): number {
  const ms = new Date(todayISO + 'T00:00:00').getTime() - new Date(dateISO + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

/** Spec 7.5 / FR-POS-10, TC-06 / TC-07: returns allowed within return_period_days of the sale date. */
export function isReturnable(sale: PostedSale, todayISO: string, returnDays: number): boolean {
  return daysSince(sale.date, todayISO) <= returnDays;
}

export function remainingQty(line: SaleLine): number {
  return line.qty - line.returnedQty;
}

/** Refund = original unit price paid minus prorated discount, for the returned quantity — spec 7.5. */
export function refundForLine(line: SaleLine, returnQty: number): number {
  if (line.qty <= 0) return 0;
  return round2((line.net / line.qty) * returnQty);
}

export function saleStatus(sale: PostedSale): SaleStatus {
  const soldQty = sale.lines.reduce((a, l) => a + l.qty, 0);
  const returnedQty = sale.lines.reduce((a, l) => a + l.returnedQty, 0);
  if (returnedQty === 0) return 'COMPLETED';
  return returnedQty >= soldQty ? 'RETURNED' : 'PARTIALLY_RETURNED';
}
