import { useState } from 'react';
import { useStore } from '../../app/store';
import { PO, PO_STAGES } from '../../data/store';
import { movingAverage } from '../../domain/costing';
import { fmt, parseAmount } from '../../domain/money';
import { Pills, SpecOnly } from '../../components/ui';

const LINE_COLS = '1fr 80px 80px 100px 110px';
const RECEIVE_SKU = 'GRO-TUN-180';

/** Purchase order and receiving — FR-PUR-03/04/06, spec 7.3. */
export function PurchasingScreen() {
  const { state, dispatch } = useStore();
  const item = state.catalog.find((p) => p.sku === RECEIVE_SKU)!;
  const [qty, setQty] = useState('10');
  const [cost, setCost] = useState('30.00');
  const [discrepancy, setDiscrepancy] = useState('None');
  const [posted, setPosted] = useState('');
  const [grn, setGrn] = useState(115);
  const activeStage = PO_STAGES.indexOf(PO.status);

  const qtyN = Math.max(0, Math.floor(parseAmount(qty)));
  const costN = parseAmount(cost);
  const { newQty, newAvg } = movingAverage(item.stock, item.avgCost, qtyN, costN);
  const invalid = qtyN <= 0 || costN <= 0;

  const post = () => {
    if (invalid) return;
    const doc = `GRN-0${grn} against ${PO.number} · ${state.user ?? ''}`;
    setPosted(`GRN-0${grn} posted · on-hand ${item.stock} → ${newQty} · avg cost ${fmt(item.avgCost)} → ${fmt(newAvg)} · PURCHASE_IN +${qtyN} written to the stock card${discrepancy !== 'None' ? ` · discrepancy flagged: ${discrepancy}` : ''}`);
    dispatch({ type: 'receive', sku: RECEIVE_SKU, qty: qtyN, unitCost: costN, newAvg, doc });
    setGrn((g) => g + 1);
  };

  return (
    <div className="stack">
      <section className="card card--flush">
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow">purchase order</div>
            <h2 className="h-screen">{PO.number}</h2>
            <div className="lede">{PO.supplier} · {PO.terms} · TIN {PO.tin}</div>
          </div>
          <ol className="row-wrap" style={{ gap: 6, listStyle: 'none', margin: 0, padding: 0 }} aria-label="PO lifecycle">
            {PO_STAGES.map((s, i) => (
              <li key={s} className="mono" aria-current={i === activeStage ? 'step' : undefined}
                style={{
                  fontSize: 10, letterSpacing: '0.05em', padding: '5px 9px', borderRadius: 8,
                  ...(i === activeStage ? { background: 'var(--accent)', color: 'var(--on-accent)' }
                    : i < activeStage ? { background: 'var(--border)', color: 'var(--ink2)' }
                      : { background: 'var(--sunken)', color: 'var(--ink6)', border: '1px dashed var(--border-strong)' }),
                }}>{s.replace('_', ' ')}</li>
            ))}
          </ol>
        </div>
        <div className="hscroll">
          <div style={{ minWidth: 520 }}>
            <div className="thead" style={{ gridTemplateColumns: LINE_COLS, gap: 10 }}>
              <span>item</span><span className="right">ordered</span><span className="right">received</span><span className="right">unit cost</span><span className="right">line total</span>
            </div>
            {PO.lines.map((l) => (
              <div key={l.sku} className="trow" style={{ gridTemplateColumns: LINE_COLS, gap: 10 }}>
                <div className="min0"><div className="name">{l.name}</div><div className="meta">{l.sku}</div></div>
                <span className="num">{l.ordered}</span>
                <span className="num-b" style={{ color: l.received === 0 ? 'var(--ink6)' : l.received < l.ordered ? 'var(--warn-ink)' : 'var(--accent-ink)' }}>{l.received}</span>
                <span className="num">{fmt(l.cost)}</span>
                <span className="num-b">{fmt(l.ordered * l.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <section className="card card--pad" style={{ boxShadow: 'none' }}>
          <div className="eyebrow">goods receipt · GRN-0{grn}<SpecOnly> · FR-PUR-04</SpecOnly></div>
          <h3 className="h-card">Receive delivery</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px 110px', gap: 10, alignItems: 'end', marginBottom: 12 }}>
            <div>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink3)', marginBottom: 5 }}>Item</span>
              <div style={{ fontSize: 14, fontWeight: 600, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 11, background: 'var(--sunken)' }}>{item.name}</div>
            </div>
            <div>
              <label htmlFor="rq" style={{ display: 'block', fontSize: 11.5, color: 'var(--ink3)', marginBottom: 5 }}>Qty</label>
              <input id="rq" className="input mono" inputMode="numeric" style={{ fontSize: 16, padding: '10px 12px', borderRadius: 11 }} value={qty} onChange={(e) => { setQty(e.target.value); setPosted(''); }} />
            </div>
            <div>
              <label htmlFor="rc" style={{ display: 'block', fontSize: 11.5, color: 'var(--ink3)', marginBottom: 5 }}>Unit cost</label>
              <input id="rc" className="input mono" inputMode="decimal" style={{ fontSize: 16, padding: '10px 12px', borderRadius: 11 }} value={cost} onChange={(e) => { setCost(e.target.value); setPosted(''); }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Pills label="Discrepancy" options={['None', 'Short', 'Over', 'Damaged']} value={discrepancy} onChange={setDiscrepancy} />
          </div>
          <button type="button" className="btn btn-primary btn-block" style={{ fontSize: 14.5, padding: 15 }} onClick={post} disabled={invalid}>Post receipt · updates on-hand and cost</button>
          {invalid && <div className="alert alert-danger" style={{ marginTop: 12 }}>Quantity and unit cost must both be greater than zero.</div>}
          {posted && <div className="alert alert-info" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 11, lineHeight: 1.55 }} role="status">{posted}</div>}
        </section>

        <section className="card card--pad card--sunken">
          <div className="eyebrow">moving average<SpecOnly> · 7.3</SpecOnly></div>
          <h3 className="h-card" style={{ marginBottom: 14 }}>Cost recalculation</h3>
          <div className="mono" style={{ fontSize: 13, lineHeight: 2.1, color: 'var(--ink2)' }}>
            <div>on hand before&nbsp; <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{item.stock}</b> @ <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(item.avgCost)}</b></div>
            <div>receiving&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{qtyN}</b> @ <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(costN)}</b></div>
          </div>
          <div className="dashed" style={{ margin: '14px 0' }} />
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>new_avg = (qty × avg + recv × cost) ÷ (qty + recv)</div>
          <div style={{ display: 'flex', gap: 26, marginTop: 16, flexWrap: 'wrap' }}>
            <div><div className="figure-label">New on hand</div><div className="figure" style={{ fontSize: 26 }}>{newQty}</div></div>
            <div><div className="figure-label">New avg cost</div><div className="figure" style={{ fontSize: 26, color: 'var(--accent-ink)' }}>{fmt(newAvg)}</div></div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.6 }}>When on-hand is zero or negative before receipt, the new average is the receipt unit cost.</div>
        </section>
      </div>
    </div>
  );
}
