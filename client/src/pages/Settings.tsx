import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
  const { keyIsSet, loading, setApiKey } = useSettings();
  const [apiKey, setApiKeyInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    setSaving(true);
    try {
      await setApiKey(apiKey.trim());
      setApiKeyInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <h1>Settings</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span>API Key Status:</span>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: keyIsSet ? 'var(--success)' : 'var(--error)',
          }} />
          <span style={{ color: keyIsSet ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
            {keyIsSet ? 'Configured' : 'Not Configured'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>{keyIsSet ? 'Update' : 'Set'} API Key</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
            RunningHub API Key (keep this secret)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Enter your API key..."
          />
        </div>
        {error && (
          <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.9rem' }}>{error}</div>
        )}
        <button type="submit" className="btn-primary" disabled={saving || !apiKey.trim()}>
          {saving ? 'Saving...' : keyIsSet ? 'Update Key' : 'Save Key'}
        </button>
      </form>
    </div>
  );
}
