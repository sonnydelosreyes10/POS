import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { CATALOG, type Product } from '../data/catalog';
import { MOVEMENTS, SALES, SESSION } from '../data/store';
import { movementTypeForReason, type AdjustmentReason } from '../domain/adjustments';
import type { Movement } from '../domain/inventory';
import { computeTotals, type Totals } from '../domain/pricing';
import type { PostedSale, SaleLine } from '../domain/sales';

export interface CartItem { productId: number; qty: number }
export interface Settings {
  vatRate: number;
  discountLimitPct: number;
  tolerance: number;
  returnDays: number;
  negativeStock: 'Block' | 'Allow with warning';
  footer: string;
}
export type OverrideKind = 'discount' | 'void' | 'adjustment' | 'count';

export interface PendingAdjustment {
  sku: string;
  name: string;
  qtyChange: number;
  reason: AdjustmentReason;
  note: string;
}
export interface PendingCountLine {
  sku: string;
  name: string;
  systemQty: number;
  countedQty: number;
  variance: number;
}

interface State {
  user: string | null;
  shiftOpen: boolean;
  openingFloat: number;
  catalog: Product[];
  movements: Record<string, Movement[]>;
  sales: PostedSale[];
  cart: CartItem[];
  discountPct: number;
  pendingDiscount: number;
  pendingAdjustment: PendingAdjustment | null;
  pendingCount: PendingCountLine[] | null;
  override: OverrideKind | null;
  settings: Settings;
  receiptSeq: number;
  returnSeq: number;
  countSeq: number;
}

type Action =
  | { type: 'login'; user: string }
  | { type: 'logout' }
  | { type: 'openShift'; float: number }
  | { type: 'closeShift' }
  | { type: 'add'; productId: number; qty: number }
  | { type: 'setQty'; productId: number; qty: number }
  | { type: 'remove'; productId: number }
  | { type: 'requestDiscount'; pct: number }
  | { type: 'requestVoid' }
  | { type: 'requestAdjustment'; adjustment: PendingAdjustment }
  | { type: 'requestCount'; lines: PendingCountLine[] }
  | { type: 'cancelOverride' }
  | { type: 'authorizeOverride' }
  | { type: 'postSale'; method: string; tendered: number }
  | { type: 'returnSale'; receiptNo: string; reason: string; lines: { productId: number; qty: number }[] }
  | { type: 'receive'; sku: string; qty: number; unitCost: number; newAvg: number; doc: string }
  | { type: 'saveProduct'; product: Product }
  | { type: 'saveSettings'; settings: Settings };

const initial: State = {
  user: null,
  shiftOpen: false,
  openingFloat: 0,
  catalog: CATALOG,
  movements: MOVEMENTS,
  sales: SALES,
  cart: [],
  discountPct: 0,
  pendingDiscount: 0,
  pendingAdjustment: null,
  pendingCount: null,
  override: null,
  settings: { vatRate: 0.12, discountLimitPct: 5, tolerance: 20, returnDays: 7, negativeStock: 'Block', footer: 'Salamat po! Please keep your receipt.' },
  receiptSeq: 4512,
  returnSeq: 32,
  countSeq: 10,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'login': return { ...s, user: a.user };
    case 'logout': return { ...s, user: null, shiftOpen: false, cart: [], discountPct: 0 };
    case 'openShift': return { ...s, shiftOpen: true, openingFloat: a.float };
    case 'closeShift': return { ...s, shiftOpen: false, cart: [], discountPct: 0 };
    case 'add': {
      const i = s.cart.findIndex((c) => c.productId === a.productId);
      const cart = s.cart.slice();
      if (i >= 0) cart[i] = { ...cart[i], qty: cart[i].qty + a.qty };
      else cart.push({ productId: a.productId, qty: a.qty });
      return { ...s, cart };
    }
    case 'setQty':
      return { ...s, cart: s.cart.map((c) => (c.productId === a.productId ? { ...c, qty: a.qty } : c)).filter((c) => c.qty > 0) };
    case 'remove': return { ...s, cart: s.cart.filter((c) => c.productId !== a.productId) };
    case 'requestDiscount':
      return a.pct > s.settings.discountLimitPct
        ? { ...s, override: 'discount', pendingDiscount: a.pct }
        : { ...s, discountPct: a.pct };
    case 'requestVoid': return { ...s, override: 'void' };
    case 'requestAdjustment': return { ...s, override: 'adjustment', pendingAdjustment: a.adjustment };
    case 'requestCount': return { ...s, override: 'count', pendingCount: a.lines };
    case 'cancelOverride': return { ...s, override: null, pendingDiscount: 0, pendingAdjustment: null, pendingCount: null };
    case 'authorizeOverride': {
      if (s.override === 'void') return { ...s, override: null, cart: [], discountPct: 0 };
      if (s.override === 'discount') return { ...s, override: null, discountPct: s.pendingDiscount, pendingDiscount: 0 };
      if (s.override === 'adjustment' && s.pendingAdjustment) {
        const { sku, qtyChange, reason, note } = s.pendingAdjustment;
        const today = new Date().toISOString().slice(0, 10);
        const type = movementTypeForReason(reason);
        const catalog = s.catalog.map((p) => (p.sku === sku ? { ...p, stock: p.stock + qtyChange } : p));
        const movements = { ...s.movements, [sku]: [...(s.movements[sku] ?? []), { date: today, type, doc: `${note} · ${s.user ?? ''}`, qty: qtyChange }] };
        return { ...s, override: null, pendingAdjustment: null, catalog, movements };
      }
      if (s.override === 'count' && s.pendingCount) {
        const today = new Date().toISOString().slice(0, 10);
        let catalog = s.catalog;
        const movements = { ...s.movements };
        for (const line of s.pendingCount) {
          if (line.variance === 0) continue;
          catalog = catalog.map((p) => (p.sku === line.sku ? { ...p, stock: p.stock + line.variance } : p));
          movements[line.sku] = [...(movements[line.sku] ?? []), { date: today, type: 'ADJUSTMENT', doc: `CNT-00${s.countSeq} count variance, approved by ${s.user ?? ''}`, qty: line.variance }];
        }
        return { ...s, override: null, pendingCount: null, catalog, movements, countSeq: s.countSeq + 1 };
      }
      return { ...s, override: null };
    }
    case 'postSale': {
      const today = new Date().toISOString().slice(0, 10);
      const receipt = `T01-00${s.receiptSeq}`;
      const movements = { ...s.movements };
      const catalog = s.catalog.map((p) => {
        const line = s.cart.find((c) => c.productId === p.id);
        if (!line) return p;
        movements[p.sku] = [...(movements[p.sku] ?? []), { date: today, type: 'SALE', doc: `OR ${receipt} · ${s.user ?? ''}`, qty: -line.qty }];
        return { ...p, stock: p.stock - line.qty };
      });
      const cartLines = s.cart.flatMap((c) => {
        const p = s.catalog.find((x) => x.id === c.productId);
        return p ? [{ productId: p.id, unitPrice: p.price, qty: c.qty, vatExempt: p.vatExempt }] : [];
      });
      const totals = computeTotals(cartLines, s.discountPct, s.settings.vatRate);
      const saleLines: SaleLine[] = totals.lines.map((l) => {
        const p = s.catalog.find((x) => x.id === l.productId)!;
        return { productId: p.id, sku: p.sku, name: p.name, unit: p.unit, qty: l.qty, returnedQty: 0, unitPrice: l.unitPrice, net: l.net, vatExempt: l.vatExempt };
      });
      const sale: PostedSale = {
        receiptNo: receipt, date: today, at: new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ''),
        cashier: s.user ?? '', terminal: SESSION.terminal, method: a.method, tendered: a.tendered,
        lines: saleLines, total: totals.total, discount: totals.discount,
      };
      return { ...s, catalog, movements, cart: [], discountPct: 0, receiptSeq: s.receiptSeq + 1, sales: [sale, ...s.sales] };
    }
    case 'returnSale': {
      const doc = `RET-00${s.returnSeq}`;
      const today = new Date().toISOString().slice(0, 10);
      let catalog = s.catalog;
      const movements = { ...s.movements };
      const sales = s.sales.map((sale) => {
        if (sale.receiptNo !== a.receiptNo) return sale;
        const lines = sale.lines.map((l) => {
          const req = a.lines.find((x) => x.productId === l.productId);
          const remaining = l.qty - l.returnedQty;
          const qty = req ? Math.min(Math.max(req.qty, 0), remaining) : 0;
          if (qty <= 0) return l;
          catalog = catalog.map((p) => (p.id === l.productId ? { ...p, stock: p.stock + qty } : p));
          movements[l.sku] = [...(movements[l.sku] ?? []), { date: today, type: 'RETURN_IN', doc: `${doc} against OR ${a.receiptNo} · ${a.reason} · ${s.user ?? ''}`, qty }];
          return { ...l, returnedQty: l.returnedQty + qty };
        });
        return { ...sale, lines };
      });
      return { ...s, catalog, movements, sales, returnSeq: s.returnSeq + 1 };
    }
    case 'receive': {
      const today = new Date().toISOString().slice(0, 10);
      return {
        ...s,
        catalog: s.catalog.map((p) => (p.sku === a.sku ? { ...p, stock: p.stock + a.qty, avgCost: a.newAvg } : p)),
        movements: { ...s.movements, [a.sku]: [...(s.movements[a.sku] ?? []), { date: today, type: 'PURCHASE_IN', doc: a.doc, qty: a.qty }] },
      };
    }
    case 'saveProduct': return { ...s, catalog: s.catalog.map((p) => (p.id === a.product.id ? a.product : p)) };
    case 'saveSettings': return { ...s, settings: a.settings };
  }
}

interface Ctx {
  state: State;
  dispatch: React.Dispatch<Action>;
  totals: Totals;
  product: (id: number) => Product | undefined;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const product = useCallback((id: number) => state.catalog.find((p) => p.id === id), [state.catalog]);
  const totals = useMemo(() => {
    const lines = state.cart.flatMap((c) => {
      const p = state.catalog.find((x) => x.id === c.productId);
      return p ? [{ productId: p.id, unitPrice: p.price, qty: c.qty, vatExempt: p.vatExempt }] : [];
    });
    return computeTotals(lines, state.discountPct, state.settings.vatRate);
  }, [state.cart, state.catalog, state.discountPct, state.settings.vatRate]);
  const value = useMemo(() => ({ state, dispatch, totals, product }), [state, totals, product]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
