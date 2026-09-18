import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../app/store';
import { SHIFT_CASH, SESSION, Z_REPORT } from '../../data/store';
import { DENOMINATIONS, countedCash, reconcile } from '../../domain/shift';
import { fmt, fmtWhole } from '../../domain/money';
import { Notice, SpecOnly } from '../../components/ui';

/** Shift close and Z-report — FR-SHF-03/04/05, spec 7.6. */
export function ShiftCloseScreen() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<number, number>>({ 1000: 12, 500: 9, 200: 4, 100: 11, 50: 6, 20: 14, 10: 9, 5: 12, 1: 21 });
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');

  const counted = countedCash(counts);
  const r = reconcile({ ...SHIFT_CASH, openingFloat: state.openingFloat || SHIFT_CASH.openingFloat, counted, tolerance: state.settings.tolerance });
  const tone = r.withinTolerance ? { bg: 'var(--accent-wash)', border: 'var(--accent-wash-border)', fg: 'var(--accent-ink)' } : { bg: 'var(--danger-wash)', border: 'var(--danger-border)', fg: 'var(--danger-ink)' };
  const canClose = submitted && (r.withinTolerance || reason.trim().length >= 5);

  const closeShift = () => {
    if (!canClose) {
      setNotice(!submitted ? 'Submit the blind count before closing the shift.' : 'Beyond tolerance — enter a written reason; a manager must sign off.');
      return;
    }
    dispatch({ type: 'closeShift' });
    navigate('/login');
  };

  return (
    <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <section className="card card--flush">
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow">blind count<SpecOnly> · FR-SHF-03</SpecOnly></div>
          <h2 className="h-screen" style={{ fontSize: 24, marginBottom: 5 }}>Count the drawer</h2>
          <p className="lede" style={{ maxWidth: '42ch' }}>The expected amount stays hidden until the count is submitted.</p>
        </div>
        <div style={{ padding: '8px 24px 18px' }}>
          {DENOMINATIONS.map((d) => (
            <div key={d} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px', gap: 14, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-row)' }}>
              <label htmlFor={`d${d}`} className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmtWhole(d)}</label>
              <input id={`d${d}`} className="input mono" inputMode="numeric" style={{ fontSize: 15, padding: '9px 12px', borderColor: 'var(--border-soft)', borderRadius: 11, fontWeight: 400 }}
                value={String(counts[d] ?? 0)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setCounts((c) => ({ ...c, [d]: v === '' ? 0 : parseInt(v, 10) }));
                  setSubmitted(false);
                }} />
              <span className="num" style={{ color: 'var(--ink2)' }}>{fmt(d * (counts[d] || 0))}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Counted cash</span>
            <span className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>{fmt(counted)}</span>
          </div>
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 18, fontSize: 14.5, padding: 15 }} onClick={() => setSubmitted(true)}>Submit count</button>
        </div>
      </section>

      <div className="stack">
        <section className="card card--pad">
          <div className="eyebrow">reconciliation<SpecOnly> · 7.6</SpecOnly></div>
          <h3 className="h-card">Expected vs counted</h3>
          {submitted ? (
            <>
              <div className="mono" style={{ fontSize: 13.5, lineHeight: 2.1 }}>
                {[
                  ['opening float', fmt(state.openingFloat || SHIFT_CASH.openingFloat)],
                  ['cash sales', fmt(SHIFT_CASH.cashSales)],
                  ['cash refunds', fmt(-SHIFT_CASH.cashRefunds)],
                  ['payouts', fmt(-SHIFT_CASH.payouts)],
                ].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink3)' }}>{k}</span><span>{v}</span></div>)}
                <div className="dashed" style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>expected</span><span>{fmt(r.expected)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>counted</span><span>{fmt(counted)}</span></div>
              </div>
              <div style={{ marginTop: 18, borderRadius: 15, padding: '16px 18px', background: tone.bg, border: `1px solid ${tone.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: tone.fg }}>{r.label}</span>
                  <span className="mono" style={{ fontSize: 26, fontWeight: 600, color: tone.fg }}>{fmt(Math.abs(r.overShort))}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 7, lineHeight: 1.55 }}>
                  {r.withinTolerance
                    ? `Within the ₱${state.settings.tolerance} tolerance. The shift can close without a manager signature.`
                    : `Beyond the ₱${state.settings.tolerance} tolerance — a written reason and manager sign-off are required before the shift closes.`}
                </div>
              </div>
              {!r.withinTolerance && (
                <div style={{ marginTop: 14 }}>
                  <label className="field-label" htmlFor="os-reason">Reason for variance</label>
                  <input id="os-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. ₱500 payout to delivery not recorded" />
                </div>
              )}
            </>
          ) : (
            <div className="center" style={{ padding: '40px 8px', color: 'var(--ink6)', fontSize: 14, lineHeight: 1.6 }}>Expected cash is withheld until the count is submitted.</div>
          )}
        </section>

        <section className="card card--dark on-dark" style={{ padding: 28 }}>
          <div className="eyebrow" style={{ color: 'var(--ink5)' }}>Z-report<SpecOnly> · FR-SHF-05</SpecOnly></div>
          <h3 className="h-card">End of shift {SESSION.shift}</h3>
          <div className="mono" style={{ fontSize: 13, lineHeight: 2.05 }}>
            {Z_REPORT.map((z) => <div key={z.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: 'var(--ink5)' }}>{z.label}</span><span>{z.value}</span></div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 9, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost-dark" onClick={() => window.print()}>Print X-report</button>
            <button type="button" className="btn btn-primary" onClick={closeShift}>Close shift</button>
          </div>
          {notice && <div style={{ marginTop: 14 }}><Notice onDismiss={() => setNotice('')}>{notice}</Notice></div>}
          <div className="mono" style={{ marginTop: 16, fontSize: 10.5, color: 'var(--ink5)', lineHeight: 1.7 }}>
            After the last shift closes, the end-of-day batch aggregates sales, runs the low-stock check and triggers the nightly backup.
          </div>
        </section>
      </div>
    </div>
  );
}
