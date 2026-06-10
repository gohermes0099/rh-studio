import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Catalog', end: true },
  { to: '/register', label: 'Register' },
  { to: '/prompts', label: 'Prompts' },
  { to: '/history', label: 'History' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/uploads', label: 'Uploads' },
  { to: '/settings', label: 'Settings' },
];

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [keyIsSet, setKeyIsSet] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getKeyStatus()
      .then((res) => setKeyIsSet(res.keyIsSet))
      .catch(() => {});
  }, []);

  // Close menu on navigation
  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  // Close on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  const handleNavClick = () => setMenuOpen(false);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: isMobile ? '8px 12px' : '10px 24px',
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
          marginRight: isMobile ? 0 : 28,
          paddingRight: isMobile ? 0 : 20,
          borderRight: isMobile ? 'none' : '1px solid rgba(99, 102, 241, 0.15)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 700, color: '#fff',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.35)',
          }}>RH</div>
          <span style={{
            fontWeight: 700, fontSize: '1.05rem',
            background: 'linear-gradient(135deg, #e8edf5, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.01em',
          }}>Studio</span>
        </div>

        {/* Spacer (mobile) — pushes menu to right */}
        {isMobile && <div style={{ flex: 1 }} />}

        {/* Desktop nav links */}
        {!isMobile && (
          <>
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
                  whiteSpace: 'nowrap' as const,
                })}
              >
                {item.label}
                {item.to === '/gallery' && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent-cyan)',
                    boxShadow: '0 0 6px rgba(6, 182, 212, 0.5)',
                  }} />
                )}
              </NavLink>
            ))}
            <div style={{ flex: 1 }} />
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12 }}>
                <span style={{ color: '#5a6478', fontSize: '0.82rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {user}
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '6px 14px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: 6, color: '#818cf8',
                    fontSize: '0.82rem', cursor: 'pointer', fontWeight: 500,
                  }}
                >Logout</button>
              </div>
            )}
          </>
        )}

        {/* API status (desktop only) */}
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 20,
            background: keyIsSet ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${keyIsSet ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: keyIsSet ? 'var(--success)' : 'var(--error)',
              boxShadow: keyIsSet
                ? '0 0 8px rgba(16, 185, 129, 0.5)'
                : '0 0 8px rgba(239, 68, 68, 0.5)',
            }} />
            <span style={{
              fontSize: '0.78rem',
              color: keyIsSet ? 'var(--success)' : 'var(--error)',
              fontWeight: 500,
            }}>{keyIsSet ? 'API OK' : 'No Key'}</span>
          </div>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 8, padding: '6px 10px',
                color: '#e8edf5', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '1.1rem', lineHeight: 1,
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: 220,
                  background: 'rgba(20, 20, 35, 0.98)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(16px)',
                  padding: 8,
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  animation: 'fadeInScale 0.15s ease',
                }}
              >
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={handleNavClick}
                    style={({ isActive }) => ({
                      color: isActive ? '#e8edf5' : '#a3a8b8',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.95rem',
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: isActive ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    })}
                  >
                    {item.label}
                    {item.to === '/gallery' && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent-cyan)',
                        boxShadow: '0 0 6px rgba(6, 182, 212, 0.5)',
                      }} />
                    )}
                  </NavLink>
                ))}

                <div style={{
                  height: 1, background: 'rgba(99, 102, 241, 0.15)',
                  margin: '6px 4px',
                }} />

                {/* API status (mobile) */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', fontSize: '0.82rem',
                  color: keyIsSet ? 'var(--success)' : 'var(--error)',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: keyIsSet ? 'var(--success)' : 'var(--error)',
                  }} />
                  {keyIsSet ? 'API Configured' : 'No API Key'}
                </div>

                {user && (
                  <>
                    <div style={{
                      padding: '6px 14px', fontSize: '0.78rem',
                      color: '#5a6478', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }} title={user}>{user}</div>
                    <button
                      onClick={handleLogout}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 8, color: '#fca5a5',
                        fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500,
                        textAlign: 'left' as const,
                      }}
                    >Logout</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  );
}