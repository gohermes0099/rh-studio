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
}

export default function EnhanceButton({ text, fieldName, toolId, toolName, imageUrls, onResult, onError, disabled }: EnhanceButtonProps) {
  const [state, setState] = useState<EnhanceState>('idle');
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (!text.trim()) {
      setError('Type something first');
      setState('error');
      setTimeout(() => { setError(''); setState('idle'); }, 2000);
      return;
    }
    setState('enhancing');
    setError('');
    try {
      const result = await api.enhancePrompt({
        text: text.trim(),
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

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'enhancing' || !text.trim()}
        title={state === 'enhancing' ? 'Enhancing…' : state === 'error' ? error : 'Enhance prompt with AI'}
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
          opacity: !text.trim() ? 0.5 : 1,
        }}
      >
        {state === 'enhancing' ? (
          <>
            <span style={{ animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block' }}>✨</span>
            Enhancing…
          </>
        ) : state === 'error' ? (
          <>⚠ Failed</>
        ) : state === 'done' ? (
          <>✓ Enhanced</>
        ) : (
          <>✨ Enhance</>
        )}
      </button>
    </div>
  );
}