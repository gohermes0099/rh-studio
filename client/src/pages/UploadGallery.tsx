import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import ImageCropModal from '../components/ImageCropModal';
import ToolPickerModal from '../components/ToolPickerModal';
import type { UploadItem } from '@shared/types';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export default function UploadGallery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'browse';
  const returnTo = searchParams.get('returnTo');

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Lightbox
  const [selectedUpload, setSelectedUpload] = useState<UploadItem | null>(null);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Upload + crop
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropOriginalName, setCropOriginalName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Tool picker (for "Use with webapp")
  const [toolPickerOpen, setToolPickerOpen] = useState(false);

  const fetchUploads = () => {
    setLoading(true);
    api.listUploads()
      .then((res) => setUploads(res.uploads))
      .catch(() => setUploads([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  // --- Filter ---
  const filtered = uploads.filter((u) =>
    u.originalName.toLowerCase().includes(search.toLowerCase()),
  );

  // --- Upload flow ---
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropOriginalName(file.name);
    setCropModalOpen(true);
    // Reset file input so same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = async (blob: Blob, fileName: string) => {
    setCropModalOpen(false);
    setUploading(true);
    try {
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      await api.uploadFile(file);
      fetchUploads();
    } catch {
      // error shown inline is optional
    } finally {
      setUploading(false);
      URL.revokeObjectURL(cropImageUrl);
      setCropImageUrl('');
    }
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl('');
  };

  // --- Pick mode ---
  const handlePick = (upload: UploadItem) => {
    if (mode !== 'pick') return;
    if (returnTo) {
      const prefillFileName = upload.rhFileName || upload.fileName;
      navigate(returnTo, {
        state: {
          prefillImage: {
            fileName: prefillFileName,
            uploadId: upload.id,
            previewUrl: `/api/uploads/${upload.id}/file`,
          },
        },
      });
    }
  };

  // --- Use with webapp ---
  const handleUseWithWebapp = () => {
    setToolPickerOpen(true);
  };

  const handleToolSelected = async (toolId: number) => {
    setToolPickerOpen(false);
    const upload = selectedUpload;
    if (!upload) return;
    const prefillFileName = upload.rhFileName || upload.fileName;
    navigate(`/tools/${toolId}/run`, {
      state: {
        prefillImage: {
          fileName: prefillFileName,
          uploadId: upload.id,
          previewUrl: `/api/uploads/${upload.id}/file`,
        },
      },
    });
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (deleteConfirm === null) return;
    try {
      await api.deleteUpload(deleteConfirm);
      setUploads((prev) => prev.filter((u) => u.id !== deleteConfirm));
      if (selectedUpload?.id === deleteConfirm) setSelectedUpload(null);
    } catch {
      // ignore
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>
          {mode === 'pick' ? 'Select an Uploaded Image' : 'Uploads'}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {mode === 'pick' && (
            <button
              onClick={() => navigate(-1)}
              className="btn-primary"
              style={{ background: 'var(--bg)' }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : '↑ Upload Image'}
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*,audio/*"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      <input
        type="text"
        placeholder="Search files..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 24, maxWidth: 400 }}
      />

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          {uploads.length === 0
            ? 'No uploads yet. Upload an image to get started.'
            : 'No files match your search.'}
        </p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {filtered.map((upload) => (
            <div
              key={upload.id}
              className="card"
              style={{
                cursor: mode === 'pick' ? 'pointer' : 'pointer',
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
                border: mode === 'pick' ? '2px solid transparent' : undefined,
                transition: 'border-color 0.2s, transform 0.15s',
              }}
              onClick={() => {
                if (mode === 'pick') {
                  handlePick(upload);
                } else {
                  setSelectedUpload(upload);
                }
              }}
              onMouseEnter={(e) => {
                if (mode !== 'pick') {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Thumbnail */}
              {isImage(upload.mimeType) ? (
                <img
                  src={`/api/uploads/${upload.id}/file`}
                  alt={upload.originalName}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 180,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 180,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg)',
                    color: 'var(--text-muted)',
                    fontSize: '2rem',
                  }}
                >
                  {upload.mimeType.startsWith('video/') ? '🎬' : '🎵'}
                </div>
              )}

              {/* Info */}
              <div style={{ padding: '10px 14px' }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 2,
                  }}
                  title={upload.originalName}
                >
                  {upload.originalName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatSize(upload.fileSize)} · {new Date(upload.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Delete button (hidden in pick mode) */}
              {mode !== 'pick' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(upload.id);
                  }}
                  className="btn-danger"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    zIndex: 1,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  // Keep visible on the button itself
                  onFocus={(e) => e.currentTarget.style.opacity = '1'}
                  onBlur={(e) => e.currentTarget.style.opacity = '0'}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedUpload && mode !== 'pick' && (
        <div className="overlay" onClick={() => setSelectedUpload(null)}>
          <div
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column' as const,
              gap: 16,
              animation: 'fadeInScale 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedUpload(null)} className="btn-ghost"
                style={{ color: '#fff', fontSize: '1.5rem', padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            {isImage(selectedUpload.mimeType) ? (
              <img
                src={`/api/uploads/${selectedUpload.id}/file`}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' as const, borderRadius: 'var(--radius-lg)' }}
              />
            ) : selectedUpload.mimeType.startsWith('video/') ? (
              <video
                src={`/api/uploads/${selectedUpload.id}/file`}
                controls
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-lg)' }}
              />
            ) : (
              <audio
                src={`/api/uploads/${selectedUpload.id}/file`}
                controls
                style={{ width: '100%' }}
              />
            )}

            <div className="glass-panel" style={{ padding: 20 }}>
              <h2 style={{ margin: 0, marginBottom: 4, fontSize: '1.1rem', fontWeight: 600 }}>{selectedUpload.originalName}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                {formatSize(selectedUpload.fileSize)} · {new Date(selectedUpload.createdAt).toLocaleString()}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={handleUseWithWebapp}
                  className="btn-primary"
                >
                  Use with webapp
                </button>
                <a
                  href={`/api/uploads/${selectedUpload.id}/file?dl=1`}
                  download={selectedUpload.originalName}
                  className="btn-primary"
                  style={{ display: 'inline-block', padding: '8px 16px', textDecoration: 'none' }}
                >
                  Download
                </a>
                <button
                  onClick={() => { setDeleteConfirm(selectedUpload.id); setSelectedUpload(null); }}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {cropImageUrl && (
        <ImageCropModal
          open={cropModalOpen}
          imageUrl={cropImageUrl}
          originalName={cropOriginalName}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Tool picker modal */}
      <ToolPickerModal
        open={toolPickerOpen}
        onSelect={handleToolSelected}
        onCancel={() => setToolPickerOpen(false)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Upload"
        message="Are you sure you want to delete this file? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        danger
      />
    </div>
  );
}
