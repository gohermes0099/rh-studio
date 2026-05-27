import { useState, useEffect } from 'react';
import { api } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import type { SavedPrompt } from '@shared/types';

interface PromptForm {
  title: string;
  content: string;
  description: string;
  tags: string;
}

const EMPTY_FORM: PromptForm = { title: '', content: '', description: '', tags: '' };

export default function Prompts() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchPrompts = () => {
    setLoading(true);
    api.listPrompts({ search: search || undefined })
      .then((res) => setPrompts(res.prompts))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPrompts(); }, []);

  const handleSearch = () => { fetchPrompts(); };

  // ── Create / Edit ──
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (p: SavedPrompt) => {
    setEditing(p);
    setForm({
      title: p.title,
      content: p.content,
      description: p.description || '',
      tags: (() => { try { return JSON.parse(p.tags).join(', '); } catch { return ''; } })(),
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    if (!form.content.trim()) { setFormError('Prompt content is required'); return; }
    setSaving(true);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (editing) {
        await api.updatePrompt(editing.id, { title: form.title.trim(), content: form.content.trim(), description: form.description.trim(), tags });
      } else {
        await api.createPrompt({ title: form.title.trim(), content: form.content.trim(), description: form.description.trim(), tags });
      }
      handleSaveComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await api.deletePrompt(deleteId);
      setPrompts((prev) => prev.filter((p) => p.id !== deleteId));
      if (editing?.id === deleteId) handleCancelEdit();
    } catch { /* ignore */ }
    setDeleteId(null);
  };

  const handleSaveComplete = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    fetchPrompts();
  };

  // ── Tags display helper ──
  const parseTags = (tags: string): string[] => {
    try { return JSON.parse(tags); } catch { return []; }
  };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Saved Prompts</h1>
        <button onClick={openCreate} className="btn-primary">+ New Prompt</button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search prompts by title, content, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          style={{ maxWidth: 400 }}
        />
        <button onClick={handleSearch} className="btn-primary" style={{ padding: '10px 16px' }}>Search</button>
      </div>

      {/* List */}
      {loading ? <LoadingSpinner /> : prompts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          {search ? 'No prompts match your search.' : 'No saved prompts yet. Create one to get started.'}
        </p>
      ) : (
        <div className="grid grid-2">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => openEdit(p)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{p.title}</h3>
                <button
                  className="btn-danger"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                >
                  Delete
                </button>
              </div>

              {p.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {p.description}
                </p>
              )}

              <div style={{
                fontSize: '0.85rem',
                color: 'var(--text)',
                marginBottom: 8,
                padding: '8px 12px',
                background: 'var(--bg-alt)',
                borderRadius: 'var(--radius)',
                maxHeight: 80,
                overflow: 'hidden',
                fontStyle: 'italic',
              }}>
                {p.content}
              </div>

              {(() => {
                const t = parseTags(p.tags);
                return t.length > 0 ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {t.map((tag, i) => (
                      <span key={i} style={{
                        background: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}

              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 8 }}>
                Updated {new Date(p.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="overlay" onClick={handleCancelEdit}>
          <div
            className="glass-panel"
            style={{
              width: '90vw',
              maxWidth: 600,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
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
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{editing ? 'Edit Prompt' : 'New Prompt'}</h2>
              <button onClick={handleCancelEdit} className="btn-ghost"
                style={{ padding: '4px 8px', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Title *</label>
                <input type="text" value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Cinematic portrait prompt" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Prompt Content *</label>
                <textarea rows={5} value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Write your prompt here..." />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Description</label>
                <input type="text" value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What does this prompt do? (optional)" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tags</label>
                <input type="text" value={form.tags}
                  onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                  placeholder="e.g. portrait, cinematic, realistic (comma-separated)" />
              </div>

              {formError && (
                <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={handleCancelEdit} className="btn-ghost">Cancel</button>
                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update Prompt' : 'Save Prompt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Prompt"
        message="Are you sure you want to delete this prompt? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  );
}
