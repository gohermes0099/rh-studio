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
}

export default function Gallery() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{
    id: number;
    fileName: string;
    toolName: string;
    createdAt: string;
    prompt?: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (deleteConfirm === null) return;
    try {
      const res = await fetch(`/api/gallery/${deleteConfirm}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== deleteConfirm));
      }
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const handleEditWith = async (toolId: number) => {
    if (!selectedImage) return;
    setToolPickerOpen(false);
    try {
      // Download the image from gallery files endpoint
      const res = await fetch(`/api/gallery/files/${selectedImage.id}`);
      const blob = await res.blob();
      // Re-upload it (don't save to uploads gallery)
      const ext = selectedImage.fileName.split('.').pop() || 'jpg';
      const file = new File([blob], `result-${selectedImage.id}.${ext}`, { type: blob.type });
      const result = await api.uploadFile(file, false);
      // Navigate to the selected tool with prefill
      navigate(`/tools/${toolId}/run`, {
        state: {
          prefillImage: {
            fileName: result.fileName,
            previewUrl: `/api/gallery/files/${selectedImage.id}`,
          },
        },
      });
    } catch {
      // error handling is inline
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
              onClick={() => setSelectedImage({
                id: item.id,
                fileName: item.fileName,
                toolName: item.toolName,
                createdAt: item.createdAt,
                prompt: item.prompt,
              })}
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
                src={`/api/gallery/files/${item.id}`}
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
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {new Date(item.createdAt).toLocaleDateString()} — {new Date(item.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="overlay" onClick={() => setSelectedImage(null)}>
          <div
            style={{
              maxWidth: '95vw', maxHeight: '92vh',
              display: 'flex', flexDirection: 'column' as const,
              gap: 12,
              animation: 'fadeInScale 0.2s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedImage(null)} className="btn-ghost"
                style={{ color: '#fff', fontSize: '1.5rem', padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            {/* Image + info side by side */}
            <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
              {/* Image */}
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                <img
                  src={`/api/gallery/files/${selectedImage.id}`}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' as const, borderRadius: 'var(--radius-lg)' }}
                />
              </div>

              {/* Info panel */}
              <div className="glass-panel" style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 260, maxWidth: 360 }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{selectedImage.toolName}</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {new Date(selectedImage.createdAt).toLocaleString()}
                </p>

                {selectedImage.prompt ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    {selectedImage.prompt}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    Prompt no disponible
                  </p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setToolPickerOpen(true)} className="btn-primary" style={{ flex: 1 }}>
                    Edit with another tool...
                  </button>
                  <a
                    href={`/api/gallery/files/${selectedImage.id}?dl=1`}
                    download={`${selectedImage.toolName}-result`}
                    className="btn-primary"
                    style={{ display: 'inline-block', padding: '8px 16px', textDecoration: 'none', textAlign: 'center' }}
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
