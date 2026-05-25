import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import type { RhNodeField, ResultFile } from '@shared/types';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = id ? Number(id) : null;
  const { task, loading } = usePolling(taskId);
  const [fields, setFields] = useState<RhNodeField[]>([]);
  const [results, setResults] = useState<ResultFile[]>([]);

  useEffect(() => {
    if (!task) return;
    try { setFields(JSON.parse(task.nodeInfoList)); } catch { setFields([]); }
    try { setResults(JSON.parse(task.resultFiles)); } catch { setResults([]); }
  }, [task]);

  if (loading) return <LoadingSpinner />;
  if (!task) return <div className="page"><p style={{ color: 'var(--error)' }}>Task not found</p></div>;

  const isActive = task.status === 'PENDING' || task.status === 'RUNNING';

  return (
    <div className="page">
      <Link to="/history" style={{ fontSize: '0.9rem', display: 'inline-block', marginBottom: 16 }}>
        &larr; Back to History
      </Link>

      <h1 style={{ marginBottom: 8 }}>Task #{task.id}</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 16px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Status:</span>
          <span><StatusBadge status={task.status} /></span>

          <span style={{ color: 'var(--text-muted)' }}>Tool:</span>
          <span>{task.toolName || `Tool #${task.toolId}`}</span>

          <span style={{ color: 'var(--text-muted)' }}>Task ID:</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{task.taskId}</span>

          <span style={{ color: 'var(--text-muted)' }}>Created:</span>
          <span>{new Date(task.createdAt).toLocaleString()}</span>

          {task.completedAt && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Completed:</span>
              <span>{new Date(task.completedAt).toLocaleString()}</span>
            </>
          )}

          <span style={{ color: 'var(--text-muted)' }}>Poll Count:</span>
          <span>{task.pollCount}</span>
        </div>

        {isActive && (
          <div style={{ marginTop: 16, color: 'var(--warning)', fontSize: '0.9rem' }}>
            Task is still {task.status.toLowerCase()} &mdash; auto-refreshing every 5s...
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Input Fields</h2>
        {fields.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No input fields recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.map((f, i) => (
              <div key={i} style={{ fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{f.fieldName}:</span>{' '}
                {f.fieldType === 'IMAGE' || f.fieldType === 'AUDIO' || f.fieldType === 'VIDEO'
                  ? <span style={{ color: 'var(--info)' }}>{f.fieldValue}</span>
                  : <span>{f.fieldValue || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>empty</span>}</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Results</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => {
              const isImage = r.mimeType?.startsWith('image/');
              const isAudio = r.mimeType?.startsWith('audio/');
              const isVideo = r.mimeType?.startsWith('video/');
              return (
                <div key={i} style={{ fontSize: '0.9rem' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{r.nodeId}: {r.fileName}</div>
                  {isImage && (
                    <img
                      src={`/api/download/${task.id}/${r.nodeId}`}
                      alt={r.fileName}
                      style={{ maxWidth: 300, maxHeight: 300, borderRadius: 'var(--radius)' }}
                    />
                  )}
                  {isAudio && (
                    <audio controls src={`/api/download/${task.id}/${r.nodeId}`} style={{ width: '100%' }} />
                  )}
                  {isVideo && (
                    <video controls src={`/api/download/${task.id}/${r.nodeId}`} style={{ maxWidth: 400, maxHeight: 300 }} />
                  )}
                  {!isImage && !isAudio && !isVideo && (
                    <a
                      href={`/api/download/${task.id}/${r.nodeId}`}
                      download={r.fileName}
                      style={{ color: 'var(--info)' }}
                    >
                      Download {r.fileName}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(task.status === 'FAILED' && (task.errorMessage || task.failedReason)) && (
        <div className="card" style={{ marginTop: 24, borderColor: 'var(--error)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12, color: 'var(--error)' }}>Error</h2>
          <p style={{ fontSize: '0.9rem' }}>{task.errorMessage || task.failedReason}</p>
        </div>
      )}
    </div>
  );
}
