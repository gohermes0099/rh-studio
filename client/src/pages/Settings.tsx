import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
  const { keyIsSet, loading, setApiKey } = useSettings();
  const [apiKey, setApiKeyInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // imgbb fields
  const [imgbbKey, setImgbbKey] = useState(() => localStorage.getItem('imgbbApiKey') || '');
  const [imgbbFolder, setImgbbFolder] = useState(() => localStorage.getItem('imgbbFolder') || '');
  const [imgbbTesting, setImgbbTesting] = useState(false);
  const [imgbbTestResult, setImgbbTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingImgbb, setSavingImgbb] = useState(false);

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

  const handleSaveImgbb = () => {
    localStorage.setItem('imgbbApiKey', imgbbKey.trim());
    localStorage.setItem('imgbbFolder', imgbbFolder.trim());
  };

  const handleTestImgbb = async () => {
    if (!imgbbKey.trim()) {
      setImgbbTestResult({ ok: false, message: 'Enter an API key first' });
      return;
    }
    setImgbbTesting(true);
    setImgbbTestResult(null);
    try {
      // Tiny 1x1 transparent PNG base64
      const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
      const form = new FormData();
      form.append('image', tinyPng);
      form.append('name', 'connection-test');

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey.trim())}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok && data?.data?.url) {
        setImgbbTestResult({ ok: true, message: 'Connection successful' });
      } else {
        setImgbbTestResult({ ok: false, message: data?.error || 'Connection failed' });
      }
    } catch (err) {
      setImgbbTestResult({ ok: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setImgbbTesting(false);
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

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24 }}>
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

      {/* imgbb configuration */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Image Hosting (imgbb)</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Uploads go directly from your browser to imgbb — no server involvement needed.
          Get your free API key at{' '}
          <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)' }}>
            api.imgbb.com
          </a>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
              imgbb API Key
            </label>
            <input
              type="password"
              value={imgbbKey}
              onChange={(e) => setImgbbKey(e.target.value)}
              placeholder="Enter your imgbb API key..."
              style={{ width: '100%', maxWidth: 400 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
              imgbb Folder <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={imgbbFolder}
              onChange={(e) => setImgbbFolder(e.target.value)}
              placeholder="folder name..."
              style={{ width: '100%', maxWidth: 400 }}
            />
          </div>

          {imgbbTestResult && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                background: imgbbTestResult.ok
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                  : 'color-mix(in srgb, var(--error) 10%, transparent)',
                color: imgbbTestResult.ok ? 'var(--success)' : 'var(--error)',
              }}
            >
              {imgbbTestResult.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSaveImgbb}
              className="btn-primary"
              style={{ padding: '8px 16px' }}
            >
              Save Settings
            </button>
            <button
              type="button"
              onClick={handleTestImgbb}
              className="btn-primary"
              disabled={imgbbTesting || !imgbbKey.trim()}
              style={{ padding: '8px 16px' }}
            >
              {imgbbTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: imgbbKey.trim() ? 'var(--success)' : 'var(--text-muted)',
                }}
              />
              {imgbbKey.trim() ? 'Configured' : 'Not configured'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
