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

export default function Gallery() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [viewMode, setViewMode] = useState<'after' | 'before'>('after');

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
      // Use the source upload (original) if available, otherwise the result
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
      // The gallery item stores the RH taskId, find the DB row with that
      const originalTask = tasksData.tasks.find((t: any) => t.taskId === (selectedImage as any).taskId);
      if (!originalTask) {
        throw new Error('Original task not found in DB');
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

            {/* Image area with before/after toggle */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, minHeight: 0 }}>
              {/* Image display - shows AFTER or BEFORE based on viewMode */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: 'var(--radius-lg)',
                  minHeight: 'min(55vh, 400px)',
                  padding: 8,
                  overflow: 'hidden',
                  position: 'relative' as const,
                }}
              >
                {viewMode === 'after' ? (
                  selectedImage.fileName.startsWith('http') ? (
                    <img
                      src={selectedImage.fileName}
                      alt="Result"
                      style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' as const, borderRadius: 4 }}
                    />
                  ) : (
                    <img
                      src={`/api/gallery/files/${selectedImage.id}`}
                      alt="Result"
                      style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' as const, borderRadius: 4 }}
                    />
                  )
                ) : selectedImage.sourceUploadUrl ? (
                  <img
                    src={selectedImage.sourceUploadUrl}
                    alt="Source"
                    style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' as const, borderRadius: 4 }}
                  />
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' as const, padding: 20 }}>
                    No source image available
                    <br />
                    <span style={{ fontSize: '0.72rem' }}>(this task was created before source tracking)</span>
                  </div>
                )}
              </div>

              {/* View toggle (only if source exists) */}
              {selectedImage.sourceUploadUrl && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
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
                      style={{ borderRadius: 999, padding: '6px 18px', fontSize: '0.8rem', minWidth: 80 }}
                    >
                      Result
                    </button>
                    <button
                      onClick={() => setViewMode('before')}
                      className={viewMode === 'before' ? 'btn-primary' : 'btn-ghost'}
                      style={{ borderRadius: 999, padding: '6px 18px', fontSize: '0.8rem', minWidth: 80 }}
                    >
                      Original
                    </button>
                  </div>
                </div>
              )}
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
                    download={`${selectedImage.toolName}-${viewMode}`}
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