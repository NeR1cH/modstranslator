'use client';

import { TranslationFile } from '@/types';

interface FileQueueProps {
  files: TranslationFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

// ============================================================
// BLOCK: Status display config
// ============================================================
const STATUS = {
  pending:     { icon: '○', label: 'ОЖИДАНИЕ',   cls: 'text-green-700' },
  extracting:  { icon: '◌', label: 'ЧТЕНИЕ...',  cls: 'text-yellow-600 animate-pulse' },
  translating: { icon: '◉', label: 'ПЕРЕВОД...', cls: 'text-yellow-400 animate-pulse' },
  packing:     { icon: '◈', label: 'УПАКОВКА...', cls: 'text-cyan-400 animate-pulse' },
  done:        { icon: '●', label: 'ГОТОВО',      cls: 'text-green-400' },
  error:       { icon: '✕', label: 'ОШИБКА',      cls: 'text-red-500' },
} as const;

const FORMAT_BADGE: Record<string, string> = {
  jar:  'bg-green-950 text-green-400 border border-green-700',
  json: 'bg-green-950 text-green-600 border border-green-900',
  lang: 'bg-green-950 text-green-600 border border-green-900',
  xml:  'bg-green-950 text-green-600 border border-green-900',
};

function fmtSize(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

// ============================================================
// BLOCK: FileQueue Component
// ============================================================
export default function FileQueue({ files, onRemove, disabled }: FileQueueProps) {
  if (!files.length) {
    return (
      <div className="border border-green-950 p-6 text-center text-green-900 text-xs tracking-widest">
        ОЧЕРЕДЬ ПУСТА // ЗАГРУЗИТЕ ФАЙЛЫ
      </div>
    );
  }

  return (
    <div className="border border-green-900 divide-y divide-green-950 max-h-72 overflow-y-auto">
      {files.map(file => {
        const s = STATUS[file.status];
        return (
          <div
            key={file.id}
            className={`flex items-start gap-3 px-3 py-2 text-xs transition-colors
              ${file.status === 'translating' ? 'bg-green-900/10' : ''}
              ${file.status === 'done' ? 'bg-green-950/20' : ''}
              ${file.status === 'error' ? 'bg-red-950/20' : ''}
            `}
          >
            {/* Status icon */}
            <span className={`${s.cls} mt-0.5 w-4 flex-shrink-0 text-center font-bold`}>
              {s.icon}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs px-1 font-bold uppercase ${FORMAT_BADGE[file.format] ?? ''}`}
                >
                  {file.format}
                </span>
                <span className="text-green-300 truncate">{file.name}</span>
              </div>
              <div className="flex gap-3 mt-0.5 text-green-800 flex-wrap">
                <span>{fmtSize(file.size)}</span>
                {file.langFilesCount != null && (
                  <span>{file.langFilesCount} lang</span>
                )}
                <span>{file.stringsCount} строк</span>
                <span className={s.cls}>{s.label}</span>
              </div>
              {file.errorMessage && (
                <div className="text-red-600 mt-0.5 truncate">{file.errorMessage}</div>
              )}
            </div>

            {/* Remove */}
            {file.status !== 'translating' && file.status !== 'extracting' && (
              <button
                onClick={() => onRemove(file.id)}
                disabled={disabled}
                className="text-green-900 hover:text-red-500 transition-colors mt-0.5 flex-shrink-0 disabled:opacity-30"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
