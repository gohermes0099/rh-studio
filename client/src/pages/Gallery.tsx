import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import ToolPickerModal from '../components/ToolPickerModal';
import { api } from '../api/client';

interface GalleryItem {
  id: number;
  toolId: number;
  toolName: string;
  fileName: string;
  outputType: string;
  nodeId: string;
  createdAt: string;
  prompt?: string;
  sourceUploadUrl?: string;
  sourceUploadId?: number | null;
}

/** Render a long URL in a way that stays inside its container (no overflow) */
function UrlBox({ url, label, maxLines = 2 }: { url: string; label?: string; maxLines?: number }) {
  if (!url) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {label && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
          {label}
        </div>
      )}
      <div
        title={url}
        style={{
          fontSize: '0.72rem',
          fontFamily: 'monospace',
          color: 'var(--text-muted)',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '6px 8px',
          borderRadius: 4,
          wordBreak: 'break-all',
          overflowWrap: 'anywhere',
          maxHeight: maxLines === 1 ? '2.4em' : `${maxLines * 1.4}em`,
          overflow: 'hidden',
          lineHeight: 1.3,
        }}
      >
        {url}
      </div>
    </div>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch('/api/gallery', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
      .then(res => res.ok ? res.json() : { items: [] })
      .then(data => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (deleteConfirm === null) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/gallery/${deleteConfirm}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== deleteConfirm));
        if (selectedImage?.id === deleteConfirm) setSelectedImage(null);
      }
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const handleEditWith = async (toolId: number) => {
    if (!selectedImage) return;
    setToolPickerOpen(false);
    try {
      // Use the source upload (original) if available, otherwise the result
      const token = localStorage.getItem('auth_token');
      let fileName = '';
      if (selectedImage.sourceUploadId) {
        // Fetch the upload to get the latest rhFileName
        const res = await fetch(`/api/uploads/${selectedImage.sourceUploadId}/file`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          redirect: 'follow',
        });
        const blob = await res.blob();
        const ext = selectedImage.fileName.split('.').pop() || 'jpg';
        const file = new File([blob], `source-${selectedImage.sourceUploadId}.${ext}`, { type: blob.type });
        const result = await api.uploadFile(file, false);
        fileName = result.fileName;
      } else {
        // Fall back to the result image
        const res = await fetch(`/api/gallery/files/${selectedImage.id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          redirect: 'follow',
        });
        const blob = await res.blob();
        const ext = selectedImage.fileName.split('.').pop() || 'jpg';
        const file = new File([blob], `result-${selectedImage.id}.${ext}`, { type: blob.type });
        const result = await api.uploadFile(file, false);
        fileName = result.fileName;
      }

      navigate(`/tools/${toolId}/run`, {
        state: {
          prefillImage: {
            fileName,
            previewUrl: selectedImage.sourceUploadUrl || `/api/gallery/files/${selectedImage.id}`,
          },
        },
      });
    } catch (err) {
      console.error('Failed to re-use image:', err);
    }
  };

  const handleRerun = async () => {
    if (!selectedImage) return;
    setRerunning(true);
    try {
      // Find the original task to re-run. taskId in gallery_items is the RH taskId.
      const token = localStorage.getItem('auth_token');
      const tasksRes = await fetch('/api/tasks', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!tasksRes.ok) throw new Error('Failed to list tasks');
      const tasksData = await tasksRes.json();
      const originalTask = tasksData.tasks.find((t: any) => t.taskId === selectedImage.id || t.taskId === (selectedImage as any).taskId);
      if (!originalTask) {
        // Fallback: use id (DB id) if taskId is undefined
        throw new Error('Original task not found');
      }
      const result = await api.rerunTask(originalTask.id);
      navigate(`/history/${result.task.id}`);
    } catch (err) {
      console.error('Re-run failed:', err);
      alert('Failed to re-run: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setRerunning(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <h1>Gallery</h1>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No completed images yet. Run a tool and come back to see results here.
        </p>
      ) : (
        <div className="grid grid-2">
          {items.map(item => (
            <div
              key={item.id}
              className="card"
              style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative' }}
              onClick={() => setSelectedImage(item)}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.transition = 'transform 0.2s ease';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }}
                className="btn-danger"
                style={{ position: 'absolute', top: 8, right: 8, padding: '4px 8px', fontSize: '0.75rem', zIndex: 1 }}
              >
                Delete
              </button>

              {/* Result image (or fallback if it's a URL) */}
              <img
                src={item.fileName.startsWith('http') ? item.fileName : `/api/gallery/files/${item.id}`}
                alt={`${item.toolName} result`}
                loading="lazy"
                style={{
                  width: '100%',
                  height: 280,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.toolName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(item.createdAt).toLocaleString()}
                </div>
                {item.prompt && (
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      marginTop: 6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                      lineHeight: 1.4,
                    }}
                    title={item.prompt}
                  >
                    {item.prompt}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============= LIGHTBOX MODAL ============= */}
      {selectedImage && (
        <div className="overlay" onClick={() => setSelectedImage(null)}>
          <div
            style={{
              maxWidth: '96vw', maxHeight: '94vh',
              display: 'flex', flexDirection: 'column' as const,
              gap: 12,
              animation: 'fadeInScale 0.2s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top bar: close */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedImage(null)}
                className="btn-ghost"
                style={{ color: '#fff', fontSize: '1.5rem', padding: '4px 12px' }}
              >
                ✕
              </button>
            </div>

            {/* Before | After side-by-side */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', minHeight: 0 }}>
              {/* Before (source upload) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                  color: 'var(--text-dim)', marginBottom: 6, textAlign: 'center' as const,
                }}>
                  BEFORE
                </div>
                <div
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-lg)',
                    minHeight: 320, padding: 8, overflow: 'hidden',
                  }}
                >
                  {selectedImage.sourceUploadUrl ? (
                    <img
                      src={selectedImage.sourceUploadUrl}
                      alt="Source image"
                      style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' as const, borderRadius: 4 }}
                    />
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' as const, padding: 20 }}>
                      No source image
                      <br />
                      <span style={{ fontSize: '0.75rem' }}>(this task was created before source tracking was added)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-dim)', fontSize: '1.5rem' }}>
                →
              </div>

              {/* After (result) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                  color: 'var(--accent-cyan)', marginBottom: 6, textAlign: 'center' as const,
                }}>
                  AFTER
                </div>
                <div
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-lg)',
                    minHeight: 320, padding: 8, overflow: 'hidden',
                  }}
                >
                  <img
                    src={selectedImage.fileName.startsWith('http') ? selectedImage.fileName : `/api/gallery/files/${selectedImage.id}`}
                    alt="Result image"
                    style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' as const, borderRadius: 4 }}
                  />
                </div>
              </div>
            </div>

            {/* Info panel */}
            <div
              className="glass-panel"
              style={{
                padding: 16,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                maxWidth: '100%',
              }}
            >
              {/* Left column: tool, date, prompt */}
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{selectedImage.toolName}</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '4px 0 12px' }}>
                  {new Date(selectedImage.createdAt).toLocaleString()}
                </p>
                {selectedImage.prompt ? (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
                      Prompt
                    </div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius)',
                        lineHeight: 1.5,
                        maxHeight: 100,
                        overflowY: 'auto',
                        wordBreak: 'break-word',
                      }}
                    >
                      {selectedImage.prompt}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic' as const, color: 'var(--text-muted)' }}>
                    Prompt not available
                  </p>
                )}
              </div>

              {/* Right column: file URLs (truncated) + actions */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, minWidth: 0 }}>
                {selectedImage.sourceUploadUrl && (
                  <UrlBox url={selectedImage.sourceUploadUrl} label="Source (original)" maxLines={2} />
                )}
                <UrlBox url={selectedImage.fileName} label="Result" maxLines={2} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 8 }}>
                  <button
                    onClick={handleRerun}
                    disabled={rerunning}
                    className="btn-primary"
                    style={{ flex: 1, minWidth: 120 }}
                  >
                    {rerunning ? 'Re-running...' : '🔄 Re-run'}
                  </button>
                  <button
                    onClick={() => setToolPickerOpen(true)}
                    className="btn-primary"
                    style={{ flex: 1, minWidth: 120 }}
                  >
                    Edit with another tool
                  </button>
                  <a
                    href={`/api/gallery/files/${selectedImage.id}?dl=1`}
                    download={`${selectedImage.toolName}-result`}
                    className="btn-primary"
                    style={{ display: 'inline-block', padding: '8px 16px', textDecoration: 'none', textAlign: 'center' as const }}
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToolPickerModal
        open={toolPickerOpen}
        onSelect={handleEditWith}
        onCancel={() => setToolPickerOpen(false)}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete image"
        message="Are you sure you want to delete this image from the gallery? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        danger
      />
    </div>
  );
}