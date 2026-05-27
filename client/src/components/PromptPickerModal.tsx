import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import LoadingSpinner from './LoadingSpinner';
import type { SavedPrompt } from '@shared/types';

interface PromptPickerModalProps {
  open: boolean;
  onSelect: (content: string) => void;
  onClose: () => void;
}

export default function PromptPickerModal({ open, onSelect, onClose }: PromptPickerModalProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.listPrompts({ search: search || undefined })
      .then((res) => setPrompts(res.prompts))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const input = modalRef.current?.querySelector<HTMLInputElement>('input[type="text"]');
      input?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  const handleSearch = () => {
    setLoading(true);
    api.listPrompts({ search: search || undefined })
      .then((res) => setPrompts(res.prompts))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  };

  const parseTags = (tags: string): string[] => {
    try { return JSON.parse(tags); } catch { return []; }
  };

  if (!open) return null;

  return (
    <div className="overlay" style={{ zIndex: 2000 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={modalRef}
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: 600,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          animation: 'fadeInScale 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Select Saved Prompt</h2>
          <button onClick={onClose} className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button onClick={handleSearch} className="btn-primary" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>Search</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
          {loading ? (
            <LoadingSpinner />
          ) : prompts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24, fontSize: '0.9rem' }}>
              {search ? 'No prompts match your search.' : 'No saved prompts yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.content); onClose(); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
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
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                  {p.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{p.description}</div>
                  )}
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontStyle: 'italic',
                  }}>
                    {p.content}
                  </div>
                  {(() => {
                    const t = parseTags(p.tags);
                    return t.length > 0 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {t.map((tag, i) => (
                          <span key={i} style={{
                            background: 'var(--primary)',
                            padding: '1px 6px',
                            borderRadius: 10,
                            fontSize: '0.65rem',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
