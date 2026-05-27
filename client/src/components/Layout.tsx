import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Catalog', end: true },
  { to: '/register', label: 'Register' },
  { to: '/prompts', label: 'Prompts' },
  { to: '/history', label: 'History' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/uploads', label: 'Uploads' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  const [keyIsSet, setKeyIsSet] = useState(false);

  useEffect(() => {
    api.getKeyStatus().then((res) => setKeyIsSet(res.keyIsSet)).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '10px 24px',
        background: 'rgba(10, 10, 20, 0.9)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.12)',
        backdropFilter: 'blur(16px)',
        zIndex: 100,
        position: 'relative',
      }}>
        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginRight: 28,
          paddingRight: 20,
          borderRight: '1px solid rgba(99, 102, 241, 0.15)',
        }}>
          {/* Logo icon */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.35)',
          }}>
            RH
          </div>
          <span style={{
            fontWeight: 700,
            fontSize: '1.05rem',
            background: 'linear-gradient(135deg, #e8edf5, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.01em',
          }}>
            Studio
          </span>
        </div>

        {/* Nav links */}
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              color: isActive ? '#e8edf5' : '#5a6478',
              fontWeight: isActive ? 600 : 450,
              fontSize: '0.9rem',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 8,
              background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
              transition: 'all 0.2s ease',
              position: 'relative',
            })}
          >
            {item.label}
            {item.to === '/gallery' && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent-cyan)',
                boxShadow: '0 0 6px rgba(6, 182, 212, 0.5)',
              }} />
            )}
          </NavLink>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* API status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderRadius: 20,
          background: keyIsSet
            ? 'rgba(16, 185, 129, 0.08)'
            : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${keyIsSet ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: keyIsSet ? 'var(--success)' : 'var(--error)',
            boxShadow: keyIsSet
              ? '0 0 8px rgba(16, 185, 129, 0.5)'
              : '0 0 8px rgba(239, 68, 68, 0.5)',
          }} />
          <span style={{
            fontSize: '0.78rem',
            color: keyIsSet ? 'var(--success)' : 'var(--error)',
            fontWeight: 500,
          }}>
            {keyIsSet ? 'API Configured' : 'No API Key'}
          </span>
        </div>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  );
}
