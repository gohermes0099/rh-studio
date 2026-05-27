import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { UploadItem } from '@shared/types';

interface BrowseUploadsModalProps {
  open: boolean;
  onPick: (url: string) => void;
  onClose: () => void;
}

export default function BrowseUploadsModal({ open, onPick, onClose }: BrowseUploadsModalProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.listUploads()
      .then((res) => setUploads(res.uploads))
      .catch(() => setUploads([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;

    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = modal.querySelectorAll<HTMLElement>(selector);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    const timer = setTimeout(() => {
      const first = modal.querySelector<HTMLElement>(selector);
      first?.focus();
    }, 50);

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" style={{ zIndex: 2000 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={modalRef}
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: 900,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          animation: 'fadeInScale 0.2s ease',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Browse Uploads</h2>
          <button onClick={onClose} className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '1.2rem', lineHeight: 1 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
              Loading uploads...
            </p>
          ) : uploads.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
              No uploads yet.
            </p>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="card"
                  role="button"
                  tabIndex={0}
                  style={{
                    cursor: 'pointer',
                    padding: 0,
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, transform 0.15s',
                  }}
                  onClick={() => onPick(upload.rhFileName || upload.fileName)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(upload.rhFileName || upload.fileName); } }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {upload.mimeType.startsWith('image/') ? (
                    <img
                      src={`/api/uploads/${upload.id}/file`}
                      alt={upload.originalName}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: 150,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: 150,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg)',
                      color: 'var(--text-muted)',
                      fontSize: '2rem',
                    }}>
                      {upload.mimeType.startsWith('video/') ? '🎬' : '🎵'}
                    </div>
                  )}
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{
                      fontSize: '0.8rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={upload.originalName}>
                      {upload.originalName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
