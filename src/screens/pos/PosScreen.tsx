import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../app/store';
import { CATEGORIES, lookupProduct } from '../../data/catalog';
import { SESSION } from '../../data/store';
import { fmt } from '../../domain/money';
import { OverrideModal } from '../../components/OverrideModal';
import { SpecOnly, SpecRef } from '../../components/ui';

const CATS = ['All', ...CATEGORIES] as const;
const DISCOUNT_PCT = 10;

/** POS checkout — Variant A: cart left, product grid right (FR-POS-01/02/03/09). */
export function PosScreen() {
  const { state, dispatch, totals, product } = useStore();
  const navigate = useNavigate();
  const [scan, setScan] = useState('');
  const [message, setMessage] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const scanRef = useRef<HTMLInputElement>(null);
  const empty = state.cart.length === 0;

  const goPay = () => { if (!empty) navigate('/pos/pay'); };
  const askDiscount = () => dispatch({ type: 'requestDiscount', pct: state.discountPct > 0 ? 0 : DISCOUNT_PCT });
  const voidCart = () => { if (!empty) dispatch({ type: 'requestVoid' }); };

  // NFR-05: whole checkout operable from scanner and keyboard. F5 discount, F9 void, F12 pay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.override) return;
      if (e.key === 'F12') { e.preventDefault(); goPay(); }
      else if (e.key === 'F5') { e.preventDefault(); askDiscount(); }
      else if (e.key === 'F9') { e.preventDefault(); voidCart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    scanRef.current?.focus();
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const addProduct = (id: number) => {
    const p = product(id);
    if (!p) return;
    const inCart = state.cart.find((c) => c.productId === id)?.qty ?? 0;
    if (state.settings.negativeStock === 'Block' && inCart + 1 > p.stock) {
      setMessage({ tone: 'danger', text: `Only ${p.stock} ${p.unit} of ${p.name} on hand — sale would take stock below zero.` });
      return;
    }
    dispatch({ type: 'add', productId: id, qty: 1 });
    setMessage(null);
  };

  const submitScan = () => {
    if (!scan.trim()) return;
    const hit = lookupProduct(scan, state.catalog);
    if (!hit) { setMessage({ tone: 'danger', text: `Item not found — ${scan}. Cart unchanged.` }); return; }
    addProduct(hit.id);
    setScan('');
    scanRef.current?.focus();
  };

  const grid = useMemo(() => state.catalog.filter((p) => cat === 'All' || p.category === cat), [state.catalog, cat]);

  return (
    <>
      <div className="pos-shell">
        <div className="pos-status">
          <span className="term-badge mono">{SESSION.terminal}</span>
          <span style={{ color: 'var(--ink2)' }}>Shift {SESSION.shift} · {state.user}</span>
          <span style={{ color: 'var(--ink4)' }}>opened {SESSION.openedAt}</span>
          <div className="grow" />
          <span className={'online' + (online ? '' : ' offline')}>{online ? 'online · queue empty' : 'offline · sales queued'}</span>
        </div>

        <div className="pos-body">
          <section className="pos-cart" aria-label="Cart">
            <div className="pos-scan">
              <form className="row" onSubmit={(e) => { e.preventDefault(); submitScan(); }}>
                <label htmlFor="scan" className="visually-hidden">Scan barcode or type SKU / name</label>
                <input id="scan" ref={scanRef} value={scan} autoComplete="off" placeholder="Scan barcode or type SKU / name"
                  onChange={(e) => { setScan(e.target.value); if (message?.tone === 'danger') setMessage(null); }} />
                <button type="submit" className="btn btn-solid" style={{ padding: '12px 16px' }}>Add</button>
              </form>
              {message && <div className={'alert ' + (message.tone === 'danger' ? 'alert-danger' : 'alert-info')} style={{ marginTop: 9, padding: '7px 10px' }} role="status">{message.text}</div>}
              <SpecOnly>
                <div className="row-wrap" style={{ marginTop: 9, gap: 6 }}>
                  <SpecRef>FR-POS-01</SpecRef><SpecRef>NFR-01 · lookup &lt;200ms</SpecRef>
                </div>
              </SpecOnly>
            </div>

            <div className="thead cart-grid cart-head" aria-hidden="true">
              <span>item</span><span className="center">qty</span><span className="right">total</span><span />
            </div>

            <div className="cart-lines">
              {totals.lines.map((l) => {
                const p = product(l.productId)!;
                return (
                  <div key={l.productId} className="cart-line cart-grid">
                    <div className="min0">
                      <div className="name" style={{ textWrap: 'pretty' } as React.CSSProperties}>{p.name}</div>
                      <div className="meta">{fmt(p.price)} / {p.unit}{p.vatExempt ? ' · exempt' : ''}</div>
                    </div>
                    <div className="row" style={{ justifyContent: 'center', gap: 3 }}>
                      <button type="button" className="qty-btn" aria-label={`Decrease ${p.name}`} onClick={() => dispatch({ type: 'setQty', productId: p.id, qty: l.qty - 1 })}>−</button>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600, minWidth: 22, textAlign: 'center' }}>{l.qty}</span>
                      <button type="button" className="qty-btn" aria-label={`Increase ${p.name}`} onClick={() => addProduct(p.id)}>+</button>
                    </div>
                    <div className="num-b" style={{ fontSize: 14.5 }}>{fmt(l.gross)}</div>
                    <button type="button" className="rm-btn" aria-label={`Remove ${p.name}`} onClick={() => dispatch({ type: 'remove', productId: p.id })}>×</button>
                  </div>
                );
              })}
              {empty && <div className="empty">Cart is empty. Scan an item to begin.</div>}
            </div>

            <div className="totals">
              <div className="totals-row"><span>Subtotal · {totals.itemCount} items</span><span className="mono">{fmt(totals.subtotal)}</span></div>
              <div className="totals-row"><span>Discount · {state.discountPct ? state.discountPct + '%' : 'none'}</span><span className="mono" style={{ color: 'var(--danger-ink)' }}>{totals.discount ? fmt(-totals.discount) : fmt(0)}</span></div>
              <div className="totals-row small"><span>VAT-exempt sales</span><span className="mono">{fmt(totals.exempt)}</span></div>
              <div className="totals-row small" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span>VAT {Math.round(totals.vatRate * 100)}% of {fmt(totals.vatable)}</span><span className="mono">{fmt(totals.vat)}</span>
              </div>
              <div className="amount-due"><span>Amount due</span><span>{fmt(totals.total)}</span></div>
              <SpecOnly><div className="spec-note" style={{ marginTop: 8 }}>7.1 · prices stored VAT-inclusive, vatable ÷ (1+r), round half-up per line</div></SpecOnly>
            </div>
          </section>

          <section className="pos-side" aria-label="Products">
            <div className="pos-cats" role="group" aria-label="Category">
              {CATS.map((c) => (
                <button key={c} type="button" className="pill" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            <div className="pos-grid-wrap">
              <div className="pos-grid">
                {grid.map((p) => (
                  <button key={p.id} type="button" className={'tile-btn' + (p.stock <= 0 ? ' out' : '')} onClick={() => addProduct(p.id)}>
                    <span className="t-name">{p.name}</span>
                    <span className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                      <span className="t-price">{fmt(p.price)}</span>
                      <span className="t-stock">{p.stock} {p.unit}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pos-actions">
              <button type="button" className="btn" onClick={askDiscount} disabled={empty}>
                {state.discountPct ? 'Remove discount' : `Discount ${DISCOUNT_PCT}%`} · F5
              </button>
              <button type="button" className="btn" disabled={empty}
                onClick={() => setMessage({ tone: 'info', text: 'Cart held as HOLD-0007 · recall it from the hold list.' })}>Hold cart</button>
              <button type="button" className="btn btn-danger" onClick={voidCart} disabled={empty}>Void · F9</button>
              <button type="button" className="btn btn-primary" style={{ fontSize: 14 }} onClick={goPay} disabled={empty}>Pay · F12</button>
            </div>
          </section>
        </div>
      </div>
      <OverrideModal onVoided={() => setMessage({ tone: 'info', text: 'Cart voided · VOID logged to the audit log with the approver.' })} />
    </>
  );
}
