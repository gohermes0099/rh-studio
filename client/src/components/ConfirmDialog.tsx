interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      className="overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          minWidth: 340,
          maxWidth: 420,
          padding: 24,
          animation: 'fadeInScale 0.2s ease',
        }}
      >
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: danger
            ? 'rgba(239, 68, 68, 0.12)'
            : 'rgba(99, 102, 241, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          fontSize: '1.2rem',
        }}>
          {danger ? '⚠️' : 'ℹ️'}
        </div>
        <h3 style={{ marginBottom: 8, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            className="btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
            style={{ minWidth: 80 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
