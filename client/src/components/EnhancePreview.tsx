import { useState } from 'react';
import type { EnhanceResult } from './EnhanceButton';

interface EnhancePreviewProps {
  result: EnhanceResult;
  originalText: string;
  onUse: (newText: string) => void;
  onSaveToLibrary: (result: EnhanceResult) => void;
  onDismiss: () => void;
  onRevert: () => void;
}

export default function EnhancePreview({ result, originalText, onUse, onSaveToLibrary, onDismiss, onRevert }: EnhancePreviewProps) {
  const [edited, setEdited] = useState(result.enhanced);
  const [showNegative, setShowNegative] = useState(false);

  const confidenceColor = result.confidence === 'high' ? 'var(--success)' : result.confidence === 'medium' ? 'var(--warning)' : 'var(--error)';

  return (
    <div
      className="glass-panel"
      style={{
        marginTop: 8,
        padding: 14,
        background: 'rgba(99, 102, 241, 0.05)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>✨ AI Enhanced</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{result.systemPrompt.name}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{result.provider}/{result.model}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Confidence:</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: confidenceColor, textTransform: 'uppercase' as const }}>{result.confidence}</span>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        Original: <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' as const }}>"{originalText.slice(0, 120)}{originalText.length > 120 ? '…' : ''}"</span>
      </div>

      <textarea
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        rows={Math.max(3, Math.min(8, edited.split('\n').length + 1))}
        style={{
          width: '100%',
          padding: 10,
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: 8,
          color: 'var(--text)',
          fontSize: '0.9rem',
          lineHeight: 1.5,
          resize: 'vertical' as const,
          fontFamily: 'inherit',
        }}
      />

      {result.changes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {result.changes.map((c, i) => (
            <span key={i} style={{
              fontSize: '0.72rem',
              padding: '3px 8px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 999,
              color: 'var(--accent-cyan)',
            }}>{c}</span>
          ))}
        </div>
      )}

      {result.rationale && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: 6 }}>
          <strong style={{ color: 'var(--text-dim)' }}>Why:</strong> {result.rationale}
        </div>
      )}

      {result.negative && (
        <div>
          <button
            type="button"
            onClick={() => setShowNegative(s => !s)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
          >
            {showNegative ? '▼' : '▶'} Negative prompt ({result.negative.length} chars)
          </button>
          {showNegative && (
            <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6, lineHeight: 1.4 }}>
              {result.negative}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => onUse(edited)}
          className="btn-primary"
          style={{ padding: '7px 14px', fontSize: '0.85rem' }}
        >✓ Use this prompt</button>
        <button
          type="button"
          onClick={() => onSaveToLibrary(result)}
          className="btn-ghost"
          style={{ padding: '7px 14px', fontSize: '0.85rem' }}
        >💾 Save to library</button>
        <button
          type="button"
          onClick={onRevert}
          className="btn-ghost"
          style={{ padding: '7px 14px', fontSize: '0.85rem' }}
        >↩ Revert</button>
        <button
          type="button"
          onClick={onDismiss}
          className="btn-ghost"
          style={{ padding: '7px 14px', fontSize: '0.85rem', marginLeft: 'auto' }}
        >✕ Dismiss</button>
      </div>
    </div>
  );
}