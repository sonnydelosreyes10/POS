// Illustrative back-office sample data from the design handoff.
import type { Movement } from '../domain/inventory';
import { computeTotals } from '../domain/pricing';
import type { PostedSale, SaleLine } from '../domain/sales';
import { CATALOG } from './catalog';

export const STORE = {
  name: 'ALING NENA GENERAL MDSE.',
  address: '123 Rizal St., Poblacion',
  tin: '009-123-456-000',
};

export const SESSION = { terminal: 'T01', shift: 812, cashier: 'A. Reyes', openedAt: '08:04', receiptNo: 'T01-004512' };

export const KPIS = [
  { label: "Today's sales", value: '₱48,320.50', sub: '+8.2% vs last Tuesday' },
  { label: 'Transactions', value: '214', sub: '3 terminals active' },
  { label: 'Average basket', value: '₱225.80', sub: '4.6 items per sale' },
  { label: 'Low stock', value: '12', sub: 'at or below reorder level' },
  { label: 'Pending approvals', value: '3', sub: '1 void · 1 adjustment · 1 PO' },
];

export const APPROVALS = [
  { id: 'a1', kind: 'VOID', title: 'Void cart · ₱1,240.00', sub: 'T02 · J. Santos · wrong customer' },
  { id: 'a2', kind: 'ADJUST', title: 'Adjustment −4 Canned sardines', sub: 'CNT-0009 count variance · DAMAGED' },
  { id: 'a3', kind: 'PO', title: 'PO-2026-0043 · ₱18,600.00', sub: 'San Miguel Distribution · 12 lines' },
];

export const TOP_ITEMS = [
  { name: 'Coffee 3-in-1 sachet', value: '312 pcs · ₱2,496', pct: 100 },
  { name: 'Detergent sachet', value: '284 pcs · ₱2,698', pct: 88 },
  { name: 'Instant noodles 55 g', value: '196 pcs · ₱2,450', pct: 71 },
  { name: 'Canned sardines 155 g', value: '148 pcs · ₱4,144', pct: 56 },
  { name: 'Softdrink 1.5 L', value: '62 pcs · ₱4,650', pct: 34 },
];

export const MOVEMENTS: Record<string, Movement[]> = {
  'GRO-SRD-155': [
    { date: '2026-08-01', type: 'OPENING', doc: 'Go-live stock load · S. Delos Reyes', qty: 120 },
    { date: '2026-08-14', type: 'PURCHASE_IN', doc: 'GRN-0114 against PO-2026-0031 · R. Lim', qty: 48 },
    { date: '2026-09-02', type: 'SALE', doc: 'OR T01-004488 · A. Reyes', qty: -12 },
    { date: '2026-09-09', type: 'ADJUSTMENT', doc: 'CNT-0009 count variance, approved by R. Lim', qty: -4 },
    { date: '2026-09-11', type: 'RETURN_IN', doc: 'RET-0031 against OR T01-004402 · A. Reyes', qty: 2 },
    { date: '2026-09-14', type: 'DAMAGED', doc: 'Write-off, crushed cans · R. Lim', qty: -6 },
    { date: '2026-09-16', type: 'SALE', doc: 'OR T01-004512 · A. Reyes', qty: -3 },
  ],
};

/** Relative to real "today" so the return-window demo (returnDays default 7) never goes stale. */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildSale(
  receiptNo: string, daysAgo: number, cashier: string, method: string,
  items: { sku: string; qty: number }[], returned: Record<string, number> = {},
): PostedSale {
  const date = isoDaysAgo(daysAgo);
  const products = items.map((i) => CATALOG.find((p) => p.sku === i.sku)!);
  const priced = items.map((i, idx) => ({ productId: products[idx].id, unitPrice: products[idx].price, qty: i.qty, vatExempt: products[idx].vatExempt }));
  const totals = computeTotals(priced, 0, 0.12);
  const lines: SaleLine[] = totals.lines.map((l, idx) => ({
    productId: products[idx].id, sku: products[idx].sku, name: products[idx].name, unit: products[idx].unit,
    qty: l.qty, returnedQty: returned[products[idx].sku] ?? 0, unitPrice: l.unitPrice, net: l.net, vatExempt: l.vatExempt,
  }));
  return { receiptNo, date, at: `${date} 09:00:00`, cashier, terminal: 'T01', method, tendered: totals.total, lines, total: totals.total, discount: totals.discount };
}

/** Sample posted sales for the Returns screen — FR-POS-10, spec 7.5. Covers a returnable sale, one past
 * the return window (TC-07), and one already fully returned. */
export const SALES: PostedSale[] = [
  buildSale('T01-004518', 2, 'anna.reyes', 'CASH', [{ sku: 'GRO-SRD-155', qty: 3 }, { sku: 'BEV-COF-3N1', qty: 2 }]),
  buildSale('T01-004312', 10, 'j.santos', 'CASH', [{ sku: 'GRO-OIL-1L', qty: 2 }]),
  buildSale('T01-004402', 3, 'anna.reyes', 'CASH', [{ sku: 'GRO-SRD-155', qty: 2 }], { 'GRO-SRD-155': 2 }),
];

export const PO = {
  number: 'PO-2026-0042',
  supplier: 'San Miguel Distribution',
  terms: '30 days',
  tin: '004-887-221-000',
  status: 'PARTIALLY_RECEIVED' as const,
  lines: [
    { name: 'Canned tuna 180 g', sku: 'GRO-TUN-180', ordered: 48, received: 24, cost: 30, total: 1440 },
    { name: 'Canned sardines 155 g', sku: 'GRO-SRD-155', ordered: 96, received: 96, cost: 21.5, total: 2064 },
    { name: 'Cooking oil 1 L', sku: 'GRO-OIL-1L', ordered: 36, received: 0, cost: 78, total: 2808 },
    { name: 'Soy sauce 1 L', sku: 'GRO-SOY-1L', ordered: 24, received: 24, cost: 48.5, total: 1164 },
  ],
};

export const PO_STAGES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'] as const;

export const SHIFT_CASH = { openingFloat: 2000, cashSales: 18455, cashRefunds: 364, payouts: 500 };

export const Z_REPORT = [
  { label: 'gross sales', value: '₱21,480.00' },
  { label: 'discounts', value: '−₱612.00' },
  { label: 'returns', value: '−₱364.00' },
  { label: 'net sales', value: '₱20,504.00' },
  { label: 'VAT 12%', value: '₱2,196.86' },
  { label: 'VAT-exempt', value: '₱4,120.00' },
  { label: 'cash · card · e-wallet', value: '18,455 · 1,420 · 629' },
  { label: 'transactions · voids', value: '74 · 2' },
];

export const USERS = [
  { name: 'Sonia Delos Reyes', username: 'sonny.dr', role: 'Owner', status: 'Active', last: '16/09 07:58' },
  { name: 'Rodel Lim', username: 'r.lim', role: 'Manager', status: 'Active', last: '16/09 08:02' },
  { name: 'Anna Reyes', username: 'anna.reyes', role: 'Cashier', status: 'Active', last: '16/09 08:04' },
  { name: 'Jomar Santos', username: 'j.santos', role: 'Cashier', status: 'Locked', last: '15/09 17:41' },
  { name: 'Mercy Bautista', username: 'm.bautista', role: 'Stock clerk', status: 'Active', last: '16/09 06:30' },
  { name: 'Audit account', username: 'audit.ro', role: 'Read-only', status: 'Disabled', last: '02/09 10:12' },
] as const;

export const ROLE_PERMS = [
  ['Owner', 'Everything, including user administration and settings'],
  ['Manager', 'Approvals, voids, price changes, PO approval, reports, shift close'],
  ['Cashier', 'Sell, hold, return within policy, open and close own shift'],
  ['Stock clerk', 'Receiving, counts, adjustments; no access to the sales screen'],
  ['Read-only', 'Reports and audit log only, for the accountant'],
] as const;

export const TERMINALS = [
  { code: 'T01', place: 'Front counter', status: 'Online', seen: '16/09 10:15', ver: 'v1.0.4', queue: 0 },
  { code: 'T02', place: 'Second counter', status: 'Online', seen: '16/09 10:14', ver: 'v1.0.4', queue: 0 },
  { code: 'T03', place: 'Stockroom tablet', status: 'Offline', seen: '15/09 18:22', ver: 'v1.0.3', queue: 7 },
];

export const SUPPLIERS = [
  { name: 'San Miguel Distribution', tin: '004-887-221-000', terms: '30 days', open: '2 open POs', contact: 'R. Cruz · 0917 555 0142' },
  { name: 'Lucky Rice Trading', tin: '221-004-118-000', terms: '15 days', open: '1 open PO', contact: 'M. Tan · 0918 220 7781' },
  { name: 'Metro Household Supply', tin: '118-552-009-000', terms: 'COD', open: 'none', contact: 'J. Aquino · 0920 114 9903' },
];

export const BACKUP_ROWS = [
  { label: 'Last backup', value: '16/09/2026 02:00', note: 'nightly, 18.4 MB, verified' },
  { label: 'Schedule', value: 'Daily 02:00 + after end-of-day', note: 'retained 30 days on-site, 90 off-site' },
  { label: 'Restore tested', value: '01/09/2026', note: 'monthly, on a staging copy' },
  { label: 'Offline queues', value: '7 on T03', note: 'flush automatically on reconnect' },
];

export const AUDIT_ROWS = [
  { time: '16/09 10:15', action: 'SALE_POST', actor: 'anna.reyes', detail: 'T01-004512 · ₱364.00' },
  { time: '16/09 09:48', action: 'OVERRIDE', actor: 'r.lim', detail: 'discount 10% on T01-004509' },
  { time: '16/09 08:04', action: 'SHIFT_OPEN', actor: 'anna.reyes', detail: 'shift 812 · float ₱2,000.00' },
  { time: '15/09 17:41', action: 'LOGIN_FAIL', actor: 'j.santos', detail: '5 attempts · locked 15 min' },
  { time: '15/09 16:55', action: 'PRICE_CHANGE', actor: 'sonny.dr', detail: 'GRO-OIL-1L ₱95.00 → ₱98.00' },
  { time: '15/09 14:20', action: 'ADJUSTMENT', actor: 'm.bautista', detail: 'CNT-0009 · −4 GRO-SRD-155' },
];
