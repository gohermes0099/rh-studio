import { useState } from 'react';
import { api } from '../api/client';

export type EnhanceState = 'idle' | 'enhancing' | 'done' | 'error';

export interface EnhanceResult {
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

interface EnhanceButtonProps {
  text: string;
  fieldName?: string;
  toolId?: number;
  toolName?: string;
  imageUrls?: string[];
  onResult: (result: EnhanceResult) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
  // When false, the active system prompt is image-only — button works with empty text
  // and the field's text is ignored. The image alone drives the agent.
  requiresInput?: boolean;
  // Optional callback fired just before the API call (e.g. to clear the field).
  onBeforeEnhance?: () => void;
}

export default function EnhanceButton({ text, fieldName, toolId, toolName, imageUrls, onResult, onError, disabled, requiresInput = true, onBeforeEnhance }: EnhanceButtonProps) {
  const [state, setState] = useState<EnhanceState>('idle');
  const [error, setError] = useState('');

  const isImageOnly = requiresInput === false;
  const isReady = isImageOnly || !!text.trim();

  const handleClick = async () => {
    if (!isReady) {
      setError('Type something first');
      setState('error');
      setTimeout(() => { setError(''); setState('idle'); }, 2000);
      return;
    }
    setState('enhancing');
    setError('');
    // Let parent reset its field state (e.g. clear the textarea) right before the API call
    onBeforeEnhance?.();
    try {
      const result = await api.enhancePrompt({
        text: text.trim() || '',  // empty is OK for image-only SPs
        fieldName,
        toolId,
        toolName,
        imageUrls,
      });
      setState('done');
      onResult(result);
    } catch (err: any) {
      setState('error');
      const msg = err.message || 'Enhancement failed';
      setError(msg);
      onError?.(msg);
      setTimeout(() => { setError(''); setState('idle'); }, 3000);
    }
  };

  const title = state === 'enhancing'
    ? 'Enhancing…'
    : state === 'error'
      ? error
      : isImageOnly
        ? 'Generate prompt from image (active system prompt is image-only — text input will be ignored)'
        : 'Enhance prompt with AI';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'enhancing' || !isReady}
        title={title}
        style={{
          background: state === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
          border: `1px solid ${state === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.35)'}`,
          color: state === 'error' ? '#fca5a5' : '#a5b4fc',
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: '0.78rem',
          cursor: state === 'enhancing' ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontWeight: 500,
          opacity: !isReady ? 0.5 : 1,
        }}
      >
        {state === 'enhancing' ? (
          <>
            <span style={{ animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block' }}>✨</span>
            {isImageOnly ? 'Generating…' : 'Enhancing…'}
          </>
        ) : state === 'error' ? (
          <>⚠ Failed</>
        ) : state === 'done' ? (
          <>✓ {isImageOnly ? 'Generated' : 'Enhanced'}</>
        ) : (
          <>{isImageOnly ? '✨ Generate' : '✨ Enhance'}</>
        )}
      </button>
    </div>
  );
}
