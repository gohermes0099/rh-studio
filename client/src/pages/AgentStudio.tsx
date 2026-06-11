import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';

interface SystemPrompt {
  id: number;
  name: string;
  content: string;
  category: string;
  description: string;
  isBuiltin: number;
  requiresInput: number;
}

interface EnhanceResult {
  enhanced: string;
  negative?: string;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  changes: string[];
  model: string;
  provider: string;
  systemPrompt: { id: number | null; name: string };
  usage?: { prompt: number; completion: number; total: number };
}

export default function AgentStudio() {
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [activePromptId, setActivePromptId] = useState<number>(1);
  const [instruction, setInstruction] = useState('');
  const [images, setImages] = useState<{ url: string; base64?: string; mimeType: string }[]>([]);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listSystemPrompts().then(r => {
      setSystemPrompts(r.systemPrompts as unknown as SystemPrompt[]);
      api.getAIConfig().then(cfg => setActivePromptId(Number(cfg.activeSystemPromptId) || 1));
    }).catch(e => setError(e.message));
  }, []);

  const handleAddFiles = async (files: FileList) => {
    const newImgs: { url: string; base64: string; mimeType: string }[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1];
      newImgs.push({ url: dataUrl, base64, mimeType: file.type });
    }
    setImages(prev => [...prev, ...newImgs]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      await handleAddFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEnhance = async () => {
    if (!instruction.trim()) {
      setError('Type an instruction first');
      return;
    }
    setEnhancing(true);
    setError('');
    setResult(null);
    try {
      let imageUrls: string[] | undefined;
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;
      if (images.length > 0) {
        // For single image, send base64 directly. For multiple, use URLs (data URIs).
        if (images.length === 1) {
          imageBase64 = images[0].base64;
          imageMimeType = images[0].mimeType;
        } else {
          imageUrls = images.map(i => i.url);
        }
      }
      const res = await api.enhancePrompt({
        text: instruction.trim(),
        toolName: 'standalone',
        systemPromptId: activePromptId,
        imageUrls,
        imageBase64,
        imageMimeType,
      });
      setResult(res);
      setEditedPrompt(res.enhanced);
    } catch (err: any) {
      setError(err.message || 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!result) return;
    const title = prompt('Title for the prompt library:', editedPrompt.slice(0, 60) + '...');
    if (!title) return;
    const description = result.rationale || 'AI-enhanced prompt';
    const tagsInput = prompt('Tags (comma-separated):', `enhanced, ${result.provider}, ${result.systemPrompt.name.toLowerCase()}`);
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      await api.createPrompt({
        title,
        content: editedPrompt,
        description,
        tags,
      });
      alert('Saved to Prompts library! Visit the Prompts page to see it.');
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    }
  };

  return (
    <div className="page">
      <h1>Agent Studio</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
        Standalone AI prompt enhancer. Pick a system prompt, attach images, describe what you want — the agent crafts a structured, optimized prompt that you can save to the library.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16 }}>
        {/* Left: inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>1. Pick a system prompt</h3>
            <select
              value={activePromptId}
              onChange={(e) => setActivePromptId(Number(e.target.value))}
              style={{ width: '100%' }}
            >
              {systemPrompts.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name} {sp.isBuiltin === 1 ? '(built-in)' : ''}</option>
              ))}
            </select>
            {systemPrompts.find(sp => sp.id === activePromptId)?.description && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
                {systemPrompts.find(sp => sp.id === activePromptId)?.description}
              </p>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>2. Attach images (optional)</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: '1px dashed rgba(99, 102, 241, 0.3)',
                borderRadius: 8,
                padding: 20,
                textAlign: 'center' as const,
                cursor: 'pointer',
                background: 'rgba(0, 0, 0, 0.15)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
              }}
            >
              Drop images here, or click to choose
              <br /><span style={{ fontSize: '0.72rem' }}>JPG, PNG, WEBP</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, marginTop: 10 }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img.url} alt={`upload-${i}`} style={{ width: '100%', height: 80, objectFit: 'cover' as const, borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                        borderRadius: '50%', width: 20, height: 20, cursor: 'pointer',
                        fontSize: '0.7rem', lineHeight: 1,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>3. What do you want?</h3>
            {(() => {
              const sp = systemPrompts.find(p => p.id === activePromptId);
              if (sp && sp.requiresInput === 0) {
                return (
                  <div style={{ padding: 14, background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ✨ <strong>{sp.name}</strong> runs automatically with just the image. No text input needed.
                    <br />You can still add a hint below if you want:
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      rows={2}
                      placeholder='(optional) additional hint, e.g. "preserve the warm sunset mood"'
                      style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' as const, marginTop: 8 }}
                    />
                  </div>
                );
              }
              return (
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={5}
              placeholder='e.g. "reiluminar esta foto, pero mantener el ambiente natural. La chica está subexpuesta del lado derecho."'
              style={{ width: '100%', fontSize: '0.9rem', resize: 'vertical' as const }}
            />
              );
            })()}
            <button
              type="button"
              onClick={handleEnhance}
              disabled={enhancing || !instruction.trim()}
              className="btn-primary"
              style={{ marginTop: 12, width: '100%', padding: 10, fontSize: '0.9rem' }}
            >
              {enhancing ? '✨ Enhancing…' : '✨ Enhance with AI'}
            </button>
            {error && <div role="alert" style={{ marginTop: 8, color: 'var(--error)', fontSize: '0.85rem' }}>{error}</div>}
          </div>
        </div>

        {/* Right: result */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Enhanced prompt</h3>
          {!result && !enhancing && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: '40px 0', textAlign: 'center' as const }}>
              Fill in the left and click Enhance to see the result.
            </div>
          )}
          {enhancing && (
            <div style={{ padding: 40, textAlign: 'center' as const, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8, animation: 'pulse 1.2s ease-in-out infinite' }}>✨</div>
              The agent is crafting your prompt…
            </div>
          )}
          {result && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' as const }}>
                <span style={{ color: 'var(--accent-cyan)' }}>✨ Enhanced</span>
                <span>·</span>
                <span>{result.systemPrompt.name}</span>
                <span>·</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{result.provider}/{result.model}</span>
                <span>·</span>
                <span style={{ color: result.confidence === 'high' ? 'var(--success)' : result.confidence === 'medium' ? 'var(--warning)' : 'var(--error)', fontWeight: 600, textTransform: 'uppercase' as const }}>
                  {result.confidence}
                </span>
              </div>

              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={10}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical' as const }}
              />

              {result.changes.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {result.changes.map((c, i) => (
                    <span key={i} style={{
                      fontSize: '0.7rem', padding: '3px 8px',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      borderRadius: 999, color: 'var(--accent-cyan)',
                    }}>{c}</span>
                  ))}
                </div>
              )}

              {result.rationale && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px 10px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: 6, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-dim)' }}>Why:</strong> {result.rationale}
                </div>
              )}

              {result.negative && (
                <details>
                  <summary style={{ fontSize: '0.78rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    Negative prompt
                  </summary>
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6, lineHeight: 1.4 }}>
                    {result.negative}
                  </div>
                </details>
              )}

              {result.usage && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  Tokens: {result.usage.prompt} in / {result.usage.completion} out ({result.usage.total} total)
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 8 }}>
                <button type="button" onClick={handleSaveToLibrary} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  💾 Save to library
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(editedPrompt);
                  }}
                  className="btn-ghost"
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                >📋 Copy</button>
                <button
                  type="button"
                  onClick={() => { setResult(null); setEditedPrompt(''); }}
                  className="btn-ghost"
                  style={{ padding: '8px 14px', fontSize: '0.85rem', marginLeft: 'auto' }}
                >Clear</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}