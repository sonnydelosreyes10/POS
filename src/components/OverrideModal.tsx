import { useEffect, useRef, useState } from 'react';
import { useStore } from '../app/store';
import { SpecOnly, PinPad, mask, pinKeyHandler } from './ui';

/** Manager override — FR-AUTH-05. Real build: POST /auth/override, cashier stays logged in, approval written to audit_log. */
export function OverrideModal({ onVoided, onAdjusted, onCounted }: { onVoided?: () => void; onAdjusted?: () => void; onCounted?: () => void }) {
  const { state, dispatch } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const kind = state.override;

  useEffect(() => {
    if (kind) { setPin(''); setError(''); dialog.current?.focus(); }
  }, [kind]);

  if (!kind) return null;

  const authorize = () => {
    if (pin.length < 4) { setError('Enter a 4–6 digit manager PIN.'); return; }
    dispatch({ type: 'authorizeOverride' });
    if (kind === 'void') onVoided?.();
    else if (kind === 'adjustment') onAdjusted?.();
    else if (kind === 'count') onCounted?.();
  };
  const cancel = () => dispatch({ type: 'cancelOverride' });
  const onKey = pinKeyHandler(pin, (v) => { setPin(v); setError(''); }, authorize);

  const nonzeroCount = state.pendingCount?.filter((l) => l.variance !== 0).length ?? 0;
  const netVariance = state.pendingCount?.reduce((a, l) => a + l.variance, 0) ?? 0;

  const title = kind === 'void' ? 'Void the entire cart'
    : kind === 'discount' ? 'Discount above cashier limit'
    : kind === 'adjustment' ? 'Approve stock adjustment'
    : 'Approve count variances';

  const body = kind === 'void'
    ? 'Voids are logged with reason and approver. Posted sales cannot be voided — use the return flow.'
    : kind === 'discount'
    ? `A ${state.pendingDiscount}% discount exceeds the cashier limit of ${state.settings.discountLimitPct}%. A manager PIN authorises it.`
    : kind === 'adjustment' && state.pendingAdjustment
    ? `${state.pendingAdjustment.name}: ${state.pendingAdjustment.qtyChange > 0 ? '+' : ''}${state.pendingAdjustment.qtyChange} (${state.pendingAdjustment.reason}). Manual adjustments post only after a manager PIN.`
    : `${nonzeroCount} line${nonzeroCount === 1 ? '' : 's'} with a variance, net ${netVariance > 0 ? '+' : ''}${netVariance}. Variances post as ADJUSTMENT after approval.`;

  const specRef = kind === 'void' ? 'FR-POS-09' : kind === 'discount' ? 'FR-POS-03, TC-05' : kind === 'adjustment' ? 'FR-INV-04' : 'FR-INV-03, TC-09';

  return (
    <div className="scrim" onClick={cancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-title"
        tabIndex={-1}
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel(); else onKey(e); }}
      >
        <div className="eyebrow">manager override<SpecOnly> · FR-AUTH-05</SpecOnly></div>
        <h3 id="override-title" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em', margin: '8px 0 7px' }}>
          {title}
        </h3>
        <p className="lede" style={{ marginBottom: 20 }}>
          {body}
          <SpecOnly> {specRef}</SpecOnly>
        </p>
        <div className="pin-display center" style={{ fontSize: 24, minHeight: 54 }} aria-label="Manager PIN">{mask(pin)}</div>
        <PinPad value={pin} onChange={(v) => { setPin(v); setError(''); }} onEnter={authorize} />
        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 14 }}>
          <button type="button" className="btn" onClick={cancel}>Cancel</button>
          <button type="button" className="btn btn-solid" style={{ fontWeight: 700 }} onClick={authorize}>Authorize</button>
        </div>
        <div className="caption-mono" style={{ marginTop: 14 }}>The cashier stays logged in; the approval is written to the audit log.</div>
      </div>
    </div>
  );
}
