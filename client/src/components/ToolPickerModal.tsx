import { useState, useEffect } from 'react';
import { api } from '../api/client';
import LoadingSpinner from './LoadingSpinner';
import type { Tool } from '@shared/types';

interface ToolPickerModalProps {
  open: boolean;
  onSelect: (toolId: number, toolName: string) => void;
  onCancel: () => void;
}

export default function ToolPickerModal({ open, onSelect, onCancel }: ToolPickerModalProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.listTools()
      .then((res) => setTools(res.tools))
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = tools.filter((t) =>
    t.webappName.toLowerCase().includes(search.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div className="overlay" onClick={onCancel} style={{ zIndex: 1500 }}>
      <div
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: 480,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Select a tool</h2>
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 24px' }}>
          <input
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ background: 'var(--bg-alt)' }}
          />
        </div>

        {/* Tool list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
          {loading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: '0.9rem' }}>
              {tools.length === 0 ? 'No tools registered yet.' : 'No tools match your search.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onSelect(tool.id, tool.webappName)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    background: 'var(--bg-alt)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-glass)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-alt)';
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{tool.webappName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    ID: {tool.webappId.substring(0, 16)}… · Tasks: {tool.taskCount ?? 0}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
