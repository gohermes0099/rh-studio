import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Layout() {
  const [keyIsSet, setKeyIsSet] = useState(false);

  useEffect(() => {
    api.getKeyStatus().then((res) => setKeyIsSet(res.keyIsSet)).catch(() => {});
  }, []);

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    color: isActive ? '#74b9ff' : '#a0a0b0',
    fontWeight: isActive ? 600 : 400,
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    background: isActive ? 'var(--surface)' : 'transparent',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontWeight: 700, fontSize: '1.2rem', marginRight: 24, color: 'var(--text)' }}>
          RH Studio
        </span>
        <NavLink to="/" style={linkStyle} end>Catalog</NavLink>
        <NavLink to="/register" style={linkStyle}>Register</NavLink>
        <NavLink to="/history" style={linkStyle}>History</NavLink>
        <NavLink to="/settings" style={linkStyle}>Settings</NavLink>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: keyIsSet ? 'var(--success)' : 'var(--error)',
          }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            API {keyIsSet ? 'Configured' : 'Not Set'}
          </span>
        </div>
      </nav>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
