import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../app/store';
import { variance as varianceOf } from '../../domain/inventory';
import { OverrideModal } from '../../components/OverrideModal';
import { Notice, SpecOnly } from '../../components/ui';

const COLS = 'minmax(0, 1.8fr) 100px 120px 100px';

interface Row { sku: string; name: string; unit: string; systemQty: number; countedQty: number | null; variance: number }

/** Physical count session — FR-INV-03, spec 5.7, TC-09. */
export function PhysicalCountScreen() {
  const { state, dispatch } = useStore();
  // System quantities are frozen the moment the session opens, per the handoff — not live-recomputed mid-count.
  const [snapshot, setSnapshot] = useState(() => state.catalog.map((p) => ({ sku: p.sku, name: p.name, unit: p.unit, systemQty: p.stock })));
  const [openedAt] = useState(() => new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }));
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [posted, setPosted] = useState<{ seq: number; lines: Row[] } | null>(null);
  const sessionSeq = state.countSeq;

  const rows: Row[] = snapshot.map((r) => {
    const raw = counted[r.sku];
    const countedQty = raw === undefined || raw === '' ? null : parseInt(raw, 10) || 0;
    return { ...r, countedQty, variance: countedQty === null ? 0 : varianceOf(r.systemQty, countedQty) };
  });

  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.sku.toLowerCase().includes(needle));
  const countedCount = rows.filter((r) => r.countedQty !== null).length;
  const varianceLines = rows.filter((r) => r.countedQty !== null && r.variance !== 0);

  const setQty = (sku: string, v: string) => { setCounted((c) => ({ ...c, [sku]: v.replace(/[^0-9]/g, '') })); setPosted(null); };

  const submitForApproval = () => {
    if (varianceLines.length === 0) return;
    dispatch({ type: 'requestCount', lines: varianceLines.map((r) => ({ sku: r.sku, name: r.name, systemQty: r.systemQty, countedQty: r.countedQty!, variance: r.variance })) });
  };

  const onCounted = () => {
    setPosted({ seq: sessionSeq, lines: varianceLines });
    // The approved variances are now real stock_movements — re-freeze the sheet on top of them for the next session.
    setSnapshot((rows) => rows.map((r) => {
      const applied = varianceLines.find((v) => v.sku === r.sku);
      return applied ? { ...r, systemQty: applied.countedQty! } : r;
    }));
    setReviewing(false);
    setCounted({});
  };

  return (
    <>
      <div className="stack">
        <section className="card card--flush card--elevated">
          <div style={{ padding: '24px 26px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="eyebrow"><Link to="/admin/inventory" style={{ color: 'inherit' }}>inventory</Link> / physical count<SpecOnly> · FR-INV-03</SpecOnly></div>
              <h2 className="h-screen">Count session CNT-00{sessionSeq}</h2>
              <div className="lede">Opened {openedAt} · system quantities frozen at open. Variances post as <span className="mono">ADJUSTMENT</span> only after manager approval.</div>
            </div>
            <div className="row-wrap" style={{ gap: 9 }}>
              {!reviewing ? (
                <button type="button" className="btn btn-primary" style={{ padding: '12px 18px' }} disabled={countedCount === 0} onClick={() => setReviewing(true)}>
                  Review {varianceLines.length ? `${varianceLines.length} variance${varianceLines.length === 1 ? '' : 's'}` : 'count'}
                </button>
              ) : (
                <button type="button" className="btn" style={{ padding: '12px 18px' }} onClick={() => setReviewing(false)}>Back to counting</button>
              )}
            </div>
          </div>

          {!reviewing ? (
            <>
              <div style={{ padding: '14px 26px', borderBottom: '1px solid var(--border)' }}>
                <label htmlFor="cnt-search" className="visually-hidden">Search name or SKU</label>
                <input id="cnt-search" className="input mono" style={{ maxWidth: 340, fontSize: 13.5, fontWeight: 400 }} placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="hscroll">
                <div style={{ minWidth: 620 }}>
                  <div className="thead" style={{ gridTemplateColumns: COLS, padding: '10px 26px' }}>
                    <span>item</span><span className="right">system qty</span><span className="right">counted qty</span><span className="right">variance</span>
                  </div>
                  {filtered.map((r) => (
                    <div key={r.sku} className="trow" style={{ gridTemplateColumns: COLS, padding: '11px 26px' }}>
                      <div className="min0"><div className="name">{r.name}</div><div className="meta">{r.sku}</div></div>
                      <span className="num">{r.systemQty} <span style={{ color: 'var(--ink5)' }}>{r.unit}</span></span>
                      <input className="input mono right" inputMode="numeric" placeholder="—" style={{ padding: '7px 10px', borderRadius: 9, fontSize: 13.5, textAlign: 'right' }}
                        value={counted[r.sku] ?? ''} onChange={(e) => setQty(r.sku, e.target.value)} />
                      <span className="num-b" style={{ color: r.countedQty === null ? 'var(--ink6)' : r.variance === 0 ? 'var(--ink4)' : r.variance > 0 ? 'var(--accent-ink)' : 'var(--danger-ink)' }}>
                        {r.countedQty === null ? '—' : r.variance === 0 ? '0' : (r.variance > 0 ? '+' : '−') + Math.abs(r.variance)}
                      </span>
                    </div>
                  ))}
                  {filtered.length === 0 && <div className="empty">No item matches this search.</div>}
                </div>
              </div>
              <div className="card-foot" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>{countedCount} of {rows.length} items counted.</span>
                <span>On-hand only changes once a manager approves the posted variances.</span>
              </div>
            </>
          ) : (
            <div style={{ padding: '22px 26px' }}>
              <h3 className="h-card">Variances to post</h3>
              {varianceLines.length === 0 ? (
                <div className="empty" style={{ padding: '40px 8px' }}>No variances — every counted item matched the system quantity.</div>
              ) : (
                <>
                  <div className="thead" style={{ gridTemplateColumns: COLS, padding: '9px 4px', background: 'transparent', borderBottom: '1px solid var(--border)' }}>
                    <span>item</span><span className="right">system</span><span className="right">counted</span><span className="right">variance</span>
                  </div>
                  {varianceLines.map((r) => (
                    <div key={r.sku} className="trow" style={{ gridTemplateColumns: COLS, padding: '11px 4px' }}>
                      <div className="min0"><div className="name">{r.name}</div><div className="meta">{r.sku}</div></div>
                      <span className="num">{r.systemQty}</span>
                      <span className="num">{r.countedQty}</span>
                      <span className="num-b" style={{ color: r.variance > 0 ? 'var(--accent-ink)' : 'var(--danger-ink)' }}>{r.variance > 0 ? '+' : '−'}{Math.abs(r.variance)}</span>
                    </div>
                  ))}
                  <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 18, fontSize: 14.5, padding: 15 }} onClick={submitForApproval}>
                    Submit for manager approval
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {posted && (
          <Notice onDismiss={() => setPosted(null)}>
            CNT-00{posted.seq} approved · {posted.lines.length} ADJUSTMENT movement{posted.lines.length === 1 ? '' : 's'} written, on-hand updated. Entry added to the audit log.
          </Notice>
        )}
      </div>
      <OverrideModal onCounted={onCounted} />
    </>
  );
}
