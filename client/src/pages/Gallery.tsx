import { useEffect, useState, useState as React } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import ToolPickerModal from '../components/ToolPickerModal';
import { api } from '../api/client';

interface GalleryItem {
  id: number;
  taskId: string | null;
  toolId: number;
  toolName: string;
  fileName: string;
  outputType: string;
  nodeId: string;
  createdAt: string;
  prompt?: string;
  sourceUploadUrl?: string;
  sourceUploadId?: number | null;
  originalUrl?: string;
}

type ViewMode = 'after' | 'before' | 'compare';

/** Render a long URL in a way that stays inside its container (no overflow) */
function UrlBox({ url, label }: { url: string; label?: string }) {
  if (!url) return null;
  return (
    <div style={{ marginTop: 4, minWidth: 0 }}>
      {label && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2 }}>
          {label}
        </div>
      )}
      <div
        title={url}
        style={{
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          color: 'var(--text-muted)',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '5px 7px',
          borderRadius: 4,
          wordBreak: 'break-all',
          overflowWrap: 'anywhere',
          maxHeight: '2.6em',
          overflow: 'hidden',
          lineHeight: 1.3,
        }}
      >
        {url}
      </div>
    </div>
  );
}

/** Image with onError fallback */
function SafeImage({ src, alt, style, fallback }: { src: string; alt: string; style?: React.CSSProperties; fallback?: React.ReactNode }) {
  const [errored, setErrored] = useState(false);
  if (errored || !src) {
    return (
      <div style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' as const, padding: 20,
        background: 'rgba(0,0,0,0.3)', borderRadius: 4,
      }}>
        {fallback || (
          <>
            <div>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🖼️</div>
              Image unavailable
              <br />
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{errored ? 'Failed to load' : 'No source'}</span>
            </div>
          </>
        )}
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setErrored(true)} loading="lazy" />;
}

export default function Gallery() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('after');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch('/api/gallery', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
      .then(res => res.ok ? res.json() : { items: [] })
      .then(data => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Reset view mode when opening a different image
  useEffect(() => {
    setViewMode('after');
  }, [selectedImage?.id]);

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
      const token = localStorage.getItem('auth_token');
      let fileName = '';
      if (selectedImage.sourceUploadId) {
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
      const token = localStorage.getItem('auth_token');
      const tasksRes = await fetch('/api/tasks', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!tasksRes.ok) throw new Error('Failed to list tasks');
      const tasksData = await tasksRes.json();
      // Find the task by RH taskId (matches the gallery's taskId)
      const allTasks = tasksData.tasks || [];
      const originalTask = allTasks.find((t: any) => t.taskId === selectedImage.taskId);
      if (!originalTask) {
        throw new Error('Original task not found — try a fresh upload to test re-run');
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

  // Helper: get the result image URL
  const resultImgUrl = (item: GalleryItem) =>
    item.fileName.startsWith('http') ? item.fileName : `/api/gallery/files/${item.id}`;

  // Helper: get the source image URL
  const sourceImgUrl = (item: GalleryItem) => item.sourceUploadUrl || '';

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
              <SafeImage
                src={resultImgUrl(item)}
                alt={`${item.toolName} result`}
                style={{
                  width: '100%',
                  height: 280,
                  objectFit: 'cover',
                  display: 'block',
                }}
                fallback={<div style={{ height: 280, display: 'flex', alignItems: 'center' }}>Image unavailable</div>}
              />
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.toolName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  {new Date(item.createdAt).toLocaleString()}
                </div>
                {item.prompt && (
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
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
            className="gallery-modal"
            style={{
              width: 'min(95vw, 1100px)',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column' as const,
              gap: 12,
              animation: 'fadeInScale 0.2s ease',
              padding: 'clamp(8px, 2vw, 16px)',
              boxSizing: 'border-box' as const,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top bar: title + close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {selectedImage.toolName}
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '2px 0 0' }}>
                  {new Date(selectedImage.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="btn-ghost"
                style={{ color: '#fff', fontSize: '1.4rem', padding: '2px 10px', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Image area */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, minHeight: 0 }}>
              {viewMode === 'compare' ? (
                // SIDE-BY-SIDE compare mode
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                      color: 'var(--text-dim)', textAlign: 'center' as const,
                    }}>BEFORE</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-lg)',
                      minHeight: 'min(50vh, 350px)', padding: 8, overflow: 'hidden',
                    }}>
                      <SafeImage
                        src={sourceImgUrl(selectedImage)}
                        alt="Source"
                        style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain' as const, borderRadius: 4 }}
                        fallback={<div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' as const }}>No source available</div>}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                      color: 'var(--accent-cyan)', textAlign: 'center' as const,
                    }}>AFTER</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-lg)',
                      minHeight: 'min(50vh, 350px)', padding: 8, overflow: 'hidden',
                    }}>
                      <SafeImage
                        src={resultImgUrl(selectedImage)}
                        alt="Result"
                        style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain' as const, borderRadius: 4 }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // Single image mode
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: 'var(--radius-lg)',
                    minHeight: 'min(55vh, 400px)',
                    padding: 8,
                    overflow: 'hidden',
                  }}
                >
                  <SafeImage
                    src={viewMode === 'before' ? sourceImgUrl(selectedImage) : resultImgUrl(selectedImage)}
                    alt={viewMode === 'before' ? 'Source' : 'Result'}
                    style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' as const, borderRadius: 4 }}
                    fallback={
                      viewMode === 'before'
                        ? <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' as const, padding: 20 }}>
                            No source image available
                            <br />
                            <span style={{ fontSize: '0.7rem' }}>(this task was created before source tracking)</span>
                          </div>
                        : undefined
                    }
                  />
                </div>
              )}

              {/* View toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 6 }}>
                <div style={{
                  display: 'inline-flex',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: 999,
                  padding: 4,
                  gap: 4,
                }}>
                  <button
                    onClick={() => setViewMode('after')}
                    className={viewMode === 'after' ? 'btn-primary' : 'btn-ghost'}
                    style={{ borderRadius: 999, padding: '6px 14px', fontSize: '0.8rem', minWidth: 70 }}
                  >
                    Result
                  </button>
                  <button
                    onClick={() => setViewMode('before')}
                    className={viewMode === 'before' ? 'btn-primary' : 'btn-ghost'}
                    style={{ borderRadius: 999, padding: '6px 14px', fontSize: '0.8rem', minWidth: 70 }}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setViewMode('compare')}
                    className={viewMode === 'compare' ? 'btn-primary' : 'btn-ghost'}
                    style={{ borderRadius: 999, padding: '6px 14px', fontSize: '0.8rem', minWidth: 70 }}
                  >
                    Compare
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom info panel: prompt + urls + actions */}
            <div
              className="glass-panel"
              style={{
                padding: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 14,
              }}
            >
              {/* Prompt */}
              {selectedImage.prompt ? (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
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
                      maxHeight: 120,
                      overflowY: 'auto',
                      wordBreak: 'break-word',
                    }}
                  >
                    {selectedImage.prompt}
                  </div>
                </div>
              ) : (
                <div style={{ minWidth: 0, fontSize: '0.85rem', fontStyle: 'italic' as const, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  No prompt available
                </div>
              )}

              {/* URLs + Actions */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, minWidth: 0 }}>
                {selectedImage.sourceUploadUrl && (
                  <UrlBox url={selectedImage.sourceUploadUrl} label="Source" />
                )}
                <UrlBox url={selectedImage.fileName} label="Result" />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 4 }}>
                  <button
                    onClick={handleRerun}
                    disabled={rerunning}
                    className="btn-primary"
                    style={{ flex: '1 1 110px', minWidth: 0, fontSize: '0.82rem', padding: '8px 12px' }}
                    title={selectedImage.taskId ? `Re-run task ${selectedImage.taskId}` : 'No original task linked'}
                  >
                    {rerunning ? 'Re-running...' : '🔄 Re-run'}
                  </button>
                  <button
                    onClick={() => setToolPickerOpen(true)}
                    className="btn-primary"
                    style={{ flex: '1 1 110px', minWidth: 0, fontSize: '0.82rem', padding: '8px 12px' }}
                  >
                    Edit
                  </button>
                  <a
                    href={`/api/gallery/files/${selectedImage.id}?dl=1`}
                    download={`${selectedImage.toolName}-result`}
                    className="btn-primary"
                    style={{ display: 'inline-block', padding: '8px 12px', textDecoration: 'none', textAlign: 'center' as const, fontSize: '0.82rem', flex: '0 0 auto' }}
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