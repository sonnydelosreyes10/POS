import { useState, type CSSProperties } from 'react';
import { useStore } from '../../app/store';
import type { Product } from '../../data/catalog';
import { fmt } from '../../domain/money';
import { Notice, Pills, SpecOnly, Tile } from '../../components/ui';

interface Cell { text: string; style?: CSSProperties; className?: string; sub?: string }
interface ReportDef {
  label: string;
  grid: string;
  cols: [string, 'l' | 'r'][];
  rows: (catalog: Product[]) => Cell[][];
  tiles: { label: string; value: string; sub: string }[];
}

const num = 'num';
const numB = 'num-b';

const CHIP_TONE: Record<string, string> = {
  VOID: 'tone-danger', DISCOUNT: 'tone-accent', OVERRIDE: 'tone-warn', PRICE_CHANGE: 'tone-info', LOGIN_FAIL: 'tone-violet',
};

/** Report definitions are data-driven — add a fifth report by adding one entry (README §9). */
const DEFS: Record<string, ReportDef> = {
  summary: {
    label: 'Sales summary',
    grid: '108px 82px minmax(0,1fr) 116px minmax(0,1fr) 112px 108px',
    cols: [['date', 'l'], ['txns', 'r'], ['gross', 'r'], ['discount', 'r'], ['net of VAT', 'r'], ['VAT', 'r'], ['avg basket', 'r']],
    rows: () => ([
      ['Mon 08 Sep', 186, 41280, 742, 36194, 4344, 222],
      ['Tue 09 Sep', 174, 38955, 610, 34236, 4109, 224],
      ['Wed 10 Sep', 201, 45120, 985, 39406, 4729, 224],
      ['Thu 11 Sep', 193, 42860, 803, 37551, 4506, 222],
      ['Fri 12 Sep', 246, 58740, 1240, 51339, 6161, 239],
      ['Sat 13 Sep', 288, 71305, 1508, 62319, 7478, 248],
      ['Sun 14 Sep', 212, 49880, 1105, 43549, 5226, 235],
    ] as const).map((d) => [
      { text: d[0], style: { fontSize: 14, fontWeight: 600 } },
      { text: String(d[1]), className: num },
      { text: fmt(d[2]), className: numB },
      { text: fmt(-d[3]), className: num, style: { color: 'var(--danger-ink)' } },
      { text: fmt(d[4]), className: num },
      { text: fmt(d[5]), className: num },
      { text: fmt(d[6]), className: num },
    ]),
    tiles: [
      { label: 'Gross sales', value: '₱348,140', sub: '7 days · 1,500 transactions' },
      { label: 'Net of VAT', value: '₱304,594', sub: 'VAT ₱36,553 · exempt ₱7,340' },
      { label: 'Discounts given', value: '₱6,993', sub: '2.0% of gross · 41 overrides' },
      { label: 'Average basket', value: '₱232.09', sub: '4.7 items per sale' },
    ],
  },
  item: {
    label: 'Sales by item',
    grid: 'minmax(0,2fr) 96px 120px 128px 104px 112px',
    cols: [['item', 'l'], ['qty', 'r'], ['gross', 'r'], ['cost of sales', 'r'], ['margin', 'r'], ['share', 'r']],
    rows: () => ([
      ['Coffee 3-in-1 sachet', 'BEV-COF-3N1', 2184, 17472, 13541, 22.5, 5.0],
      ['Detergent sachet', 'HHC-DET-SCH', 1988, 18886, 14115, 25.3, 5.4],
      ['Instant noodles 55 g', 'GRO-NDL-055', 1372, 17150, 13446, 21.6, 4.9],
      ['Canned sardines 155 g', 'GRO-SRD-155', 1036, 29008, 22170, 23.6, 8.3],
      ['Softdrink 1.5 L', 'BEV-SFT-15L', 434, 32550, 25172, 22.7, 9.3],
      ['Rice 5 kg', 'GRO-RIC-5KG', 168, 47040, 40992, 12.9, 13.5],
      ['Eggs, tray of 30', 'GRO-EGG-TRY', 126, 30870, 28728, 6.9, 8.9],
    ] as const).map((d) => [
      { text: d[0], sub: d[1], style: { fontSize: 14, fontWeight: 600 } },
      { text: String(d[2]), className: numB },
      { text: fmt(d[3]), className: num },
      { text: fmt(d[4]), className: num, style: { fontSize: 12.5, color: 'var(--ink3)' } },
      { text: d[5].toFixed(1) + '%', className: numB, style: { color: 'var(--accent-ink)', fontSize: 13.5 } },
      { text: d[6].toFixed(1) + '%', className: num },
    ]),
    tiles: [
      { label: 'SKUs sold', value: '12', sub: 'of 12 active' },
      { label: 'Units sold', value: '7,308', sub: '7 days' },
      { label: 'Gross margin', value: '18.4%', sub: 'weighted, at moving average cost' },
      { label: 'Top category', value: 'Staples', sub: '22.4% of gross sales' },
    ],
  },
  valuation: {
    label: 'Inventory valuation',
    grid: 'minmax(0,2fr) 100px 112px 128px 104px 112px',
    cols: [['item', 'l'], ['on hand', 'r'], ['avg cost', 'r'], ['value at cost', 'r'], ['retail', 'r'], ['share', 'r']],
    rows: (catalog) => {
      const data = catalog.map((p) => ({ p, value: p.stock * p.avgCost, retail: p.stock * p.price })).sort((a, b) => b.value - a.value);
      const tot = data.reduce((a, x) => a + x.value, 0) || 1;
      return data.map(({ p, value, retail }) => [
        { text: p.name, sub: p.sku, style: { fontSize: 14, fontWeight: 600 } },
        { text: String(p.stock), className: numB },
        { text: fmt(p.avgCost), className: num },
        { text: fmt(value), className: numB },
        { text: fmt(retail), className: num, style: { fontSize: 12.5, color: 'var(--ink3)' } },
        { text: ((value / tot) * 100).toFixed(1) + '%', className: num },
      ]);
    },
    tiles: [],
  },
  exceptions: {
    label: 'Voids, discounts & overrides',
    grid: '132px 126px 132px minmax(0,1fr) 122px 108px',
    cols: [['timestamp', 'l'], ['action', 'l'], ['reference', 'l'], ['reason', 'l'], ['approver', 'l'], ['amount', 'r']],
    rows: () => ([
      ['14/09 09:12', 'VOID', 'T01-004398', 'Wrong customer, re-rung', 'R. Lim', 1240],
      ['14/09 11:40', 'DISCOUNT', 'T02-001884', 'Senior citizen, ID verified', 'R. Lim', 186],
      ['14/09 14:02', 'OVERRIDE', 'T01-004431', 'Discount above cashier limit', 'R. Lim', 420],
      ['14/09 16:55', 'PRICE_CHANGE', 'GRO-OIL-1L', 'Supplier cost increase', 'S. Delos Reyes', 98],
      ['15/09 08:31', 'LOGIN_FAIL', 'j.santos', '3 consecutive failures, no lock', '—', 0],
      ['15/09 17:20', 'VOID', 'T02-001902', 'Item out of stock after scan', 'R. Lim', 340],
    ] as const).map((d) => [
      { text: d[0], className: 'mono', style: { fontSize: 12.5, color: 'var(--ink3)' } },
      { text: d[1], className: `chip ${CHIP_TONE[d[1]] ?? 'tone-neutral'}`, style: { display: 'inline-block', padding: '4px 8px' } },
      { text: d[2], className: 'mono', style: { fontSize: 12.5 } },
      { text: d[3], style: { fontSize: 13.5 } },
      { text: d[4], style: { fontSize: 13.5 } },
      { text: d[5] ? fmt(d[5]) : '—', className: num },
    ]),
    tiles: [
      { label: 'Voids', value: '14', sub: '0.9% of transactions' },
      { label: 'Discount overrides', value: '41', sub: 'all manager-approved' },
      { label: 'Price changes', value: '6', sub: 'all logged with actor' },
      { label: 'Failed logins', value: '9', sub: '1 lockout, resolved' },
    ],
  },
};

function valuationTiles(catalog: Product[]) {
  const cost = catalog.reduce((a, p) => a + p.stock * p.avgCost, 0);
  const retail = catalog.reduce((a, p) => a + p.stock * p.price, 0);
  const whole = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
  return [
    { label: 'Value at cost', value: whole(cost), sub: `moving average · ${catalog.length} SKUs` },
    { label: 'Value at retail', value: whole(retail), sub: 'VAT-inclusive selling price' },
    { label: 'Unrealised margin', value: whole(retail - cost), sub: `${retail ? (((retail - cost) / retail) * 100).toFixed(1) : '0.0'}% of retail` },
    { label: 'Dead stock', value: '0', sub: 'no movement in 60 days' },
  ];
}

const RANGES = ['Today', 'This week', 'This month', 'Custom'] as const;

/** Reports — spec 4.7. */
export function ReportsScreen() {
  const { state } = useStore();
  const [type, setType] = useState('summary');
  const [range, setRange] = useState<string>('This month');
  const [from, setFrom] = useState('2026-09-01');
  const [to, setTo] = useState('2026-09-16');
  const [notice, setNotice] = useState('');
  const def = DEFS[type];
  const rows = def.rows(state.catalog);
  const tiles = type === 'valuation' ? valuationTiles(state.catalog) : def.tiles;

  const exportCsv = () => {
    const header = def.cols.map((c) => c[0]);
    const body = rows.map((r) => r.map((c) => c.text));
    const csv = [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${def.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
    setNotice('CSV downloaded from the on-screen figures. In production exports are generated server-side and carry the covering period and store TIN.');
  };

  return (
    <div className="stack">
      <section className="card" style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow">reporting<SpecOnly> · 4.7</SpecOnly></div>
            <h2 className="h-screen">Reports</h2>
            <div className="lede">{range === 'Custom' ? `${from} – ${to}` : range} · figures come from the server, so a terminal running offline never changes them</div>
          </div>
          <div className="row-wrap no-print" style={{ gap: 9 }}>
            <button type="button" className="btn" style={{ padding: '12px 16px' }} onClick={exportCsv}>Export CSV</button>
            <button type="button" className="btn" style={{ padding: '12px 16px' }} onClick={() => window.print()}>Export PDF</button>
          </div>
        </div>
        <div className="row-wrap" style={{ gap: 12 }}>
          <Pills label="Range" options={RANGES} value={range} onChange={setRange} />
          {range === 'Custom' && (
            <div className="row" style={{ gap: 8 }}>
              <input type="date" aria-label="From" className="input mono" style={{ width: 'auto', padding: '7px 10px', fontSize: 13 }} value={from} onChange={(e) => setFrom(e.target.value)} />
              <span style={{ color: 'var(--ink4)' }}>–</span>
              <input type="date" aria-label="To" className="input mono" style={{ width: 'auto', padding: '7px 10px', fontSize: 13 }} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
        </div>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <Pills label="Report type" options={Object.entries(DEFS).map(([value, d]) => ({ value, label: d.label }))} value={type} onChange={setType} />
        {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {tiles.map((t) => <Tile key={t.label} {...t} />)}
      </div>

      <section className="card card--flush card--elevated">
        <div className="hscroll">
          <div style={{ minWidth: 880 }}>
            <div className="thead" style={{ gridTemplateColumns: def.grid, padding: '12px 26px' }}>
              {def.cols.map(([label, align]) => <span key={label} className={align === 'r' ? 'right' : ''}>{label}</span>)}
            </div>
            {rows.map((r, i) => (
              <div key={i} className="trow" style={{ gridTemplateColumns: def.grid, padding: '13px 26px' }}>
                {r.map((c, j) => (
                  <div key={j} className="min0">
                    <div className={c.className} style={c.style}>{c.text}</div>
                    {c.sub && <div className="meta">{c.sub}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="card-foot" style={{ padding: '18px 26px' }}>
          Every report reads the same posted sales and stock movements — no report recalculates its own totals. Exports carry the covering period, the store TIN, and the user who ran them.
        </div>
      </section>
    </div>
  );
}
