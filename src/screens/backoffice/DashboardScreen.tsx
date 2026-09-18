import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../app/store';
import { APPROVALS, KPIS, TOP_ITEMS } from '../../data/store';
import { suggestedOrder } from '../../domain/inventory';
import { Notice, SpecOnly, Tile } from '../../components/ui';

/** Manager dashboard — FR-INV-02, spec 7.4, 10.2. */
export function DashboardScreen() {
  const { state } = useStore();
  const [approvals, setApprovals] = useState(APPROVALS);
  const [notice, setNotice] = useState('');
  const low = state.catalog
    .filter((p) => p.stock <= p.reorder)
    .sort((a, b) => a.stock / a.reorder - b.stock / b.reorder);
  const cols = '1fr 70px 70px 90px';

  const decide = (id: string, verb: 'Approved' | 'Rejected') => {
    const a = approvals.find((x) => x.id === id);
    setApprovals((list) => list.filter((x) => x.id !== id));
    if (a) setNotice(`${verb}: ${a.title}. Decision written to the audit log.`);
  };

  const kpis = KPIS.map((k) =>
    k.label === 'Low stock' ? { ...k, value: String(low.length) } : k.label === 'Pending approvals' ? { ...k, value: String(approvals.length), sub: approvals.length ? k.sub : 'nothing waiting' } : k);

  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {kpis.map((k) => <Tile key={k.label} {...k} />)}
      </div>
      {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="card card--flush" style={{ borderRadius: 16 }}>
          <div className="card-head" style={{ padding: '16px 20px' }}>
            <span className="h-dash">Low stock · reorder</span>
            <SpecOnly><span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>FR-INV-02 · 7.4</span></SpecOnly>
          </div>
          <div className="thead" style={{ gridTemplateColumns: cols, gap: 8, padding: '9px 20px' }}>
            <span>item</span><span className="right">on hand</span><span className="right">reorder</span><span className="right">suggest</span>
          </div>
          {low.map((p) => (
            <Link key={p.sku} to={`/admin/inventory/${p.sku}`} className="trow trow--click" style={{ gridTemplateColumns: cols, gap: 8, padding: '11px 20px', color: 'inherit', textDecoration: 'none' }}>
              <div className="min0"><div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div><div className="meta">{p.sku}</div></div>
              <div className="num-b" style={{ color: p.stock < p.reorder * 0.6 ? 'var(--danger-ink)' : 'var(--warn-ink)' }}>{p.stock}</div>
              <div className="num" style={{ fontSize: 13, color: 'var(--ink4)' }}>{p.reorder}</div>
              <div className="num-b">+{suggestedOrder(p.stock, p.max)}</div>
            </Link>
          ))}
          {low.length === 0 && <div className="empty">Nothing at or below reorder level.</div>}
          <div style={{ padding: '14px 20px' }}>
            <Link to="/admin/purchasing" className="btn" style={{ display: 'inline-block', textDecoration: 'none', padding: '11px 16px', color: 'var(--ink)' }}>Create PO from low-stock list →</Link>
          </div>
        </section>

        <div className="stack">
          <section className="card card--flush" style={{ borderRadius: 16 }}>
            <div className="card-head" style={{ padding: '16px 20px' }}>
              <span className="h-dash">Pending approvals</span>
              <SpecOnly><span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>10.2</span></SpecOnly>
            </div>
            {approvals.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border-row)', flexWrap: 'wrap' }}>
                <span className="chip tone-accent" style={{ fontSize: 10, letterSpacing: '0.06em', border: '1px solid var(--accent-wash-border)' }}>{a.kind}</span>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>{a.sub}</div>
                </div>
                <div className="row" style={{ gap: 7 }}>
                  <button type="button" className="btn btn-sm" onClick={() => decide(a.id, 'Rejected')}>Reject</button>
                  <button type="button" className="btn btn-sm btn-solid" onClick={() => decide(a.id, 'Approved')}>Approve</button>
                </div>
              </div>
            ))}
            {approvals.length === 0 && <div className="empty" style={{ padding: 30 }}>No approvals waiting.</div>}
          </section>

          <section className="card card--flush" style={{ borderRadius: 16 }}>
            <div className="card-head" style={{ padding: '16px 20px' }}><span className="h-dash">Top items today</span></div>
            {TOP_ITEMS.map((t) => (
              <div key={t.name} style={{ padding: '11px 20px', borderBottom: '1px solid var(--border-row)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--ink2)' }}>{t.value}</span>
                </div>
                <div className="bar-track" role="presentation"><div className="bar-fill" style={{ width: `${t.pct}%` }} /></div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
