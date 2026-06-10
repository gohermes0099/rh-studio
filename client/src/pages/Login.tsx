import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);

  // Countdown timer for lock
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.max(0, lockUntil - Date.now());
      if (remaining <= 0) {
        setLockUntil(null);
        setError('');
      } else {
        const min = Math.floor(remaining / 60000);
        const sec = Math.floor((remaining % 60000) / 1000);
        setError(`Account locked. Try again in ${min}m ${sec}s.`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockUntil) return;
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.status === 429) {
        const retryAfter = (err.retryAfter || 900) * 1000;
        setLockUntil(Date.now() + retryAfter);
      } else {
        setError(err.message || 'Login failed');
      }
      if (typeof err.attemptsLeft === 'number') {
        setAttemptsLeft(err.attemptsLeft);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = !!lockUntil;
  const showWarning = attemptsLeft !== null && attemptsLeft <= 2 && attemptsLeft > 0;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%)',
      padding: 20,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: 400,
        padding: 'clamp(20px, 5vw, 40px)',
        background: 'rgba(20, 20, 35, 0.8)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px', borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
          }}>RH</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', color: '#e8edf5', fontWeight: 700 }}>
            RH Studio
          </h1>
          <p style={{ margin: '4px 0 0', color: '#5a6478', fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)' }}>
            Sign in to continue
          </p>
        </div>

        {error && (
          <div role="alert" style={{
            padding: 12, marginBottom: 16,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', marginBottom: 6, color: '#a3a8b8', fontSize: '0.85rem', fontWeight: 500,
          }}>Username / Email</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            disabled={isLocked}
            style={{
              width: '100%', padding: 'clamp(8px, 2vw, 10px) 14px',
              background: 'rgba(10, 10, 20, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 8, color: '#e8edf5', fontSize: '0.95rem', outline: 'none',
              opacity: isLocked ? 0.5 : 1,
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', marginBottom: 6, color: '#a3a8b8', fontSize: '0.85rem', fontWeight: 500,
          }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLocked}
              style={{
                width: '100%', padding: 'clamp(8px, 2vw, 10px) 14px',
                paddingRight: 44,
                background: 'rgba(10, 10, 20, 0.6)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 8, color: '#e8edf5', fontSize: '0.95rem', outline: 'none',
                opacity: isLocked ? 0.5 : 1,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              disabled={isLocked}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer',
                color: '#5a6478', fontSize: '0.8rem', padding: '4px 8px',
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          {showWarning && !isLocked && (
            <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#fbbf24' }}>
              ⚠ {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left before lockout
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || isLocked}
          style={{
            width: '100%', padding: 12,
            background: (submitting || isLocked) ? 'rgba(99, 102, 241, 0.4)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
            border: 'none', borderRadius: 8, color: '#fff',
            fontSize: '0.95rem', fontWeight: 600,
            cursor: (submitting || isLocked) ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {submitting ? 'Signing in...' : isLocked ? 'Locked' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}