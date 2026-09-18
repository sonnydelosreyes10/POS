import { describe, expect, it } from 'vitest';
import { computeTotals, changeDue } from './pricing';
import { movingAverage } from './costing';
import { round2 } from './money';
import { stockStatus, suggestedOrder, variance, withBalance } from './inventory';
import { countedCash, reconcile } from './shift';
import { registerFailure } from './auth';
import { directionForReason, movementTypeForReason } from './adjustments';
import { daysSince, isReturnable, refundForLine, remainingQty, saleStatus, type PostedSale } from './sales';
import { lookupProduct } from '../data/catalog';
import { MOVEMENTS } from '../data/store';

const sardines = { productId: 1042, unitPrice: 28, qty: 3, vatExempt: false };
const rice = { productId: 1088, unitPrice: 280, qty: 1, vatExempt: true };

describe('round2', () => {
  it('rounds half up', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
  });
});

describe('computeTotals (7.1 / 7.2)', () => {
  it('splits vatable and exempt with VAT-inclusive prices', () => {
    const t = computeTotals([sardines, rice], 0, 0.12);
    expect(t.subtotal).toBe(364);
    expect(t.vatable).toBe(75);
    expect(t.vat).toBe(9);
    expect(t.exempt).toBe(280);
    expect(t.total).toBe(364);
    expect(t.itemCount).toBe(4);
  });

  it('prorates a transaction discount so shares sum exactly', () => {
    const lines = [
      { productId: 1, unitPrice: 12.5, qty: 1, vatExempt: false },
      { productId: 2, unitPrice: 8, qty: 1, vatExempt: false },
      { productId: 3, unitPrice: 9.5, qty: 1, vatExempt: true },
    ];
    const t = computeTotals(lines, 10, 0.12);
    expect(t.transactionDiscount).toBe(3);
    const shares = t.lines.reduce((a, l) => a + l.transactionDiscountShare, 0);
    expect(round2(shares)).toBe(3);
    expect(t.total).toBe(27);
  });

  it('applies line discounts first and never goes negative', () => {
    const t = computeTotals([{ ...sardines, lineDiscount: 500 }, rice], 10, 0.12);
    expect(t.lines[0].net).toBe(0);
    expect(t.lineDiscounts).toBe(84);
    expect(t.transactionDiscount).toBe(28);
    expect(t.total).toBe(252);
  });

  it('handles an empty cart', () => {
    const t = computeTotals([], 10, 0.12);
    expect(t.total).toBe(0);
    expect(t.vat).toBe(0);
  });

  it('computes change', () => {
    expect(changeDue(500, 364)).toBe(136);
    expect(changeDue(300, 364)).toBe(-64);
  });
});

describe('movingAverage (7.3)', () => {
  it('TC-08: 10 @ 25 + 10 @ 30 → 20 @ 27.50', () => {
    expect(movingAverage(10, 25, 10, 30)).toEqual({ newQty: 20, newAvg: 27.5 });
  });
  it('uses unit cost when on-hand is zero or negative', () => {
    expect(movingAverage(0, 25, 5, 31).newAvg).toBe(31);
    expect(movingAverage(-2, 25, 5, 31).newAvg).toBe(31);
  });
});

describe('inventory', () => {
  it('derives status', () => {
    expect(stockStatus(0, 10, 50)).toBe('Out of stock');
    expect(stockStatus(10, 10, 50)).toBe('Below reorder');
    expect(stockStatus(51, 10, 50)).toBe('Overstocked');
    expect(stockStatus(20, 10, 50)).toBe('Healthy');
    expect(suggestedOrder(10, 96)).toBe(86);
  });
  it('stock card balance matches on-hand', () => {
    const rows = withBalance(MOVEMENTS['GRO-SRD-155']);
    expect(rows[rows.length - 1].balance).toBe(145);
  });
});

describe('lookupProduct (FR-POS-01, TC-01)', () => {
  it('matches barcode, SKU, then name', () => {
    expect(lookupProduct('4806509112235')?.sku).toBe('GRO-RIC-5KG');
    expect(lookupProduct('gro-srd-155')?.id).toBe(1042);
    expect(lookupProduct('TUNA')?.sku).toBe('GRO-TUN-180');
    expect(lookupProduct('xyz')).toBeUndefined();
  });
});

describe('shift close (7.6)', () => {
  it('reconciles within tolerance', () => {
    const counted = countedCash({ 1000: 12, 500: 9, 200: 4, 100: 11, 50: 6, 20: 14, 10: 9, 5: 12, 1: 21 });
    expect(counted).toBe(19151);
    const r = reconcile({ openingFloat: 2000, cashSales: 18455, cashRefunds: 364, payouts: 500, counted, tolerance: 20 });
    expect(r.expected).toBe(19591);
    expect(r.overShort).toBe(-440);
    expect(r.label).toBe('Short');
    expect(r.withinTolerance).toBe(false);
    expect(reconcile({ openingFloat: 0, cashSales: 100, cashRefunds: 0, payouts: 0, counted: 110, tolerance: 20 }).withinTolerance).toBe(true);
    expect(reconcile({ openingFloat: 0, cashSales: 100, cashRefunds: 0, payouts: 0, counted: 70, tolerance: 20 }).withinTolerance).toBe(false);
  });
});

describe('physical count variance (FR-INV-03, TC-09)', () => {
  it('is counted minus system', () => {
    expect(variance(24, 20)).toBe(-4);
    expect(variance(24, 24)).toBe(0);
    expect(variance(24, 30)).toBe(6);
  });
});

describe('manual adjustments (FR-INV-04)', () => {
  it('maps DAMAGED/EXPIRED to their own write-off type, everything else to ADJUSTMENT', () => {
    expect(movementTypeForReason('DAMAGED')).toBe('DAMAGED');
    expect(movementTypeForReason('EXPIRED')).toBe('EXPIRED');
    expect(movementTypeForReason('LOST')).toBe('ADJUSTMENT');
    expect(movementTypeForReason('FOUND')).toBe('ADJUSTMENT');
    expect(movementTypeForReason('CORRECTION')).toBe('ADJUSTMENT');
  });
  it('fixes direction for every reason except CORRECTION', () => {
    expect(directionForReason('FOUND')).toBe(1);
    expect(directionForReason('DAMAGED')).toBe(-1);
    expect(directionForReason('EXPIRED')).toBe(-1);
    expect(directionForReason('LOST')).toBe(-1);
    expect(directionForReason('CORRECTION')).toBeNull();
  });
});

describe('returns and refunds (FR-POS-10, spec 7.5)', () => {
  const sale: PostedSale = {
    receiptNo: 'T01-009001', date: '2026-09-10', at: '2026-09-10 09:00:00', cashier: 'anna.reyes',
    terminal: 'T01', method: 'CASH', tendered: 84,
    lines: [{ productId: 1042, sku: 'GRO-SRD-155', name: 'Canned sardines 155 g', unit: 'pc', qty: 3, returnedQty: 0, unitPrice: 28, net: 84, vatExempt: false }],
    total: 84, discount: 0,
  };

  it('TC-06/TC-07: returnable within the window, rejected past it', () => {
    expect(daysSince('2026-09-10', '2026-09-13')).toBe(3);
    expect(isReturnable(sale, '2026-09-13', 7)).toBe(true);
    expect(isReturnable(sale, '2026-09-18', 7)).toBe(false);
  });

  it('TC-06: refund is the net unit price times returned qty, and status tracks partial returns', () => {
    expect(refundForLine(sale.lines[0], 2)).toBe(56);
    const afterReturn = { ...sale.lines[0], returnedQty: 2 };
    expect(remainingQty(afterReturn)).toBe(1);
    expect(saleStatus({ ...sale, lines: [afterReturn] })).toBe('PARTIALLY_RETURNED');
    expect(saleStatus({ ...sale, lines: [{ ...afterReturn, returnedQty: 3 }] })).toBe('RETURNED');
    expect(saleStatus(sale)).toBe('COMPLETED');
  });
});

describe('login lockout (TC-11)', () => {
  it('locks on the 5th failure and resets the counter', () => {
    let n = 0;
    for (let i = 0; i < 4; i++) n = registerFailure(n).failedAttempts;
    expect(n).toBe(4);
    const r = registerFailure(n);
    expect(r.locked).toBe(true);
    expect(r.failedAttempts).toBe(0);
  });
});
