import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../../app/store';
import { CURRENCY } from '../../app/config';
import { STORE, SESSION } from '../../data/store';
import { changeDue } from '../../domain/pricing';
import { fmt, parseAmount, plain } from '../../domain/money';
import { SpecOnly } from '../../components/ui';

const METHODS = [['CASH', 'Cash'], ['CARD', 'Card'], ['EWALLET', 'E-wallet'], ['SPLIT', 'Split']] as const;
type Method = (typeof METHODS)[number][0];

const two = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Payment and posting — FR-POS-05/08, spec 5.3. */
export function PaymentScreen() {
  const { state, dispatch, totals, product } = useStore();
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>('CASH');
  const [tendered, setTendered] = useState(() => two(totals.total));
  const [posted, setPosted] = useState<null | { receiptNo: string; at: string; lines: { label: string; total: number }[]; totals: typeof totals; tendered: number; method: Method }>(null);
  const tenderRef = useRef<HTMLInputElement>(null);

  useEffect(() => { tenderRef.current?.select(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !posted) navigate('/pos'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, posted]);

  if (!posted && state.cart.length === 0) return <Navigate to="/pos" replace />;

  const view = posted?.totals ?? totals;
  const tenderedN = posted ? posted.tendered : method === 'CASH' || method === 'SPLIT' ? parseAmount(tendered) : totals.total;
  const change = changeDue(tenderedN, view.total);
  const short = change < 0;
  const receiptNo = posted?.receiptNo ?? `T01-00${state.receiptSeq}`;
  const lines = posted?.lines ?? totals.lines.map((l) => ({ label: `${l.qty} ${product(l.productId)!.name.slice(0, 18)}`, total: l.gross }));

  const post = () => {
    if (short || posted) return;
    // Real build: POST /api/v1/sales with Idempotency-Key = client-generated sale_id (UUID).
    // Server locks inventory rows, re-prices, inserts sale/items/payments, allocates receipt_no,
    // writes one stock_movement per line and COMMITs. Handle 409 PRICE_MISMATCH / 422 INSUFFICIENT_STOCK.
    setPosted({
      receiptNo,
      at: new Date().toLocaleString('en-GB', { hour12: false }).replace(',', ''),
      lines,
      totals,
      tendered: tenderedN,
      method,
    });
    dispatch({ type: 'postSale', method, tendered: tenderedN });
  };

  return (
    <div className="grid-auto pay-grid">
      <section className="card card--flush">
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">amount due</div>
            <div className="mono" style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{fmt(view.total)}</div>
          </div>
          <div className="right" style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
            <div>{view.itemCount} items</div>
            <div>VAT <span className="mono">{fmt(view.vat)}</span> · exempt <span className="mono">{fmt(view.exempt)}</span></div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--ink2)', marginBottom: 10 }}>Payment method<SpecOnly> · FR-POS-05</SpecOnly></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 9 }} role="group" aria-label="Payment method">
            {METHODS.map(([k, label]) => (
              <button key={k} type="button" className="pill" aria-pressed={method === k} disabled={!!posted}
                style={{ borderRadius: 12, fontSize: 13.5, padding: '15px 10px', borderWidth: 1.5 }}
                onClick={() => { setMethod(k); if (k !== 'CASH' && k !== 'SPLIT') setTendered(two(totals.total)); }}>{label}</button>
            ))}
          </div>

          <label htmlFor="tendered" style={{ display: 'block', marginTop: 22, fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)', marginBottom: 10 }}>Amount tendered</label>
          <div className="input-affix" style={{ borderRadius: 14, padding: '0 16px' }}>
            <span style={{ fontSize: 22 }}>{CURRENCY}</span>
            <input id="tendered" ref={tenderRef} inputMode="decimal" style={{ fontSize: 30, padding: '14px 0' }}
              value={posted ? two(posted.tendered) : tendered} disabled={!!posted || method === 'CARD' || method === 'EWALLET'}
              onChange={(e) => setTendered(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'F12') { e.preventDefault(); post(); } }} />
          </div>
          <div className="row-wrap" style={{ gap: 8, marginTop: 11 }}>
            {[100, 200, 500, 1000].map((v) => (
              <button key={v} type="button" className="preset" style={{ padding: '9px 14px', fontSize: 13.5 }} disabled={!!posted || method === 'CARD' || method === 'EWALLET'}
                onClick={() => setTendered(two(v))}>{CURRENCY}{v.toLocaleString('en-PH')}</button>
            ))}
            <button type="button" className="preset" style={{ padding: '9px 14px', fontSize: 13.5 }} disabled={!!posted} onClick={() => setTendered(two(totals.total))}>Exact</button>
          </div>

          <div style={{ marginTop: 22, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 15, padding: '18px 20px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Change</span>
            <span className="mono" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: short ? 'var(--danger-ink)' : 'var(--ink)' }} aria-live="polite">{fmt(Math.max(change, 0))}</span>
          </div>
          {short && <div className="alert alert-danger" style={{ marginTop: 11, padding: '9px 12px' }} role="alert">Tendered is {fmt(Math.abs(change))} short of the amount due. Posting is blocked until the payment covers the total.</div>}
          {posted && <div className="alert alert-info" style={{ marginTop: 11, padding: '9px 12px' }} role="status">Sale posted as OR {posted.receiptNo}. Receipt sent to printer{posted.method === 'CASH' ? ' and cash drawer opened' : ''}.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 20 }}>
            {posted ? (
              <>
                <button type="button" className="btn" style={{ fontSize: 14, padding: 16 }} onClick={() => window.print()}>Reprint</button>
                <Link to="/pos" className="btn btn-primary btn-lg center" style={{ textDecoration: 'none' }}>New sale</Link>
              </>
            ) : (
              <>
                <Link to="/pos" className="btn center" style={{ fontSize: 14, padding: 16, textDecoration: 'none', color: 'var(--ink)' }}>Back to cart · Esc</Link>
                <button type="button" className="btn btn-primary btn-lg" onClick={post} disabled={short}>Post sale and print · F12</button>
              </>
            )}
          </div>
          <SpecOnly>
            <div className="dashed mono" style={{ marginTop: 16, paddingTop: 14, fontSize: 11, color: 'var(--ink3)', lineHeight: 1.85 }}>
              <div>5.3 · POST /api/v1/sales · Idempotency-Key = sale_id (UUID)</div>
              <div>BEGIN → lock inventory rows ordered by product_id → re-price server-side → insert sale, sale_items, payments → allocate receipt_no → decrement qty_on_hand + 1 stock_movement per line → COMMIT</div>
              <div>409 PRICE_MISMATCH · 422 INSUFFICIENT_STOCK · 200 if key already processed</div>
            </div>
          </SpecOnly>
        </div>
      </section>

      <section className="card card--pad" style={{ padding: 26 }} aria-label="Receipt preview">
        <div className="eyebrow" style={{ marginBottom: 14 }}>receipt preview · 58 mm</div>
        <div className="receipt">
          <div className="center" style={{ lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{STORE.name}</div>
            <div>{STORE.address}</div>
            <div>VAT REG TIN {STORE.tin}</div>
          </div>
          <div className="rule" />
          <div>OR {receiptNo}</div>
          <div>{posted?.at ?? new Date().toLocaleString('en-GB', { hour12: false }).replace(',', '')}</div>
          <div>Cashier {state.user} · {SESSION.terminal}</div>
          <div className="rule" />
          {lines.map((l, i) => <div key={i} className="line"><span>{l.label}</span><span>{plain(l.total)}</span></div>)}
          <div className="rule" />
          <div className="line"><span>VATable</span><span>{plain(view.vatable)}</span></div>
          <div className="line"><span>VAT {Math.round(view.vatRate * 100)}%</span><span>{plain(view.vat)}</span></div>
          <div className="line"><span>VAT-exempt</span><span>{plain(view.exempt)}</span></div>
          <div className="line"><span>Discount</span><span>{plain(view.discount)}</span></div>
          <div className="line" style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}><span>TOTAL</span><span>{plain(view.total)}</span></div>
          <div className="line"><span>{posted?.method ?? method}</span><span>{plain(tenderedN)}</span></div>
          <div className="line"><span>CHANGE</span><span>{plain(Math.max(change, 0))}</span></div>
          <div className="rule" />
          <div className="center" style={{ lineHeight: 1.6 }}>{state.settings.footer}<br />This serves as your official receipt</div>
        </div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.6 }}>
          <SpecOnly>FR-POS-08 · </SpecOnly>Printing kicks the cash drawer on cash payment. Reprints are stamped REPRINT.
        </div>
      </section>
    </div>
  );
}
