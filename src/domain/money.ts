/** Round half-up (away from zero) to 2 decimals — spec 7.1. */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;
}

/** Parse a user-typed currency string such as "2,000.00". Returns 0 when not a number. */
export function parseAmount(v: string | number): number {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const nf = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "₱1,234.50" with a true minus sign for negatives. */
export function fmt(n: number, currency = '₱'): string {
  return (n < 0 ? '−' : '') + currency + nf.format(Math.abs(n));
}

/** "1,234.50" without currency, for the receipt. */
export function plain(n: number): string {
  return nf.format(Math.abs(n));
}

/** "₱1,000" – whole-peso label used on preset buttons. */
export function fmtWhole(n: number, currency = '₱'): string {
  return currency + n.toLocaleString('en-PH');
}
