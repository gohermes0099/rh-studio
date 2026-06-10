import { useState, FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

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
        padding: 40,
        background: 'rgba(20, 20, 35, 0.8)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 16px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
          }}>
            RH
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '1.5rem',
            color: '#e8edf5',
            fontWeight: 700,
          }}>RH Studio</h1>
          <p style={{ margin: '4px 0 0', color: '#5a6478', fontSize: '0.9rem' }}>
            Sign in to continue
          </p>
        </div>

        {error && (
          <div style={{
            padding: 12,
            marginBottom: 16,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            marginBottom: 6,
            color: '#a3a8b8',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(10, 10, 20, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 8,
              color: '#e8edf5',
              fontSize: '0.95rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            marginBottom: 6,
            color: '#a3a8b8',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(10, 10, 20, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 8,
              color: '#e8edf5',
              fontSize: '0.95rem',
              outline: 'none',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: submitting ? 'rgba(99, 102, 241, 0.4)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}