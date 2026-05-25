import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import DynamicField from '../components/DynamicField';
import LoadingSpinner from '../components/LoadingSpinner';
import type { RhNodeField, Tool } from '@shared/types';

export default function ToolRunner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool | null>(null);
  const [fields, setFields] = useState<RhNodeField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getTool(Number(id))
      .then((t) => {
        setTool(t);
        const parsed: RhNodeField[] = JSON.parse(t.nodeInfoList);
        setFields(parsed);
        const initial: Record<string, string> = {};
        parsed.forEach((f) => { initial[f.nodeId] = f.fieldValue || ''; });
        setValues(initial);
      })
      .catch(() => setError('Tool not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRun = async () => {
    if (!tool) return;
    setRunning(true);
    setError('');
    try {
      const task = await api.runTask(tool.id, values);
      navigate(`/history/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run task');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!tool) return <div className="page"><p style={{ color: 'var(--error)' }}>{error || 'Tool not found'}</p></div>;

  return (
    <div className="page">
      <h1>{tool.webappName}</h1>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fields.map((field) => (
            <div key={field.nodeId}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                {field.fieldName}
                {field.fieldType && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    background: 'var(--primary)',
                    padding: '1px 6px',
                    borderRadius: 8,
                  }}>
                    {field.fieldType}
                  </span>
                )}
              </label>
              {field.description && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {field.description}
                </p>
              )}
              <DynamicField
                field={field}
                value={values[field.nodeId] ?? ''}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.nodeId]: v }))}
              />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ color: 'var(--error)', marginTop: 16, fontSize: '0.9rem' }}>{error}</div>
        )}

        <button
          onClick={handleRun}
          className="btn-primary"
          disabled={running}
          style={{ marginTop: 20, padding: '10px 24px', fontSize: '1rem' }}
        >
          {running ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
  );
}
