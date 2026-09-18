import type { ReactNode } from 'react';
import { SHOW_SPEC_REFS } from '../app/config';

/** Requirement ID annotation — review aid, hidden unless VITE_SHOW_SPEC_REFS=true. */
export function SpecRef({ children, note = false }: { children: ReactNode; note?: boolean }) {
  if (!SHOW_SPEC_REFS) return null;
  return <span className={note ? 'spec-note' : 'spec-ref'}>{children}</span>;
}

export function SpecOnly({ children }: { children: ReactNode }) {
  return SHOW_SPEC_REFS ? <>{children}</> : null;
}

export function Notice({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="notice" role="status">
      <span>{children}</span>
      {onDismiss && <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>}
    </div>
  );
}

export function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-sub">{sub}</div>
    </div>
  );
}

export function Pills<T extends string>({ options, value, onChange, label }: {
  options: readonly T[] | { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className="row-wrap" role="group" aria-label={label}>
      {opts.map((o) => (
        <button key={o.value} type="button" className="pill" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Figure({ label, value, accent = false, size }: { label: string; value: string; accent?: boolean; size?: number }) {
  return (
    <div>
      <div className="figure-label">{label}</div>
      <div className="figure" style={{ color: accent ? 'var(--accent-ink)' : undefined, fontSize: size }}>{value}</div>
    </div>
  );
}

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '↵'];

/** PIN keypad shared by login and manager override. Physical digits, Backspace and Enter also work. */
export function PinPad({ value, onChange, onEnter, maxLength = 6 }: {
  value: string; onChange: (v: string) => void; onEnter: () => void; maxLength?: number;
}) {
  return (
    <div className="keypad" style={{ marginTop: 14 }}>
      {PIN_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={'key' + (k === '↵' ? ' key--accent' : k === 'C' ? ' key--muted' : '')}
          aria-label={k === '↵' ? 'Enter' : k === 'C' ? 'Clear' : k}
          onClick={() => {
            if (k === 'C') onChange('');
            else if (k === '↵') onEnter();
            else onChange((value + k).slice(0, maxLength));
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function pinKeyHandler(value: string, onChange: (v: string) => void, onEnter: () => void, maxLength = 6) {
  return (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) { onChange((value + e.key).slice(0, maxLength)); e.preventDefault(); }
    else if (e.key === 'Backspace') { onChange(value.slice(0, -1)); e.preventDefault(); }
    else if (e.key === 'Enter') { onEnter(); e.preventDefault(); }
  };
}

export const mask = (pin: string) => pin.replace(/./g, '•') || '······';
