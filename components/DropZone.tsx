'use client';

import { useCallback, useState } from 'react';

interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTS = ['.jar', '.json', '.lang', '.xml'];
const ACCEPTED_MIME = [
  'application/java-archive',
  'application/json',
  'text/plain',
  'application/xml',
  'text/xml',
];

// ============================================================
// BLOCK: DropZone Component
// Supports drag-and-drop and click-to-select
// Accepts .jar, .json, .lang, .xml
// ============================================================
export default function DropZone({ onFilesAdded, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const filterFiles = (list: FileList | null): File[] => {
    if (!list) return [];
    return Array.from(list).filter(f =>
      ACCEPTED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext))
    );
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const valid = filterFiles(e.dataTransfer.files);
    if (valid.length) onFilesAdded(valid);
  }, [disabled, onFilesAdded]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  return (
    <label
      className={`
        relative flex flex-col items-center justify-center gap-2
        border-2 h-40 transition-all duration-100 select-none
        ${disabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}
        ${isDragging
          ? 'border-green-400 bg-green-400/10 shadow-[0_0_30px_rgba(0,255,0,0.2)]'
          : 'border-green-900 hover:border-green-700 hover:bg-green-950/30'
        }
      `}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setIsDragging(false)}
    >
      <input
        type="file"
        multiple
        accept={ACCEPTED_EXTS.join(',')}
        className="hidden"
        disabled={disabled}
        onChange={e => {
          const valid = filterFiles(e.target.files);
          if (valid.length) onFilesAdded(valid);
          e.target.value = '';
        }}
      />

      <div className="text-green-700 text-4xl pointer-events-none">
        {isDragging ? '▼' : '▲'}
      </div>
      <p className="text-green-400 text-xs tracking-widest pointer-events-none">
        {isDragging ? 'ОТПУСТИТЕ ДЛЯ ЗАГРУЗКИ' : 'ПЕРЕТАЩИТЕ ФАЙЛЫ СЮДА'}
      </p>
      <p className="text-green-900 text-xs tracking-wider pointer-events-none">
        {ACCEPTED_EXTS.join('  ')}
      </p>

      {/* Corner marks */}
      {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, i) => (
        <span key={i} className={`absolute ${pos} text-green-900 text-xs pointer-events-none`}>
          {['┌','┐','└','┘'][i]}
        </span>
      ))}
    </label>
  );
}
