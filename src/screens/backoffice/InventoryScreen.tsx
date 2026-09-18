import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../app/store';
import { CATEGORIES } from '../../data/catalog';
import { stockStatus, suggestedOrder, type StockStatus } from '../../domain/inventory';
import { fmt, round2 } from '../../domain/money';
import { Pills, SpecOnly, Tile } from '../../components/ui';

const STATUS_TONE: Record<StockStatus, string> = {
  'Out of stock': 'tone-danger', 'Below reorder': 'tone-warn', Overstocked: 'tone-info', Healthy: 'tone-accent',
};
const COLS = 'minmax(0, 2.1fr) 116px 110px 92px 104px 126px 118px';

/** Inventory catalog — FR-INV-01/03/05. */
export function InventoryScreen() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('All');
  const [status, setStatus] = useState<string>('All');

  const all = useMemo(() => state.catalog.map((p) => ({
    p, value: round2(p.stock * p.avgCost), status: stockStatus(p.stock, p.reorder, p.max),
  })), [state.catalog]);

  const stats = useMemo(() => {
    let value = 0, below = 0, out = 0, units = 0;
    for (const r of all) {
      value += r.value;
      if (r.p.stock === 0) out++;
      else if (r.p.stock <= r.p.reorder) { below++; units += suggestedOrder(r.p.stock, r.p.max); }
    }
    return { value: round2(value), below, out, units };
  }, [all]);

  const needle = q.trim().toLowerCase();
  const rows = all
    .filter((r) => !needle || r.p.name.toLowerCase().includes(needle) || r.p.sku.toLowerCase().includes(needle) || r.p.barcode.includes(needle))
    .filter((r) => cat === 'All' || r.p.category === cat)
    .filter((r) => status === 'All' || r.status === status);

  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        <Tile label="Active SKUs" value={String(state.catalog.length)} sub={`across ${CATEGORIES.length} categories`} />
        <Tile label="Stock at cost" value={fmt(stats.value)} sub="moving average" />
        <Tile label="Below reorder" value={String(stats.below)} sub={`suggested order ${stats.units} units`} />
        <Tile label="Out of stock" value={String(stats.out)} sub={stats.out === 0 ? 'no lost sales today' : 'blocks sale'} />
      </div>

      <section className="card card--flush card--elevated">
        <div style={{ padding: '24px 26px 18px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="eyebrow">product catalog<SpecOnly> · FR-INV-05</SpecOnly></div>
              <h2 className="h-screen">Inventory</h2>
              <div className="lede">{rows.length} of {state.catalog.length} SKUs · on-hand shown is the running balance of stock movements, never a typed figure</div>
            </div>
            <div className="row-wrap" style={{ gap: 9 }}>
              <button type="button" className="btn" style={{ padding: '12px 16px' }}
                onClick={() => navigate('/admin/inventory/count')}>Start physical count</button>
              <button type="button" className="btn btn-primary" style={{ padding: '12px 18px' }}
                onClick={() => navigate('/admin/maintenance')}>New product</button>
            </div>
          </div>
          <div className="row-wrap" style={{ gap: 12 }}>
            <label htmlFor="inv-search" className="visually-hidden">Search name, SKU or barcode</label>
            <input id="inv-search" className="input mono" style={{ flex: 1, minWidth: 200, fontSize: 13.5, fontWeight: 400 }} placeholder="Search name, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
            <Pills label="Status" options={['All', 'Below reorder', 'Out of stock', 'Overstocked']} value={status} onChange={setStatus} />
          </div>
          <Pills label="Category" options={['All', ...CATEGORIES]} value={cat} onChange={setCat} />
        </div>

        <div className="hscroll">
          <div style={{ minWidth: 900 }}>
            <div className="thead" style={{ gridTemplateColumns: COLS, padding: '10px 26px' }}>
              <span>item</span><span>category</span><span className="right">price</span><span className="right">on hand</span><span className="right">reorder / max</span><span className="right">value at cost</span><span>status</span>
            </div>
            {rows.map(({ p, value, status: st }) => (
              <div key={p.sku} role="link" tabIndex={0} className="trow trow--click" style={{ gridTemplateColumns: COLS, padding: '13px 26px' }}
                onClick={() => navigate(`/admin/inventory/${p.sku}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/admin/inventory/${p.sku}`); }}>
                <div className="min0"><div className="name">{p.name}</div><div className="meta">{p.sku} · {p.barcode}</div></div>
                <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{p.category}</div>
                <div className="right"><div className="num-b">{fmt(p.price)}</div><div className="meta">cost {fmt(p.avgCost)}</div></div>
                <div className="right">
                  <div className="num-b" style={{ fontSize: 16, color: p.stock === 0 ? 'var(--danger-ink)' : p.stock <= p.reorder ? 'var(--warn-ink)' : 'var(--ink)' }}>{p.stock}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>{p.unit}{p.vatExempt ? ' · exempt' : ''}</div>
                </div>
                <div className="num" style={{ fontSize: 13, color: 'var(--ink3)' }}>{p.reorder} / {p.max}</div>
                <div className="num-b">{fmt(value)}</div>
                <span className={`badge ${STATUS_TONE[st]}`}>{st}</span>
              </div>
            ))}
            {rows.length === 0 && <div className="empty" style={{ padding: '70px 26px' }}>No product matches this filter.</div>}
          </div>
        </div>
        <div className="card-foot" style={{ padding: '18px 26px' }}>
          Selecting a row opens its stock card. Editing a price writes a <span className="mono">PRICE_CHANGE</span> entry to the audit log; quantities change only through sales, receipts, counts and adjustments.
        </div>
      </section>
    </div>
  );
}
