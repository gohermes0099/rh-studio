import { useState, useCallback } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';

const RATIOS = [
  { label: '1:1', value: 1 / 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
  { label: '5:4', value: 5 / 4 },
  { label: '4:5', value: 4 / 5 },
  { label: '21:9', value: 21 / 9 },
] as const;

async function getCroppedBlob(
  imageUrl: string,
  pixelCrop: Area,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = Math.round(pixelCrop.width);
  canvas.height = Math.round(pixelCrop.height);

  ctx.drawImage(
    image,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    Math.round(pixelCrop.width),
    Math.round(pixelCrop.height),
    0,
    0,
    Math.round(pixelCrop.width),
    Math.round(pixelCrop.height),
  );

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/jpeg', 0.95);
  });
}

interface ImageCropModalProps {
  open: boolean;
  imageUrl: string;
  originalName: string;
  onCropComplete: (blob: Blob, fileName: string) => void;
  onCancel: () => void;
}

export default function ImageCropModal({
  open,
  imageUrl,
  originalName,
  onCropComplete,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(RATIOS[0].value);
  const [completedPixelCrop, setCompletedPixelCrop] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCompletedPixelCrop(croppedAreaPixels);
    },
    [],
  );

  const handleApply = async () => {
    if (!completedPixelCrop) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageUrl, completedPixelCrop);
      const ext = originalName.split('.').pop() || 'jpg';
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_${aspect.toString().replace('.', '_')}.${ext}`;
      onCropComplete(blob, fileName);
    } catch {
      // error handled by caller
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="overlay" style={{ zIndex: 2000 }}>
      <div
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: 820,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          animation: 'fadeInScale 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Crop Image</h2>
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{ padding: '4px 8px', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Cropper area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 400,
            background: '#000',
          }}
        >
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            style={{
              containerStyle: {
                width: '100%',
                height: '100%',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Ratio selector */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
              Aspect Ratio
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RATIOS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => {
                    setAspect(r.value);
                    setCrop({ x: 0, y: 0 });
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    background: aspect === r.value ? 'var(--primary-light)' : 'var(--bg)',
                    color: aspect === r.value ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${aspect === r.value ? 'var(--info)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontWeight: aspect === r.value ? 600 : 400,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom slider */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
              Zoom: {zoom.toFixed(1)}x
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button onClick={onCancel} className="btn-ghost">
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="btn-primary"
              disabled={processing || !completedPixelCrop}
            >
              {processing ? 'Processing...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
