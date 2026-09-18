import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../app/store';
import { useTheme } from '../app/theme';
import { SESSION } from '../data/store';

const NAV = [
  { to: '/pos', label: 'POS checkout' },
  { to: '/pos/returns', label: 'Returns' },
  { to: '/shift/close', label: 'Shift close' },
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/purchasing', label: 'PO & receiving' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/maintenance', label: 'Maintenance' },
  { to: '/admin/users', label: 'Admin' },
];

export function AppShell() {
  const { state, dispatch } = useStore();
  const [theme, setTheme] = useTheme();
  const navigate = useNavigate();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-name">Tindahan POS</span>
            <span className="brand-sub mono">{SESSION.terminal}</span>
          </div>
          {state.user && (
            <nav className="seg" aria-label="Main">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="grow" />
          <div className="seg seg--theme" role="group" aria-label="Theme">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} type="button" className={theme === t ? 'active' : ''} aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          {state.user && (
            <div className="user-chip">
              <span className="mono">{state.user}</span>
              <button type="button" className="btn btn-sm" onClick={() => { dispatch({ type: 'logout' }); navigate('/login'); }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="page">
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Point of Sale and Inventory Management System · v0.1</span>
          <span>Receipt format and statutory discount handling to be confirmed before go-live.</span>
        </div>
      </footer>
    </>
  );
}
