import { useEffect, useRef, useState } from 'react';
import type { RhNodeField, FieldType } from '@shared/types';
import ImageCropModal from './ImageCropModal';
import PromptPickerModal from './PromptPickerModal';
import EnhanceButton, { type EnhanceResult } from './EnhanceButton';
import EnhancePreview from './EnhancePreview';
import { api } from '../api/client';

interface FieldProps {
  field: RhNodeField;
  value: string;
  onChange: (value: string) => void;
  onUpload?: (file: File) => Promise<string>;
  error?: string;
  previewUrl?: string;
  // Optional: for AI enhance integration
  toolId?: number;
  toolName?: string;
  imageUrls?: string[];
  onSaveEnhancedToLibrary?: (result: EnhanceResult) => void;
}

function TextField({ field, value, onChange, toolId, toolName, imageUrls, onSaveEnhancedToLibrary }: FieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceResult | null>(null);
  const [prevValue, setPrevValue] = useState(value);
  const [enhanceError, setEnhanceError] = useState('');

  // Clear enhance result if user types something new
  if (value !== prevValue && enhanceResult) {
    setPrevValue(value);
    setEnhanceResult(null);
  }

  // Detect if this is a likely prompt field
  const isPromptField = /prompt|instruction|text/i.test(field.fieldName + ' ' + (field.description || ''));

  let isMultiline = false;
  try {
    if (field.fieldData) {
      const parsed = JSON.parse(field.fieldData);
      if (Array.isArray(parsed) && parsed[1]?.multiline) {
        isMultiline = true;
      }
    }
  } catch {
    // ignore parse errors
  }

  const handlePromptSelect = (content: string) => {
    onChange(content);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {isMultiline ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.description || field.fieldName}
              rows={3}
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.description || field.fieldName}
            />
          )}
        </div>
        {value && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onChange('')}
            style={{ padding: '8px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap', marginTop: isMultiline ? 0 : 1, color: 'var(--text-muted)' }}
            title="Clear field"
          >
            ✕
          </button>
        )}
        {isPromptField && (
          <EnhanceButton
            text={value}
            fieldName={field.fieldName}
            toolId={toolId}
            toolName={toolName}
            imageUrls={imageUrls}
            onResult={(r) => { setEnhanceResult(r); setPrevValue(value); setEnhanceError(''); }}
            onError={setEnhanceError}
          />
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setPickerOpen(true)}
          style={{ padding: '8px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap', marginTop: isMultiline ? 0 : 1 }}
          title="Use saved prompt"
        >
          Saved
        </button>
      </div>
      {enhanceError && !enhanceResult && (
        <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--error)' }} role="alert">
          {enhanceError}
        </div>
      )}
      {enhanceResult && (
        <EnhancePreview
          result={enhanceResult}
          originalText={prevValue}
          onUse={(newText) => { onChange(newText); setEnhanceResult(null); setPrevValue(newText); }}
          onSaveToLibrary={(r) => { onSaveEnhancedToLibrary?.(r); setEnhanceResult(null); }}
          onDismiss={() => setEnhanceResult(null)}
          onRevert={() => { onChange(prevValue); setEnhanceResult(null); }}
        />
      )}
      <PromptPickerModal
        open={pickerOpen}
        onSelect={handlePromptSelect}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

function NumberField({ field, value, onChange }: FieldProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.description || field.fieldName}
    />
  );
}

interface ListOption {
  name?: string;
  index?: string;
  description?: string;
  default?: string;
}

function SelectField({ field, value, onChange }: FieldProps) {
  let options: ListOption[] = [];
  try {
    const parsed = JSON.parse(field.fieldData || '[]');
    // RH format: [string[], {default?: string}] — extract options from the inner array
    if (Array.isArray(parsed) && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'string') {
      options = parsed[0].map((s: string) => ({ name: s, index: s }));
    } else if (Array.isArray(parsed) && typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) {
      options = parsed;
    } else if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      options = parsed.map((s: string) => ({ name: s, index: s }));
    }
  } catch {
    options = [];
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.index || opt.name} value={opt.index || opt.name || ''}>
          {opt.name || opt.index || ''}
        </option>
      ))}
    </select>
  );
}

function SwitchField({ field, value, onChange }: FieldProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={value === 'true'}
        onChange={(e) => onChange(String(e.target.checked))}
      />
      {field.description || field.fieldName}
    </label>
  );
}

function LoraField({ field, value, onChange }: FieldProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. sd-model-lora-name"
    />
  );
}

function ImageField({ field, value, onChange, onUpload, previewUrl }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // When a previewUrl is provided (e.g. from uploads gallery pick), show it
  useEffect(() => {
    if (previewUrl) {
      setPreview(previewUrl);
    }
  }, [previewUrl]);

  // Crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState('');

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setCropModalOpen(true);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleCropComplete = async (blob: Blob, fileName: string) => {
    setCropModalOpen(false);
    setUploadError('');
    setUploading(true);
    try {
      setPreview(URL.createObjectURL(blob));
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      if (onUpload) {
        const result = await onUpload(file);
        onChange(result);
      } else {
        onChange(fileName);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />
        <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Choose Image'}
        </button>
      </div>
      {uploadError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>{uploadError}</div>}
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{ maxWidth: 200, maxHeight: 200, marginTop: 8, borderRadius: 'var(--radius)' }}
        />
      )}
      {value && !preview && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{value}</span>}

      {cropImageUrl && (
        <ImageCropModal
          open={cropModalOpen}
          imageUrl={cropImageUrl}
          originalName="image.jpg"
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

function AudioField({ field, value, onChange, onUpload }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setUploadError('');
    try {
      if (onUpload) {
        const fileName = await onUpload(file);
        onChange(fileName);
      } else {
        onChange(file.name);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileRef}
        accept="audio/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Choose Audio'}
      </button>
      {uploadError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>{uploadError}</div>}
      {preview && <audio src={preview} controls style={{ marginTop: 8, width: '100%' }} />}
      {value && !preview && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{value}</span>}
    </div>
  );
}

function VideoField({ field, value, onChange, onUpload }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setUploadError('');
    try {
      if (onUpload) {
        const fileName = await onUpload(file);
        onChange(fileName);
      } else {
        onChange(file.name);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileRef}
        accept="video/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Choose Video'}
      </button>
      {uploadError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>{uploadError}</div>}
      {preview && <video src={preview} controls style={{ marginTop: 8, maxWidth: '100%', maxHeight: 300 }} />}
      {value && !preview && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{value}</span>}
    </div>
  );
}

function FileField({ field, value, onChange, onUpload }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      if (onUpload) {
        const fileName = await onUpload(file);
        onChange(fileName);
      } else {
        onChange(file.name);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileRef}
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Choose File'}
      </button>
      {uploadError && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>{uploadError}</div>}
      {value && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{value}</span>}
    </div>
  );
}

const FIELD_MAP: Record<FieldType, React.ComponentType<FieldProps>> = {
  IMAGE: ImageField,
  AUDIO: AudioField,
  VIDEO: VideoField,
  FILE: FileField,
  STRING: TextField,
  LIST: SelectField,
  SWITCH: SwitchField,
  LORA: LoraField,
  INT: NumberField,
};

interface DynamicFieldProps {
  field: RhNodeField;
  value: string;
  onChange: (value: string) => void;
  onUpload?: (file: File) => Promise<string>;
  error?: string;
  previewUrl?: string;
  // AI enhance integration
  toolId?: number;
  toolName?: string;
  imageUrls?: string[];
  onSaveEnhancedToLibrary?: (result: import('./EnhanceButton').EnhanceResult) => void;
}

export default function DynamicField(props: DynamicFieldProps) {
  const Comp = FIELD_MAP[props.field.fieldType ?? 'STRING'];
  return <Comp {...props} />;
}
