import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function RegisterTool() {
  const navigate = useNavigate();
  const [webappId, setWebappId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyIsSet, setKeyIsSet] = useState<boolean | null>(null);

  useEffect(() => {
    api.getKeyStatus().then(r => setKeyIsSet(r.keyIsSet)).catch(() => setKeyIsSet(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!webappId.trim()) {
      setError('WebApp ID is required');
      return;
    }
    setLoading(true);
    try {
      await api.registerTool(webappId.trim());
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (keyIsSet === false) {
    return (
      <div className="page">
        <h1>Register Tool</h1>
        <div className="card" style={{ borderColor: 'var(--warning)' }}>
          <p style={{ marginBottom: 12 }}>Please configure your API key first.</p>
          <button onClick={() => navigate('/settings')} className="btn-primary">
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Register Tool</h1>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
            RunningHub WebApp ID
          </label>
          <input
            type="text"
            value={webappId}
            onChange={(e) => setWebappId(e.target.value)}
            placeholder="e.g. 123456789"
          />
        </div>

        {error && (
          <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.9rem' }}>{error}</div>
        )}

        <button type="submit" className="btn-primary" disabled={loading || !webappId.trim()}>
          {loading ? 'Registering...' : 'Register Tool'}
        </button>
      </form>
    </div>
  );
}
