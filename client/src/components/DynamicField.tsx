import { useRef, useState } from 'react';
import type { RhNodeField, FieldType } from '@shared/types';

interface FieldProps {
  field: RhNodeField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function TextField({ field, value, onChange }: FieldProps) {
  const isLong = (field.description?.length ?? 0) > 80;
  return isLong ? (
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

function SelectField({ field, value, onChange }: FieldProps) {
  let options: string[] = [];
  try {
    options = JSON.parse(field.fieldData || '[]');
  } catch {
    options = [];
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
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

function ImageField({ field, value, onChange }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onChange(file.name);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileRef}
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
        Choose Image
      </button>
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{ maxWidth: 200, maxHeight: 200, marginTop: 8, borderRadius: 'var(--radius)' }}
        />
      )}
      {value && !preview && <span style={{ marginLeft: 8 }}>{value}</span>}
    </div>
  );
}

function AudioField({ field, value, onChange }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onChange(file.name);
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
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
        Choose Audio
      </button>
      {preview && <audio src={preview} controls style={{ marginTop: 8, width: '100%' }} />}
    </div>
  );
}

function VideoField({ field, value, onChange }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onChange(file.name);
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
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
        Choose Video
      </button>
      {preview && <video src={preview} controls style={{ marginTop: 8, maxWidth: '100%', maxHeight: 300 }} />}
    </div>
  );
}

function FileField({ field, value, onChange }: FieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file.name);
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
      <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
        Choose File
      </button>
      {value && <span style={{ marginLeft: 8 }}>{value}</span>}
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
  error?: string;
}

export default function DynamicField(props: DynamicFieldProps) {
  const Comp = FIELD_MAP[props.field.fieldType ?? 'STRING'];
  return <Comp {...props} />;
}
