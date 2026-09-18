import { useState } from 'react';
import { useStore } from '../../app/store';
import { daysSince, isReturnable, refundForLine, remainingQty, saleStatus, type SaleStatus } from '../../domain/sales';
import { fmt } from '../../domain/money';
import { Notice, SpecOnly } from '../../components/ui';

const STATUS_TONE: Record<SaleStatus, string> = { COMPLETED: 'tone-accent', PARTIALLY_RETURNED: 'tone-warn', RETURNED: 'tone-neutral' };
const COLS = 'minmax(0, 1.6fr) 70px 70px 80px 90px 96px';

interface PostedReturn { doc: string; refund: number; lines: { name: string; qty: number; refund: number }[] }

/** Return and refund flow — FR-POS-10, spec 5.5 / 7.5. */
export function ReturnsScreen() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [posted, setPosted] = useState<PostedReturn | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const recent = state.sales.slice(0, 6);
  const sale = receiptNo ? state.sales.find((s) => s.receiptNo === receiptNo) ?? null : null;
  const status = sale ? saleStatus(sale) : null;
  const returnable = sale ? isReturnable(sale, today, state.settings.returnDays) : false;
  const daysOld = sale ? daysSince(sale.date, today) : 0;

  const open = (r: string) => { setReceiptNo(r); setQtys({}); setReason(''); setPosted(null); setNotFound(false); };

  const find = () => {
    const hit = state.sales.find((s) => s.receiptNo.toLowerCase() === query.trim().toLowerCase());
    if (hit) open(hit.receiptNo);
    else { setNotFound(true); setReceiptNo(null); }
  };

  const setQty = (productId: number, qty: number, max: number) => setQtys((q) => ({ ...q, [productId]: Math.min(Math.max(qty, 0), max) }));

  const totalRefund = sale ? sale.lines.reduce((a, l) => a + refundForLine(l, qtys[l.productId] ?? 0), 0) : 0;
  const anyQty = Object.values(qtys).some((q) => q > 0);
  const canSubmit = !!sale && returnable && anyQty && reason.trim().length >= 5;

  const submit = () => {
    if (!sale || !canSubmit) return;
    const chosen = sale.lines.filter((l) => (qtys[l.productId] ?? 0) > 0);
    const summary = chosen.map((l) => ({ name: l.name, qty: qtys[l.productId], refund: refundForLine(l, qtys[l.productId]) }));
    setPosted({ doc: `RET-00${state.returnSeq}`, refund: totalRefund, lines: summary });
    dispatch({ type: 'returnSale', receiptNo: sale.receiptNo, reason: reason.trim(), lines: chosen.map((l) => ({ productId: l.productId, qty: qtys[l.productId] })) });
    setQtys({});
    setReason('');
  };

  return (
    <div className="grid-auto pay-grid">
      <section className="card card--flush">
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow">returns and refunds<SpecOnly> · FR-POS-10</SpecOnly></div>
          <h2 className="h-screen" style={{ fontSize: 24, marginBottom: 5 }}>Process a return</h2>
          <p className="lede" style={{ maxWidth: '48ch' }}>
            Returns are always linked to the original receipt so refund, tax and cost reverse at the original values.
            <SpecOnly> Spec 5.5, 7.5.</SpecOnly>
          </p>
        </div>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <label htmlFor="ret-search" className="field-label">Receipt number</label>
          <div className="row" style={{ gap: 9 }}>
            <input id="ret-search" className="input mono" style={{ fontWeight: 600 }} placeholder="e.g. T01-004518"
              value={query} onChange={(e) => { setQuery(e.target.value); setNotFound(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') find(); }} />
            <button type="button" className="btn btn-solid" style={{ padding: '11px 18px' }} onClick={find}>Find</button>
          </div>
          {notFound && <div className="alert alert-danger" style={{ marginTop: 10 }}>No sale found for receipt “{query}”.</div>}
          <div className="row-wrap" style={{ marginTop: 12, gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink4)', marginRight: 2 }}>Recent:</span>
            {recent.map((s) => (
              <button key={s.receiptNo} type="button" className="pill mono" aria-pressed={receiptNo === s.receiptNo} onClick={() => open(s.receiptNo)}>
                {s.receiptNo}
              </button>
            ))}
          </div>
        </div>

        {sale && status && (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>OR {sale.receiptNo}</div>
                <div className="meta">{sale.date} · {sale.cashier} · {sale.method}</div>
              </div>
              <span className={`badge ${STATUS_TONE[status]}`}>{status.replace('_', ' ')}</span>
              <span style={{ fontSize: 12.5, color: 'var(--ink4)' }}>{daysOld === 0 ? 'today' : `${daysOld} day${daysOld === 1 ? '' : 's'} ago`}</span>
            </div>

            {!returnable && (
              <div style={{ padding: '14px 24px 0' }}>
                <div className="alert alert-danger">
                  Rejected — {daysOld} days since the sale exceeds the {state.settings.returnDays}-day return window.
                  <SpecOnly> FR-POS-10, TC-07.</SpecOnly>
                </div>
              </div>
            )}

            <div className="hscroll">
              <div style={{ minWidth: 620 }}>
                <div className="thead" style={{ gridTemplateColumns: COLS, padding: '9px 24px' }}>
                  <span>item</span><span className="right">sold</span><span className="right">returned</span><span className="right">left</span><span className="right">unit refund</span><span className="right">return qty</span>
                </div>
                {sale.lines.map((l) => {
                  const left = remainingQty(l);
                  const unitRefund = l.qty > 0 ? l.net / l.qty : 0;
                  return (
                    <div key={l.productId} className="trow" style={{ gridTemplateColumns: COLS, padding: '11px 24px' }}>
                      <div className="min0"><div className="name">{l.name}</div><div className="meta">{l.sku}</div></div>
                      <span className="num">{l.qty}</span>
                      <span className="num" style={{ color: l.returnedQty > 0 ? 'var(--warn-ink)' : 'var(--ink4)' }}>{l.returnedQty}</span>
                      <span className="num-b" style={{ color: left === 0 ? 'var(--ink6)' : 'var(--ink)' }}>{left}</span>
                      <span className="num">{fmt(unitRefund)}</span>
                      <input className="input mono right" inputMode="numeric" disabled={left === 0 || !returnable}
                        style={{ padding: '7px 10px', borderRadius: 9, fontSize: 13.5, textAlign: 'right' }}
                        value={String(qtys[l.productId] ?? 0)}
                        onChange={(e) => setQty(l.productId, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0, left)} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '18px 24px' }}>
              <label htmlFor="ret-reason" className="field-label">Reason for return</label>
              <input id="ret-reason" className="input" placeholder="e.g. wrong item, customer changed mind, damaged on delivery"
                value={reason} onChange={(e) => setReason(e.target.value)} disabled={!returnable} />
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16, fontSize: 14.5, padding: 15 }} onClick={submit} disabled={!canSubmit}>
                Process return · refund {fmt(totalRefund)}
              </button>
              {posted && (
                <div style={{ marginTop: 14 }}>
                  <Notice onDismiss={() => setPosted(null)}>
                    Posted as {posted.doc} against OR {sale.receiptNo}. Refund {fmt(posted.refund)} via {sale.method}
                    {sale.method === 'CASH' ? ' · reduces this shift’s expected cash' : ''}. RETURN_IN written for each line.
                  </Notice>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card card--pad card--sunken">
        <div className="eyebrow">refund basis<SpecOnly> · 7.5</SpecOnly></div>
        <h3 className="h-card" style={{ marginBottom: 14 }}>How the refund is computed</h3>
        <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.85 }}>refund = (line net ÷ line qty) × returned qty</div>
        <div className="dashed" style={{ margin: '14px 0' }} />
        <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>
          Refund uses the original unit price paid minus its prorated discount — never the current catalog price.
          Cumulative returned quantity per line can never exceed the quantity sold, and the refund goes back through
          the original payment method.
        </div>
        {sale && (
          <div style={{ marginTop: 20, display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <div><div className="figure-label">Return window</div><div className="figure" style={{ fontSize: 22 }}>{state.settings.returnDays}d</div></div>
            <div><div className="figure-label">Refund total</div><div className="figure" style={{ fontSize: 22, color: 'var(--accent-ink)' }}>{fmt(totalRefund)}</div></div>
          </div>
        )}
        <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--ink4)', lineHeight: 1.6 }}>
          Void removes lines before payment; a posted sale can only be adjusted through this return flow.
        </div>
      </section>
    </div>
  );
}
