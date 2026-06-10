import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface AIConfig {
  activeProvider: string | null;
  activeSystemPromptId: string;
  hasActiveConfig: boolean;
  providers: Array<{
    id: string;
    displayName: string;
    defaultModel: string;
    availableModels: string[];
    hasKey: boolean;
    selectedModel: string;
  }>;
}

interface SystemPrompt {
  id: number;
  name: string;
  content: string;
  category: string;
  description: string;
  isBuiltin: number;
}

export default function AIEnhancementSection() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; latencyMs: number; error?: string }>>({});
  const [savingKey, setSavingKey] = useState<Record<string, boolean>>({});
  const [savingModel, setSavingModel] = useState<Record<string, boolean>>({});
  const [activePromptId, setActivePromptId] = useState<string>('1');
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [newPrompt, setNewPrompt] = useState<{ name: string; content: string; category: string; description: string } | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      const [cfg, prompts] = await Promise.all([api.getAIConfig(), api.listSystemPrompts()]);
      setConfig(cfg);
      setActivePromptId(cfg.activeSystemPromptId);
      setSystemPrompts(prompts.systemPrompts);
    } catch (e) {
      console.error(e);
    }
  }

  async function setActive(providerId: string) {
    try {
      await api.setActiveProvider(providerId);
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  }

  async function saveKey(providerId: string) {
    const key = editingKeys[providerId] || '';
    if (!key.trim()) return;
    setSavingKey(s => ({ ...s, [providerId]: true }));
    try {
      await api.setProviderApiKey(providerId, key.trim());
      setEditingKeys(s => { const n = { ...s }; delete n[providerId]; return n; });
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setSavingKey(s => ({ ...s, [providerId]: false }));
    }
  }

  async function removeKey(providerId: string) {
    if (!confirm('Remove API key for this provider?')) return;
    try {
      await api.deleteProviderApiKey(providerId);
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  }

  async function saveModel(providerId: string, model: string) {
    setSavingModel(s => ({ ...s, [providerId]: true }));
    try {
      await api.setProviderModel(providerId, model);
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setSavingModel(s => ({ ...s, [providerId]: false }));
    }
  }

  async function testProvider(providerId: string) {
    setTesting(t => ({ ...t, [providerId]: true }));
    setTestResult(r => { const n = { ...r }; delete n[providerId]; return n; });
    try {
      const result = await api.testProvider(providerId);
      setTestResult(r => ({ ...r, [providerId]: result }));
    } catch (e: any) {
      setTestResult(r => ({ ...r, [providerId]: { ok: false, latencyMs: 0, error: e.message } }));
    } finally {
      setTesting(t => ({ ...t, [providerId]: false }));
    }
  }

  async function activateSystemPrompt(id: number) {
    try {
      await api.setActiveSystemPrompt(id);
      setActivePromptId(String(id));
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  }

  async function saveEditedPrompt() {
    if (!editingPrompt) return;
    try {
      await api.updateSystemPrompt(editingPrompt.id, {
        name: editingPrompt.name,
        content: editingPrompt.content,
        category: editingPrompt.category,
        description: editingPrompt.description,
      });
      setEditingPrompt(null);
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  }

  async function deletePrompt(id: number) {
    if (!confirm('Delete this system prompt?')) return;
    try {
      await api.deleteSystemPrompt(id);
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  }

  async function createNewPrompt() {
    if (!newPrompt) return;
    if (!newPrompt.name.trim() || !newPrompt.content.trim()) {
      alert('Name and content are required');
      return;
    }
    try {
      await api.createSystemPrompt(newPrompt);
      setNewPrompt(null);
      await refresh();
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  }

  if (!config) return null;

  const configured = config.providers.filter(p => p.hasKey);
  const showOnlyOne = configured.length === 1;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>AI Prompt Enhancement</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Add a ✨ Enhance button to text fields. Generates structured prompts for the chosen workflow.
      </p>

      {/* Status indicator */}
      <div style={{
        padding: 10, marginBottom: 16, borderRadius: 8,
        background: config.hasActiveConfig ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        border: `1px solid ${config.hasActiveConfig ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
        fontSize: '0.85rem', color: config.hasActiveConfig ? 'var(--success)' : 'var(--error)',
      }}>
        {config.hasActiveConfig
          ? `✓ Active: ${config.providers.find(p => p.id === config.activeProvider)?.displayName || config.activeProvider}`
          : '⚠ No active provider — add an API key below and activate a provider'}
      </div>

      {/* Provider list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
        {config.providers.map(p => {
          const isActive = config.activeProvider === p.id;
          const testR = testResult[p.id];
          return (
            <div key={p.id} style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(0, 0, 0, 0.2)',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(99, 102, 241, 0.12)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: '0.92rem' }}>{p.displayName}</strong>
                  {p.hasKey && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />}
                </div>
                {p.hasKey && (
                  <button
                    type="button"
                    onClick={() => setActive(p.id)}
                    disabled={isActive}
                    className={isActive ? 'btn-ghost' : 'btn-primary'}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >{isActive ? 'Active' : 'Activate'}</button>
                )}
              </div>

              {/* API key input */}
              <div style={{ marginBottom: 8 }}>
                <input
                  type="password"
                  value={editingKeys[p.id] ?? ''}
                  onChange={(e) => setEditingKeys(s => ({ ...s, [p.id]: e.target.value }))}
                  placeholder={p.hasKey ? '••••••••••••• (configured)' : 'Enter API key…'}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' as const }}>
                {editingKeys[p.id] !== undefined && editingKeys[p.id] !== '' && (
                  <button
                    type="button"
                    onClick={() => saveKey(p.id)}
                    disabled={savingKey[p.id]}
                    className="btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >{savingKey[p.id] ? 'Saving…' : p.hasKey ? 'Replace' : 'Save'}</button>
                )}
                {p.hasKey && (
                  <>
                    <button
                      type="button"
                      onClick={() => testProvider(p.id)}
                      disabled={testing[p.id]}
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >{testing[p.id] ? 'Testing…' : 'Test'}</button>
                    <button
                      type="button"
                      onClick={() => removeKey(p.id)}
                      className="btn-ghost"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--error)' }}
                    >Remove</button>
                  </>
                )}
              </div>
              {testR && (
                <div style={{ fontSize: '0.75rem', color: testR.ok ? 'var(--success)' : 'var(--error)', marginBottom: 6 }}>
                  {testR.ok ? `✓ ${testR.latencyMs}ms` : `✗ ${testR.error?.slice(0, 80) || 'failed'}`}
                </div>
              )}

              {/* Model selector (only if has key) */}
              {p.hasKey && (
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Model</label>
                  <select
                    value={p.selectedModel}
                    onChange={(e) => saveModel(p.id, e.target.value)}
                    disabled={savingModel[p.id]}
                    style={{ width: '100%', marginTop: 4, fontSize: '0.85rem' }}
                  >
                    {p.availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showOnlyOne && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' as const, marginBottom: 12 }}>
          Only 1 provider is configured. The UI will show only that one until you add more.
        </p>
      )}

      {/* System prompts */}
      <h3 style={{ fontSize: '0.95rem', marginBottom: 8, color: 'var(--text)' }}>System Prompt Library</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        The system prompt instructs the AI how to rewrite prompts. Built-in templates cover common cases; create your own for specialized workflows.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 10, marginBottom: 12 }}>
        {systemPrompts.map(sp => {
          const isActive = String(sp.id) === activePromptId;
          return (
            <div key={sp.id} style={{
              padding: 12,
              borderRadius: 8,
              background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'rgba(0, 0, 0, 0.2)',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(99, 102, 241, 0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                <strong style={{ fontSize: '0.88rem' }}>{sp.name}</strong>
                {sp.isBuiltin === 1 && <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Built-in</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
                {sp.description || sp.category}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => activateSystemPrompt(sp.id)}
                    className="btn-primary"
                    style={{ padding: '3px 9px', fontSize: '0.72rem' }}
                  >Use</button>
                )}
                {isActive && <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>✓ Active</span>}
                {sp.isBuiltin !== 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingPrompt({ ...sp })}
                      className="btn-ghost"
                      style={{ padding: '3px 9px', fontSize: '0.72rem' }}
                    >Edit</button>
                    <button
                      type="button"
                      onClick={() => deletePrompt(sp.id)}
                      className="btn-ghost"
                      style={{ padding: '3px 9px', fontSize: '0.72rem', color: 'var(--error)' }}
                    >Delete</button>
                  </>
                )}
                {sp.isBuiltin === 1 && (
                  <button
                    type="button"
                    onClick={() => setEditingPrompt({ ...sp, name: sp.name + ' (copy)' })}
                    className="btn-ghost"
                    style={{ padding: '3px 9px', fontSize: '0.72rem' }}
                    title="Create editable copy"
                  >Duplicate</button>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setNewPrompt({ name: '', content: '', category: 'general', description: '' })}
          className="btn-ghost"
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            background: 'transparent',
            minHeight: 80,
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >+ New system prompt</button>
      </div>

      {/* Edit modal */}
      {editingPrompt && (
        <PromptEditor
          title={`Edit: ${editingPrompt.name}`}
          prompt={editingPrompt}
          onChange={setEditingPrompt}
          onSave={saveEditedPrompt}
          onCancel={() => setEditingPrompt(null)}
        />
      )}
      {newPrompt && (
        <PromptEditor
          title="New system prompt"
          prompt={{ ...newPrompt, id: 0, isBuiltin: 0 } as any}
          onChange={(p) => setNewPrompt({ name: p.name, content: p.content, category: p.category, description: p.description })}
          onSave={createNewPrompt}
          onCancel={() => setNewPrompt(null)}
        />
      )}
    </div>
  );
}

function PromptEditor({ title, prompt, onChange, onSave, onCancel }: {
  title: string;
  prompt: SystemPrompt;
  onChange: (p: SystemPrompt) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="card" style={{ width: 'min(95vw, 700px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const, gap: 10, padding: 20 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
        <input
          type="text"
          value={prompt.name}
          onChange={(e) => onChange({ ...prompt, name: e.target.value })}
          placeholder="Name (e.g. 'Cinematic Color Grader')"
          style={{ width: '100%' }}
        />
        <input
          type="text"
          value={prompt.description}
          onChange={(e) => onChange({ ...prompt, description: e.target.value })}
          placeholder="Short description"
          style={{ width: '100%' }}
        />
        <input
          type="text"
          value={prompt.category}
          onChange={(e) => onChange({ ...prompt, category: e.target.value })}
          placeholder="Category (e.g. 'cinematic', 'product', 'portrait')"
          style={{ width: '100%' }}
        />
        <textarea
          value={prompt.content}
          onChange={(e) => onChange({ ...prompt, content: e.target.value })}
          rows={14}
          placeholder="System prompt content…"
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' as const }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="btn-ghost" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>Cancel</button>
          <button type="button" onClick={onSave} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>Save</button>
        </div>
      </div>
    </div>
  );
}