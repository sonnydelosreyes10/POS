import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../app/store';
import { withBalance, type MovementType } from '../../domain/inventory';
import { fmt, round2 } from '../../domain/money';
import { SpecOnly } from '../../components/ui';

const TONE: Record<MovementType, string> = {
  OPENING: 'tone-violet', PURCHASE_IN: 'tone-accent', SALE: 'tone-danger', ADJUSTMENT: 'tone-warn',
  RETURN_IN: 'tone-info', DAMAGED: 'tone-danger', EXPIRED: 'tone-danger', TRANSFER_IN: 'tone-teal', TRANSFER_OUT: 'tone-teal',
};
const COLS = '112px 150px 1fr 90px 100px';

/** Stock card — FR-INV-06. On-hand is derived from movements, never edited. */
export function StockCardScreen() {
  const { sku = 'GRO-SRD-155' } = useParams();
  const { state } = useStore();
  const p = state.catalog.find((x) => x.sku === sku);

  if (!p) return <div className="card card--pad empty">No product with SKU <span className="mono">{sku}</span>. <Link to="/admin/inventory">Back to inventory</Link></div>;

  const known = state.movements[sku];
  // Products without sample history get a single opening movement equal to on-hand.
  const rows = withBalance(known ?? [{ date: '2026-08-01', type: 'OPENING', doc: 'Go-live stock load', qty: p.stock }]);

  return (
    <section className="card card--flush">
      <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="eyebrow"><Link to="/admin/inventory" style={{ color: 'inherit' }}>inventory</Link> / stock card<SpecOnly> · FR-INV-06</SpecOnly></div>
          <h2 className="h-screen">{p.name}</h2>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{p.sku} · {p.barcode} · {p.unit} · {p.category}</div>
        </div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><div className="figure-label">On hand</div><div className="figure">{p.stock}</div></div>
          <div><div className="figure-label">Avg cost</div><div className="figure">{fmt(p.avgCost)}</div></div>
          <div><div className="figure-label">Value</div><div className="figure">{fmt(round2(p.stock * p.avgCost))}</div></div>
          <Link to={`/admin/inventory/${p.sku}/adjust`} className="btn" style={{ textDecoration: 'none' }}>Adjust stock</Link>
        </div>
      </div>
      <div className="hscroll">
        <div style={{ minWidth: 640 }}>
          <div className="thead" style={{ gridTemplateColumns: COLS, gap: 10 }}>
            <span>date</span><span>type</span><span>document · actor</span><span className="right">qty</span><span className="right">balance</span>
          </div>
          {rows.map((m, i) => (
            <div key={i} className="trow" style={{ gridTemplateColumns: COLS, gap: 10, padding: '12px 24px' }}>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{m.date}</span>
              <span className={`chip ${TONE[m.type]}`}>{m.type}</span>
              <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>{m.doc}</span>
              <span className="num-b" style={{ color: m.qty > 0 ? 'var(--accent-ink)' : 'var(--danger-ink)' }}>{m.qty > 0 ? '+' : '−'}{Math.abs(m.qty)}</span>
              <span className="num-b">{m.balance}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card-foot">
        On-hand is never edited directly. Every row above is an immutable <span className="mono">stock_movement</span> tied to a document and a user; the balance column is a running sum.
      </div>
    </section>
  );
}
