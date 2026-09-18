import { useState } from 'react';
import { useStore, type Settings } from '../../app/store';
import { CATEGORIES, type Category, type Product } from '../../data/catalog';
import { AUDIT_ROWS, BACKUP_ROWS, SUPPLIERS, TERMINALS } from '../../data/store';
import { fmt, parseAmount } from '../../domain/money';
import { Notice, Pills, SpecOnly } from '../../components/ui';
import { CURRENCY } from '../../app/config';

const TABS = [
  { value: 'items', label: 'Item maintenance' },
  { value: 'settings', label: 'Store settings' },
  { value: 'devices', label: 'Terminals & suppliers' },
  { value: 'backup', label: 'Backup & audit' },
];

/** Maintenance — spec 9.2, 10.2. Owner and manager only (enforce server-side, NFR-04). */
export function MaintenanceScreen() {
  const [tab, setTab] = useState('items');
  const [notice, setNotice] = useState('');

  return (
    <div className="stack">
      <section className="card" style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="eyebrow">administration<SpecOnly> · 9.2, 10.2</SpecOnly></div>
          <h2 className="h-screen">Maintenance</h2>
          <div className="lede">Owner and manager only. Every change on this page is written to the audit log with the acting user. User accounts and roles are managed on the Admin page.</div>
        </div>
        <Pills label="Section" options={TABS} value={tab} onChange={(t) => { setTab(t); setNotice(''); }} />
        {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}
      </section>
      {tab === 'items' && <ItemsTab onNotice={setNotice} />}
      {tab === 'settings' && <SettingsTab onNotice={setNotice} />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'backup' && <BackupTab onNotice={setNotice} />}
    </div>
  );
}

type TaxOption = 'VATable' | 'VAT-exempt';
type Draft = {
  sku: string; name: string; barcode: string; unit: string; price: string; reorder: string; max: string;
  category: Category; stock: string; avgCost: string; vatExempt: TaxOption;
};

const emptyDraft = (): Draft => ({
  sku: '', name: '', barcode: '', unit: 'pc', price: '', reorder: '', max: '',
  category: CATEGORIES[0], stock: '', avgCost: '', vatExempt: 'VATable',
});

const draftOf = (x: Product): Draft => ({
  sku: x.sku, name: x.name, barcode: x.barcode, unit: x.unit, price: x.price.toFixed(2),
  reorder: String(x.reorder), max: String(x.max), category: x.category,
  stock: String(x.stock), avgCost: x.avgCost.toFixed(2), vatExempt: x.vatExempt ? 'VAT-exempt' : 'VATable',
});

function ItemsTab({ onNotice }: { onNotice: (s: string) => void }) {
  const { state, dispatch } = useStore();
  const [sku, setSku] = useState<string>(state.catalog[0].sku);
  const p = sku === '' ? undefined : state.catalog.find((x) => x.sku === sku);
  const base = (): Draft => (p ? draftOf(p) : emptyDraft());
  const [draft, setDraft] = useState<Draft>(base);
  const [error, setError] = useState('');
  const dirty = !!p && JSON.stringify(draft) !== JSON.stringify(base());
  const newHasInput = !p && (draft.sku.trim() || draft.name.trim() || draft.barcode.trim() || draft.price.trim());

  const pick = (s: string) => {
    if ((dirty || newHasInput) && !window.confirm('Discard unsaved changes to this item?')) return;
    const np = state.catalog.find((x) => x.sku === s)!;
    setSku(s);
    setDraft(draftOf(np));
    setError('');
  };

  const startNew = () => {
    if (dirty && !window.confirm('Discard unsaved changes to this item?')) return;
    setSku('');
    setDraft(emptyDraft());
    setError('');
  };

  const price = parseAmount(draft.price);
  const net = price / (1 + state.settings.vatRate);
  const margin = p && price > 0 ? (((net - p.avgCost) / net) * 100).toFixed(1) + '%' : '—';

  const save = () => {
    const reorder = parseInt(draft.reorder, 10), max = parseInt(draft.max, 10);
    const newSku = draft.sku.trim();
    if (!p) {
      if (!newSku) return setError('SKU is required.');
      if (state.catalog.some((x) => x.sku === newSku)) return setError('SKU already exists.');
    }
    if (!draft.name.trim()) return setError('Item name is required.');
    if (!(price > 0)) return setError('Selling price must be greater than zero.');
    if (!(reorder >= 0) || !(max > 0) || reorder > max) return setError('Reorder and maximum level are required, and reorder cannot exceed maximum.');
    if (state.catalog.some((x) => x.sku !== sku && x.barcode === draft.barcode.trim())) return setError('Barcode must be unique.');

    if (!p) {
      const stock = parseInt(draft.stock, 10);
      const avgCost = parseAmount(draft.avgCost);
      if (!(stock >= 0)) return setError('Opening stock is required and cannot be negative.');
      if (!(avgCost >= 0)) return setError('Initial unit cost is required and cannot be negative.');
      const id = Math.max(0, ...state.catalog.map((x) => x.id)) + 1;
      const created: Product = {
        id, sku: newSku, barcode: draft.barcode.trim(), name: draft.name.trim(), category: draft.category,
        price, unit: draft.unit.trim() || 'pc', stock, vatExempt: draft.vatExempt === 'VAT-exempt', avgCost, reorder, max,
      };
      dispatch({ type: 'addProduct', product: created });
      setSku(created.sku);
      setDraft(draftOf(created));
      setError('');
      onNotice(`Item added · ${created.sku} written to the audit log.`);
      return;
    }

    const saved = { ...p, name: draft.name.trim(), barcode: draft.barcode.trim(), unit: draft.unit.trim(), price, reorder, max, category: draft.category };
    dispatch({ type: 'saveProduct', product: saved });
    setDraft(draftOf(saved));
    setError('');
    onNotice(price !== p.price
      ? `Item saved · PRICE_CHANGE ${sku} ${fmt(p.price)} → ${fmt(price)} written to the audit log; terminals pick it up on next sync.`
      : 'Item saved · change written to the audit log.');
  };

  const fields: { key: keyof Draft; label: string; mono?: boolean; wide?: boolean; mode?: 'decimal' | 'numeric' }[] = [
    ...(p ? [] : [{ key: 'sku' as const, label: 'SKU', mono: true }]),
    { key: 'name', label: 'Item name', wide: true },
    { key: 'barcode', label: 'Barcode', mono: true, mode: 'numeric' },
    { key: 'unit', label: 'Unit' },
    { key: 'price', label: 'Selling price, VAT-inclusive', mono: true, mode: 'decimal' },
    { key: 'reorder', label: 'Reorder level', mono: true, mode: 'numeric' },
    { key: 'max', label: 'Maximum level', mono: true, mode: 'numeric' },
    ...(p ? [] : [
      { key: 'stock' as const, label: 'Opening stock', mono: true, mode: 'numeric' as const },
      { key: 'avgCost' as const, label: 'Initial unit cost', mono: true, mode: 'decimal' as const },
    ]),
  ];

  return (
    <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <section className="card" style={{ padding: 24 }}>
        <div className="card-head" style={{ padding: 0, border: 'none', marginBottom: 16 }}>
          <span className="h-section">{p ? 'Edit item' : 'New item'}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>{p ? sku : 'not yet saved'}<SpecOnly> · FR-INV-05</SpecOnly></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          {fields.map((f) => (
            <div key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
              <label className="field-label" htmlFor={`f-${f.key}`}>{f.label}</label>
              <input id={`f-${f.key}`} className={'input' + (f.mono ? ' mono' : '')} inputMode={f.mode} value={draft[f.key] as string}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <span className="field-label" style={{ margin: '16px 0 8px' }}>Category</span>
        <Pills label="Category" options={CATEGORIES} value={draft.category} onChange={(c) => setDraft((d) => ({ ...d, category: c }))} />
        {!p && (
          <>
            <span className="field-label" style={{ margin: '16px 0 8px' }}>Tax</span>
            <Pills label="Tax" options={['VATable', 'VAT-exempt'] as const} value={draft.vatExempt} onChange={(v) => setDraft((d) => ({ ...d, vatExempt: v }))} />
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 22 }}>
          <button type="button" className="btn" style={{ padding: 14 }} onClick={() => { setDraft(base()); setError(''); }} disabled={!!p && !dirty}>Revert</button>
          <button type="button" className="btn btn-primary" style={{ padding: 14, fontSize: 14 }} onClick={save} disabled={!!p && !dirty}>{p ? 'Save item' : 'Create item'}</button>
        </div>
        {p && (
          <button type="button" className="btn btn-danger btn-block" style={{ marginTop: 10 }}
            onClick={() => onNotice('Items are archived, never deleted — history and past receipts must keep resolving. An archived item stops appearing in search and on the product grid.')}>Archive item</button>
        )}
        {error && <div className="alert alert-danger" style={{ marginTop: 14 }} role="alert">{error}</div>}
        {p && dirty && !error && <div className="alert alert-warn" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12 }}>Unsaved changes. Prices take effect only after saving, and never mid-transaction on a terminal.</div>}
      </section>

      <div className="stack">
        <section className="card" style={{ padding: 24 }}>
          <div className="h-section" style={{ marginBottom: 14 }}>Derived</div>
          {p ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
                <div><div className="figure-label">On hand</div><div className="figure">{p.stock}</div></div>
                <div><div className="figure-label">Avg cost</div><div className="figure">{fmt(p.avgCost)}</div></div>
                <div><div className="figure-label">Gross margin</div><div className="figure" style={{ color: 'var(--accent-ink)' }}>{margin}</div></div>
                <div><div className="figure-label">Tax</div><div style={{ fontSize: 17, fontWeight: 600, marginTop: 6 }}>{p.vatExempt ? 'VAT-exempt' : 'VATable'}</div></div>
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6 }}>On hand and average cost are not editable here. They move only through sales, receipts, counts and adjustments. Margin is computed on the VAT-exclusive price.</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6 }}>On hand and average cost start from the opening stock and initial unit cost you set on the left. Once created, they move only through sales, receipts, counts and adjustments — the same as any other item.</div>
          )}
        </section>
        <section className="card card--flush">
          <div className="card-head" style={{ padding: '20px 24px 14px' }}>
            <span className="h-section">Pick an item</span>
            {p && <button type="button" className="btn btn-sm" onClick={startNew}>+ Add item</button>}
          </div>
          <div style={{ padding: '16px 24px 20px' }}>
            <Pills label="Item" options={state.catalog.map((x) => ({ value: x.sku, label: x.name }))} value={sku} onChange={pick} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsTab({ onNotice }: { onNotice: (s: string) => void }) {
  const { state, dispatch } = useStore();
  const [s, setS] = useState<Settings>(state.settings);
  const cur = state.settings;
  const digits = (v: string) => { const d = v.replace(/[^0-9]/g, ''); return d === '' ? 0 : parseInt(d, 10); };
  const rows = [
    { label: 'VAT rate', value: (cur.vatRate * 100).toFixed(0) + '%', note: 'Applied to vatable lines', ref: 'configurable' },
    { label: 'Cashier discount limit', value: cur.discountLimitPct + '%', note: 'Above this a manager PIN is required', ref: 'per role' },
    { label: 'Cash over/short tolerance', value: CURRENCY + cur.tolerance, note: 'Beyond this the shift needs a written reason', ref: 'per store' },
    { label: 'Return window', value: cur.returnDays + ' days', note: 'Receipt required outside this window', ref: 'per store' },
    { label: 'Negative stock', value: cur.negativeStock, note: cur.negativeStock === 'Block' ? 'Blocks the sale when on-hand would go below zero' : 'Warns but allows the sale', ref: 'policy' },
    { label: 'Receipt footer', value: cur.footer, note: 'Printed under the totals', ref: 'free text' },
  ];
  return (
    <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <section className="card card--flush">
        <div className="card-head"><span className="h-section">Current settings</span></div>
        {rows.map((r) => (
          <div key={r.label} className="trow" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'baseline', padding: '14px 24px' }}>
            <div className="min0"><div className="name">{r.label}</div><div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 3, lineHeight: 1.5 }}>{r.note}</div></div>
            <div className="right" style={{ maxWidth: 220 }}><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{r.value}</div><div className="mono" style={{ fontSize: 10.5, color: 'var(--ink4)', marginTop: 2 }}>{r.ref}</div></div>
          </div>
        ))}
      </section>
      <section className="card" style={{ padding: 24 }}>
        <div className="h-section" style={{ marginBottom: 18 }}>Edit</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label className="field-label" htmlFor="s-vat">VAT rate, %</label>
            <input id="s-vat" className="input mono" style={{ fontSize: 17 }} inputMode="numeric" value={Math.round(s.vatRate * 100)} onChange={(e) => setS({ ...s, vatRate: Math.min(digits(e.target.value), 25) / 100 })} />
          </div>
          <div>
            <label className="field-label" htmlFor="s-disc">Cashier discount limit, %</label>
            <input id="s-disc" className="input mono" style={{ fontSize: 17 }} inputMode="numeric" value={s.discountLimitPct} onChange={(e) => setS({ ...s, discountLimitPct: Math.min(digits(e.target.value), 50) })} />
          </div>
        </div>
        <label className="field-label" htmlFor="s-tol">Cash over/short tolerance</label>
        <div className="input-affix" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 17 }}>{CURRENCY}</span>
          <input id="s-tol" inputMode="numeric" style={{ fontSize: 17, padding: '11px 0' }} value={s.tolerance} onChange={(e) => setS({ ...s, tolerance: digits(e.target.value) })} />
        </div>
        <label className="field-label" htmlFor="s-ret">Return window, days</label>
        <input id="s-ret" className="input mono" inputMode="numeric" style={{ fontSize: 17, marginBottom: 16 }} value={s.returnDays} onChange={(e) => setS({ ...s, returnDays: digits(e.target.value) })} />
        <span className="field-label">Negative stock policy</span>
        <div style={{ marginBottom: 16 }}>
          <Pills label="Negative stock policy" options={['Block', 'Allow with warning'] as const} value={s.negativeStock} onChange={(v) => setS({ ...s, negativeStock: v })} />
        </div>
        <label className="field-label" htmlFor="s-foot">Receipt footer</label>
        <input id="s-foot" className="input" value={s.footer} onChange={(e) => setS({ ...s, footer: e.target.value })} />
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 20, fontSize: 14.5, padding: 15 }}
          onClick={() => { dispatch({ type: 'saveSettings', settings: s }); onNotice('Settings saved · terminals pick up tax and discount changes on their next 15-minute sync, or immediately on next login.'); }}>
          Save settings
        </button>
      </section>
    </div>
  );
}

function DevicesTab() {
  const cols = '76px minmax(0, 1fr) 92px 132px 92px 104px';
  return (
    <div className="stack">
      <section className="card card--flush">
        <div className="card-head"><span className="h-section">Terminals</span><span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>registered devices</span></div>
        <div className="hscroll"><div style={{ minWidth: 720 }}>
          <div className="thead" style={{ gridTemplateColumns: cols }}><span>code</span><span>location</span><span>status</span><span>last seen</span><span>build</span><span className="right">queued</span></div>
          {TERMINALS.map((t) => (
            <div key={t.code} className="trow" style={{ gridTemplateColumns: cols }}>
              <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{t.code}</span>
              <span style={{ fontSize: 14 }}>{t.place}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.status === 'Online' ? 'var(--accent-ink)' : 'var(--ink5)' }}>{t.status}</span>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{t.seen}</span>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{t.ver}</span>
              <span className="num-b" style={{ fontSize: 13.5, color: t.queue ? 'var(--warn-ink)' : 'var(--ink3)' }}>{t.queue}</span>
            </div>
          ))}
        </div></div>
      </section>
      <section className="card card--flush">
        <div className="card-head"><span className="h-section">Suppliers</span><SpecOnly><span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>FR-PUR-01</span></SpecOnly></div>
        <div className="hscroll"><div style={{ minWidth: 640 }}>
          {SUPPLIERS.map((s) => (
            <div key={s.tin} className="trow" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) 132px 96px minmax(0, 1fr)', gap: 14, padding: '14px 24px' }}>
              <div className="min0"><div className="name">{s.name}</div><div className="meta" style={{ fontSize: 11.5 }}>TIN {s.tin}</div></div>
              <div style={{ fontSize: 13.5, color: 'var(--ink2)' }}>{s.terms}</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)' }}>{s.open}</div>
              <div className="min0" style={{ fontSize: 13, color: 'var(--ink3)' }}>{s.contact}</div>
            </div>
          ))}
        </div></div>
      </section>
    </div>
  );
}

function BackupTab({ onNotice }: { onNotice: (s: string) => void }) {
  return (
    <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <section className="card card--flush">
        <div className="card-head"><span className="h-section">Backup</span></div>
        {BACKUP_ROWS.map((b) => (
          <div key={b.label} className="trow" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'baseline', padding: '14px 24px' }}>
            <div className="name min0">{b.label}</div>
            <div className="right"><div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{b.value}</div><div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>{b.note}</div></div>
          </div>
        ))}
        <div style={{ padding: '20px 24px' }}>
          <button type="button" className="btn btn-solid btn-block" style={{ fontWeight: 700, fontSize: 14, padding: 14 }}
            onClick={() => onNotice('Backup started · the nightly job also runs after the last shift closes. Restores are tested monthly against a staging copy.')}>Run backup now</button>
        </div>
      </section>
      <section className="card card--flush">
        <div className="card-head"><span className="h-section">Audit log</span><span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>append-only</span></div>
        {AUDIT_ROWS.map((a, i) => (
          <div key={i} className="trow" style={{ gridTemplateColumns: '96px 118px minmax(0, 1fr)', alignItems: 'baseline', padding: '12px 24px' }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink3)' }}>{a.time}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink2)', fontWeight: 500 }}>{a.action}</span>
            <div className="min0"><div style={{ fontSize: 13.5 }}>{a.detail}</div><div className="meta">{a.actor}</div></div>
          </div>
        ))}
        <div className="card-foot">Entries cannot be edited or deleted from the interface, including by the owner.</div>
      </section>
    </div>
  );
}
