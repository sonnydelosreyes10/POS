import { useState } from 'react';
import { ROLE_PERMS, USERS } from '../../data/store';
import { Notice, Pills, SpecOnly } from '../../components/ui';

const ROLES = ROLE_PERMS.map(([role]) => role);
const ROLE_TONE: Record<string, string> = { Owner: 'tone-violet', Manager: 'tone-accent', Cashier: 'tone-neutral', 'Stock clerk': 'tone-info', 'Read-only': 'tone-warn' };
const STATUS_COLOR: Record<string, string> = { Active: 'var(--accent-ink)', Locked: 'var(--danger-ink)', Disabled: 'var(--ink5)' };

type AdminUser = { name: string; username: string; role: string; status: string; last: string };
type Draft = { name: string; username: string; role: string };

const emptyDraft: Draft = { name: '', username: '', role: 'Cashier' };

/** Standalone admin page for users and roles — a peer of Reports and Maintenance, not a tab inside it. */
export function AdminScreen() {
  const [users, setUsers] = useState<AdminUser[]>(USERS.map((u) => ({ ...u })));
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState('');

  const act = (username: string) => {
    setUsers((list) => list.map((u) => {
      if (u.username !== username) return u;
      const status = u.status === 'Active' ? 'Disabled' : 'Active';
      setNotice(`${u.username}: ${u.status} → ${status}. Written to the audit log with the acting user.`);
      return { ...u, status };
    }));
  };

  const setRole = (username: string, role: string) => {
    setUsers((list) => list.map((u) => (u.username === username ? { ...u, role } : u)));
    setNotice(`${username}: role changed to ${role}. Written to the audit log with the acting user.`);
  };

  const addUser = () => {
    const username = draft.username.trim();
    if (!draft.name.trim()) return setError('Full name is required.');
    if (!username) return setError('Username is required.');
    if (users.some((u) => u.username === username)) return setError('Username already exists.');
    setUsers((list) => [...list, { name: draft.name.trim(), username, role: draft.role, status: 'Active', last: 'never' }]);
    setNotice(`${username} added as ${draft.role}. A temporary PIN has been sent for first sign-in.`);
    setDraft(emptyDraft);
    setError('');
    setAdding(false);
  };

  return (
    <div className="stack">
      <section className="card" style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="eyebrow">administration<SpecOnly> · 9.2</SpecOnly></div>
          <h2 className="h-screen">Admin</h2>
          <div className="lede">Users and role assignment. Every change on this page is written to the audit log with the acting user.</div>
        </div>
        {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}
      </section>

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <section className="card card--flush">
          <div className="card-head">
            <span className="h-section">Users</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>{users.length} accounts</span>
              <button type="button" className="btn btn-sm" onClick={() => { setAdding((v) => !v); setError(''); }}>
                {adding ? 'Cancel' : 'Add user'}
              </button>
            </div>
          </div>

          {adding && (
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-row)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div>
                  <label className="field-label" htmlFor="a-name">Full name</label>
                  <input id="a-name" className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label" htmlFor="a-username">Username</label>
                  <input id="a-username" className="input mono" value={draft.username} onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))} />
                </div>
              </div>
              <div>
                <span className="field-label">Role</span>
                <Pills label="Role" options={ROLES} value={draft.role} onChange={(role) => setDraft((d) => ({ ...d, role }))} />
              </div>
              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              <button type="button" className="btn btn-primary" style={{ padding: 12 }} onClick={addUser}>Create account</button>
            </div>
          )}

          {users.map((u) => (
            <div key={u.username} className="trow" style={{ gridTemplateColumns: 'minmax(0, 1fr) 150px 88px', padding: '14px 24px', gap: 10, alignItems: 'center' }}>
              <div className="min0"><div className="name">{u.name}</div><div className="meta" style={{ fontSize: 11.5 }}>{u.username} · last in {u.last}</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                <span className={`badge ${ROLE_TONE[u.role]}`}>{u.role}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLOR[u.status] }}>{u.status}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                <button type="button" className="btn btn-sm" style={{ padding: '9px 12px' }} onClick={() => act(u.username)}>
                  {u.status === 'Locked' ? 'Unlock' : u.status === 'Disabled' ? 'Enable' : 'Disable'}
                </button>
                <select
                  className="input mono"
                  style={{ fontSize: 11.5, padding: '6px 8px' }}
                  aria-label={`Role for ${u.username}`}
                  value={u.role}
                  onChange={(e) => setRole(u.username, e.target.value)}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          ))}
        </section>

        <section className="card card--flush">
          <div className="card-head"><span className="h-section">Roles</span><span className="mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>permission matrix<SpecOnly> · 9.2</SpecOnly></span></div>
          {ROLE_PERMS.map(([role, scope]) => (
            <div key={role} style={{ padding: '15px 24px', borderBottom: '1px solid var(--border-row)' }}>
              <div className="name">{role}</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 3, lineHeight: 1.5 }}>{scope}</div>
            </div>
          ))}
          <div className="card-foot">Permissions are checked on the server on every request, not just hidden in the interface.</div>
        </section>
      </div>
    </div>
  );
}
