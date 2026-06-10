import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { api } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
  const { keyIsSet, loading, setApiKey } = useSettings();
  const [apiKey, setApiKeyInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // imgbb fields (server-side now)
  const [imgbbKey, setImgbbKey] = useState('');
  const [imgbbKeySet, setImgbbKeySet] = useState(false);
  const [savingImgbb, setSavingImgbb] = useState(false);
  const [imgbbSaveResult, setImgbbSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    api.getImgbbKeyStatus()
      .then((res) => { if (res) setImgbbKeySet(res.keyIsSet); })
      .catch(() => {});
    // Clean up old localStorage entries from previous design
    localStorage.removeItem('imgbbApiKey');
    localStorage.removeItem('imgbbFolder');
  }, []);

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

  const handleSaveImgbb = async () => {
    setSavingImgbb(true);
    setImgbbSaveResult(null);
    try {
      await api.setImgbbKey(imgbbKey.trim());
      setImgbbKeySet(true);
      setImgbbSaveResult({ ok: true, message: 'Saved on server' });
      setImgbbKey('');
    } catch (err) {
      setImgbbSaveResult({ ok: false, message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSavingImgbb(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <h1>Settings</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span>RunningHub API Key Status:</span>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: keyIsSet ? 'var(--success)' : 'var(--error)',
          }} />
          <span style={{ color: keyIsSet ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
            {keyIsSet ? 'Configured' : 'Not Configured'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>{keyIsSet ? 'Update' : 'Set'} RunningHub API Key</h2>
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

      {/* imgbb configuration */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Image Hosting (imgbb)</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Your image uploads are stored on imgbb so RunningHub can fetch them. The API key is stored on the server (more secure).
          Get your free API key at{' '}
          <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>
            api.imgbb.com
          </a>
        </p>

        <div style={{ marginBottom: 12, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: imgbbKeySet ? 'var(--success)' : 'var(--text-muted)',
            }}
          />
          <span>imgbb Status: </span>
          <span style={{ color: imgbbKeySet ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>
            {imgbbKeySet ? 'Configured on server' : 'Not configured'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
              {imgbbKeySet ? 'Replace imgbb API Key' : 'imgbb API Key'}
            </label>
            <input
              type="password"
              value={imgbbKey}
              onChange={(e) => setImgbbKey(e.target.value)}
              placeholder="Enter your imgbb API key..."
              style={{ width: '100%' }}
            />
          </div>

          {imgbbSaveResult && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                background: imgbbSaveResult.ok
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                  : 'color-mix(in srgb, var(--error) 10%, transparent)',
                color: imgbbSaveResult.ok ? 'var(--success)' : 'var(--error)',
              }}
            >
              {imgbbSaveResult.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveImgbb}
            className="btn-primary"
            disabled={savingImgbb || !imgbbKey.trim()}
            style={{ padding: '8px 16px', alignSelf: 'flex-start' }}
          >
            {savingImgbb ? 'Saving...' : 'Save to Server'}
          </button>
        </div>
      </div>
    </div>
  );
}