import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import DynamicField from '../components/DynamicField';
import type { EnhanceResult } from '../components/EnhanceButton';
import LoadingSpinner from '../components/LoadingSpinner';
import type { RhNodeField, Tool } from '@shared/types';

function fieldKey(f: { nodeId: string; fieldName: string }) {
  return `${f.nodeId}-${f.fieldName}`;
}

interface LocationState {
  prefillImage?: { fileName: string; uploadId?: number; previewUrl?: string };
}

export default function ToolRunner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [tool, setTool] = useState<Tool | null>(null);
  const [fields, setFields] = useState<RhNodeField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [prefillFieldKey, setPrefillFieldKey] = useState<string | null>(null);

  // Collect image URLs that have been uploaded (for AI enhance context).
  // The agent needs to SEE the images that will be used to generate the output,
  // so we include:
  //   1. The prefill image (when the user navigated here from /uploads or /gallery)
  //   2. The current value of every IMAGE field in the form (whether pre-filled,
  //      uploaded via Choose Image, or picked via From Library)
  // We dedupe so the same URL is only sent once.
  const imageUrls: string[] = [];
  const seen = new Set<string>();
  const pushIfNew = (url: string | undefined | null) => {
    if (!url || seen.has(url)) return;
    // Accept any URL the server can resolve: http(s), data:, or our own proxy paths.
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/api/')) {
      seen.add(url);
      imageUrls.push(url);
    }
  };
  // 1. Prefill image
  pushIfNew(locationState?.prefillImage?.previewUrl);
  if (locationState?.prefillImage?.fileName?.startsWith('http')) {
    pushIfNew(locationState.prefillImage.fileName);
  }
  // 2. Every IMAGE field's current value
  for (const f of fields) {
    if (f.fieldType !== 'IMAGE') continue;
    const v = values[fieldKey(f)];
    if (v) pushIfNew(v);
  }

  const handleSaveEnhancedToLibrary = async (result: EnhanceResult) => {
    const title = window.prompt('Save prompt to library — title:', result.enhanced.slice(0, 60) + '...');
    if (!title) return;
    try {
      await api.createPrompt({
        title,
        content: result.enhanced,
        toolId: tool?.id,
        description: result.rationale || 'AI-enhanced prompt',
        tags: ['enhanced', result.provider, ...(result.changes || []).slice(0, 2)],
      });
      window.alert('Saved to Prompts library');
    } catch (err: any) {
      window.alert('Failed to save: ' + err.message);
    }
  };
  const [quantity, setQuantity] = useState(1);
  // Track which fields the user has explicitly changed
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  // Whether the currently active system prompt needs text (true) or is image-only (false)
  const [activeSPRequiresInput, setActiveSPRequiresInput] = useState<boolean>(true);

  useEffect(() => {
    if (!id) return;
    api.getTool(Number(id))
      .then((t) => {
        setTool(t);
        let parsed: RhNodeField[] = [];
        try {
          parsed = JSON.parse(t.nodeInfoList);
        } catch {
          parsed = [];
        }
        setFields(parsed);
        const initial: Record<string, string> = {};
        parsed.forEach((f) => { initial[fieldKey(f)] = f.fieldValue || ''; });

        // Pre-fill the first IMAGE field if coming from uploads/gallery
        // and track which field received the prefill
        let prefilledKey: string | null = null;
        const touched = new Set<string>();
        if (locationState?.prefillImage?.fileName) {
          const firstImageField = parsed.find((f) => f.fieldType === 'IMAGE');
          if (firstImageField) {
            const key = fieldKey(firstImageField);
            initial[key] = locationState.prefillImage.fileName;
            prefilledKey = key;
            touched.add(key);  // Prefilled fields are "touched" so they get sent
          }
        }
        setPrefillFieldKey(prefilledKey);
        setTouchedFields(touched);

        setValues(initial);
      })
      .then(() => {
        // Fetch the active system prompt so we can tell DynamicField whether the
        // current SP is text-required (default) or image-only.
        return Promise.all([api.getAIConfig(), api.listSystemPrompts()]);
      })
      .then(([cfg, prompts]) => {
        const sp = (prompts.systemPrompts as any[]).find(p => String(p.id) === String(cfg.activeSystemPromptId));
        setActiveSPRequiresInput(sp ? sp.requiresInput !== 0 : true);
      })
      .catch(() => setError('Tool not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpload = async (file: File): Promise<string> => {
    const result = await api.uploadFile(file);
    // result.fileName is the imgbb URL — this is what RunningHub needs as fieldValue
    return result.fileName;
  };

  const buildNodeInfoList = useCallback(() => {
    return fields.map((f) => {
      const key = fieldKey(f);
      const userValue = values[key];
      const defaultValue = f.fieldValue ?? '';

      // For IMAGE fields: if user didn't touch the field, send empty (don't send example.png)
      // For other fields: use the user's value, or fall back to the default
      let fieldValue: string;
      if (f.fieldType === 'IMAGE') {
        // Only use userValue if user explicitly modified it
        fieldValue = touchedFields.has(key) ? (userValue ?? '') : '';
      } else {
        fieldValue = userValue ?? defaultValue;
      }

      return {
        ...f,
        fieldValue,
      };
    });
  }, [fields, values, touchedFields]);

  const handleRun = async () => {
    if (!tool) return;
    setRunning(true);
    setError('');
    setStatusMsg('');
    let firstTaskId: number | null = null;
    const nodeInfoList = buildNodeInfoList();
    for (let i = 1; i <= quantity; i++) {
      try {
        setStatusMsg('Creando tareas... (' + i + '/' + quantity + ')');
        const result = await api.runTask(tool.id, nodeInfoList);
        if (firstTaskId === null) firstTaskId = result.task.id;
      } catch (err) {
        setStatusMsg('');
        setError(err instanceof Error ? err.message : 'Failed to run task');
        setRunning(false);
        return;
      }
    }
    setStatusMsg('');
    setRunning(false);
    if (firstTaskId !== null) {
      navigate('/history/' + firstTaskId);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!tool) {
    return (
      <div className="page">
        <h1>Tool Runner</h1>
        <p style={{ color: 'var(--error)' }}>{error || 'Tool not found'}</p>
        <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: 16 }}>
          Back to Catalog
        </button>
      </div>
    );
  }

  if (!loading && fields.length === 0) {
    return (
      <div className="page">
        <h1>{tool.webappName}</h1>
        <p style={{ color: 'var(--text-muted)' }}>No configurable inputs for this tool.</p>
        <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: 16 }}>
          Back to Catalog
        </button>
      </div>
    );
  }

  const prefillActive = !!prefillFieldKey;

  return (
    <div className="page">
      <h1>{tool.webappName}</h1>

      {tool.coverUrl && (
        <div style={{
          width: '100%',
          height: 200,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <img
            src={tool.coverUrl}
            alt={tool.webappName}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {prefillActive && (
        <div className="card" style={{
          marginBottom: 16,
          padding: '10px 16px',
          fontSize: '0.85rem',
          color: 'var(--info)',
          borderColor: 'var(--info)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>📎</span>
          <span>Image pre-filled from uploads/gallery.</span>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fields.map((field, index) => (
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
                value={values[fieldKey(field)] ?? ''}
                toolId={tool?.id}
                toolName={tool?.webappName}
                imageUrls={imageUrls}
                requiresInput={activeSPRequiresInput}
                onSaveEnhancedToLibrary={handleSaveEnhancedToLibrary}
                onChange={(v) => {
                  const key = fieldKey(field);
                  setValues((prev) => ({ ...prev, [key]: v }));
                  setTouchedFields((prev) => new Set(prev).add(key));
                }}
                onUpload={handleUpload}
                previewUrl={
                  prefillFieldKey === fieldKey(field)
                    ? locationState?.prefillImage?.previewUrl
                      || (locationState?.prefillImage?.uploadId
                        ? `/api/uploads/${locationState.prefillImage.uploadId}/file`
                        : undefined)
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="card" style={{ marginTop: 16, borderColor: 'var(--error)', color: 'var(--error)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {statusMsg && !error && (
          <div style={{ marginTop: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {statusMsg}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Cantidad:
            <input
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value))))}
              disabled={running}
              style={{
                marginLeft: 8,
                width: 60,
                padding: '4px 8px',
                fontSize: '0.9rem',
              }}
            />
          </label>
        </div>

        <button
          onClick={handleRun}
          className="btn-primary"
          disabled={running}
          style={{ marginTop: 16, padding: '10px 24px', fontSize: '1rem' }}
        >
          {running ? (statusMsg || 'Running...') : 'Run'}
        </button>
      </div>
    </div>
  );
}
