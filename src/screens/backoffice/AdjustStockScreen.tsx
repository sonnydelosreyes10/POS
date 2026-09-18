import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../app/store';
import { ADJUSTMENT_REASONS, directionForReason, movementTypeForReason, type AdjustmentReason } from '../../domain/adjustments';
import { OverrideModal } from '../../components/OverrideModal';
import { Notice, Pills, SpecOnly } from '../../components/ui';

/** Manual stock adjustment — FR-INV-04. Reason code and manager approval are both required. */
export function AdjustStockScreen() {
  const { sku = '' } = useParams();
  const { state, dispatch } = useStore();
  const p = state.catalog.find((x) => x.sku === sku);
  const [reason, setReason] = useState<AdjustmentReason>('DAMAGED');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const [posted, setPosted] = useState('');

  if (!p) return <div className="card card--pad empty">No product with SKU <span className="mono">{sku}</span>. <Link to="/admin/inventory">Back to inventory</Link></div>;

  const fixedDir = directionForReason(reason);
  const dir = fixedDir ?? direction;
  const qtyN = Math.max(0, parseInt(qty.replace(/[^0-9]/g, ''), 10) || 0);
  const qtyChange = dir * qtyN;
  const type = movementTypeForReason(reason);
  const newStock = p.stock + qtyChange;
  const invalid = qtyN <= 0 || note.trim().length < 5 || newStock < 0;

  const submit = () => {
    if (invalid) return;
    dispatch({ type: 'requestAdjustment', adjustment: { sku: p.sku, name: p.name, qtyChange, reason, note: note.trim() } });
  };

  const onAdjusted = () => {
    setPosted(`${type} ${qtyChange >= 0 ? '+' : ''}${qtyChange} posted · on-hand ${p.stock} → ${newStock}. Entry added to the audit log.`);
    setQty('1');
    setNote('');
  };

  return (
    <>
      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <section className="card card--pad">
          <div className="eyebrow"><Link to={`/admin/inventory/${p.sku}`} style={{ color: 'inherit' }}>{p.sku}</Link> / manual adjustment<SpecOnly> · FR-INV-04</SpecOnly></div>
          <h2 className="h-screen" style={{ fontSize: 22 }}>{p.name}</h2>
          <div className="lede" style={{ marginBottom: 18 }}>On hand only changes through sales, receipts, counts and approved adjustments — never a direct edit.</div>

          <div style={{ marginBottom: 16 }}>
            <span className="field-label">Reason code</span>
            <Pills options={ADJUSTMENT_REASONS} value={reason} onChange={(r) => { setReason(r); setPosted(''); }} />
          </div>

          {fixedDir === null && (
            <div style={{ marginBottom: 16 }}>
              <span className="field-label">Direction</span>
              <div className="row-wrap" role="group" aria-label="Direction">
                <button type="button" className="pill" aria-pressed={direction === 1} onClick={() => { setDirection(1); setPosted(''); }}>Add stock</button>
                <button type="button" className="pill" aria-pressed={direction === -1} onClick={() => { setDirection(-1); setPosted(''); }}>Remove stock</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label htmlFor="adj-qty" className="field-label">Quantity</label>
              <input id="adj-qty" className="input mono" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/[^0-9]/g, '')); setPosted(''); }} />
            </div>
            <div>
              <label htmlFor="adj-note" className="field-label">Note (required)</label>
              <input id="adj-note" className="input" placeholder="e.g. 4 units crushed in a stockroom shelving accident" value={note} onChange={(e) => { setNote(e.target.value); setPosted(''); }} />
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-block" style={{ fontSize: 14.5, padding: 15 }} onClick={submit} disabled={invalid}>
            Submit for approval · {type} {qtyChange >= 0 ? '+' : ''}{qtyChange}
          </button>
          {newStock < 0 && <div className="alert alert-danger" style={{ marginTop: 12 }}>On-hand cannot go below zero.</div>}
          {posted && <div style={{ marginTop: 14 }}><Notice onDismiss={() => setPosted('')}>{posted}</Notice></div>}
        </section>

        <section className="card card--pad card--sunken">
          <div className="eyebrow">preview</div>
          <h3 className="h-card" style={{ marginBottom: 14 }}>What will post</h3>
          <div className="mono" style={{ fontSize: 13, lineHeight: 2.1, color: 'var(--ink2)' }}>
            <div>movement type&nbsp; <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{type}</b></div>
            <div>on hand before&nbsp; <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{p.stock}</b></div>
          </div>
          <div className="dashed" style={{ margin: '14px 0' }} />
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <div><div className="figure-label">Change</div><div className="figure" style={{ fontSize: 26, color: qtyChange >= 0 ? 'var(--accent-ink)' : 'var(--danger-ink)' }}>{qtyChange >= 0 ? '+' : ''}{qtyChange}</div></div>
            <div><div className="figure-label">New on hand</div><div className="figure" style={{ fontSize: 26 }}>{Math.max(newStock, 0)}</div></div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.6 }}>Requires a manager PIN before it posts. Reason code and note are both required — spec 6.4, FR-INV-04.</div>
        </section>
      </div>
      <OverrideModal onAdjusted={onAdjusted} />
    </>
  );
}
