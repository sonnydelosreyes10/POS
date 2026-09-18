import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../../app/store';
import { registerFailure } from '../../domain/auth';
import { fmtWhole, parseAmount } from '../../domain/money';
import { SESSION } from '../../data/store';
import { CURRENCY } from '../../app/config';
import { PinPad, SpecOnly, mask, pinKeyHandler } from '../../components/ui';

/** Login and shift opening — FR-AUTH-01/02, FR-SHF-01. Demo auth: any username + 4–6 digit PIN. */
export function LoginScreen() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [user, setUser] = useState('anna.reyes');
  const [pin, setPin] = useState('');
  const [failed, setFailed] = useState(0);
  const [notice, setNotice] = useState('');
  const [float, setFloat] = useState('2,000.00');
  const [floatError, setFloatError] = useState('');

  if (state.user && state.shiftOpen) return <Navigate to="/pos" replace />;

  const tryLogin = () => {
    if (!pin) return;
    if (!user.trim()) { setNotice('Enter your username.'); return; }
    if (pin.length >= 4) {
      dispatch({ type: 'login', user: user.trim() });
      setPin(''); setFailed(0); setNotice('');
      return;
    }
    const r = registerFailure(failed);
    setPin(''); setFailed(r.failedAttempts); setNotice(r.notice);
  };

  const openShift = () => {
    const amount = parseAmount(float);
    if (amount <= 0) { setFloatError('Enter the opening float before selling.'); return; }
    dispatch({ type: 'openShift', float: amount });
    navigate('/pos');
  };

  const signedIn = !!state.user;
  const onPinKey = pinKeyHandler(pin, setPin, tryLogin);

  return (
    <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <section className="card card--pad-lg" aria-labelledby="signin-h">
        <div className="eyebrow">step 1<SpecOnly> · FR-AUTH-01</SpecOnly></div>
        <h2 id="signin-h" className="h-login">Sign in</h2>
        <p className="body" style={{ margin: '0 0 22px', maxWidth: '34ch' }}>
          Username and password, or a 4–6 digit PIN on a registered terminal.
        </p>
        {signedIn ? (
          <div className="alert alert-info">Signed in as <span className="mono">{state.user}</span>. Open your shift to start selling.</div>
        ) : (
          <>
            <label className="field-label" htmlFor="username">Username</label>
            <input id="username" className="input" style={{ fontSize: 15, padding: '12px 14px', marginBottom: 16 }} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
            <label className="field-label" htmlFor="pin">PIN</label>
            <div id="pin" className="pin-display" tabIndex={0} role="textbox" aria-label="PIN, type digits" onKeyDown={onPinKey}>{mask(pin)}</div>
            <PinPad value={pin} onChange={setPin} onEnter={tryLogin} />
            {notice && <div className="alert alert-danger" style={{ marginTop: 14 }} role="alert">{notice}</div>}
            <div className="caption-mono" style={{ marginTop: 14 }}>Locks for 15 min after 5 failed attempts · attempts {failed}/5</div>
          </>
        )}
      </section>

      <section className="card card--pad-lg" aria-labelledby="shift-h" style={{ opacity: signedIn ? 1 : 0.6 }}>
        <div className="eyebrow">step 2<SpecOnly> · FR-SHF-01</SpecOnly></div>
        <h2 id="shift-h" className="h-login">Open shift</h2>
        <p className="body" style={{ margin: '0 0 22px', maxWidth: '38ch' }}>
          A cashier cannot reach the sales screen without an opening float. Terminal and shift number are assigned by the server.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 18 }}>
          <div className="stat"><div className="stat-label">Terminal</div><div className="stat-value mono">{SESSION.terminal}</div></div>
          <div className="stat"><div className="stat-label">Shift</div><div className="stat-value mono">{SESSION.shift}</div></div>
          <div className="stat"><div className="stat-label">Role</div><div className="stat-value">Cashier</div></div>
        </div>
        <label className="field-label" htmlFor="float">Opening float</label>
        <div className="input-affix">
          <span style={{ fontSize: 20 }}>{CURRENCY}</span>
          <input id="float" inputMode="decimal" style={{ fontSize: 24, padding: '12px 0' }} value={float} disabled={!signedIn}
            onChange={(e) => { setFloat(e.target.value); setFloatError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') openShift(); }} />
        </div>
        <div className="row-wrap" style={{ gap: 8, marginTop: 12 }}>
          {[1000, 2000, 3000, 5000].map((v) => (
            <button key={v} type="button" className="preset" disabled={!signedIn}
              onClick={() => setFloat(v.toLocaleString('en-PH', { minimumFractionDigits: 2 }))}>{fmtWhole(v)}</button>
          ))}
        </div>
        {floatError && <div className="alert alert-danger" style={{ marginTop: 12 }}>{floatError}</div>}
        <button type="button" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 22 }} disabled={!signedIn} onClick={openShift}>
          Open shift and start selling
        </button>
        <div className="caption-mono" style={{ marginTop: 14 }}>On login the terminal caches catalog, prices and tax settings for offline use<SpecOnly> · 3.4</SpecOnly></div>
      </section>
    </div>
  );
}
