'use client';

import { useState, useCallback } from 'react';
import DropZone from '@/components/DropZone';
import FileQueue from '@/components/FileQueue';
import TerminalLog from '@/components/TerminalLog';
import ProgressBar from '@/components/ProgressBar';
import { TranslationFile, LogEntry, FileFormat } from '@/types';

// ============================================================
// BLOCK: Helpers
// ============================================================
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function detectFormat(name: string): FileFormat | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jar' || ext === 'json' || ext === 'lang' || ext === 'xml') return ext as FileFormat;
  return null;
}

// ============================================================
// BLOCK: Main App Component
// ============================================================
export default function Home() {
  const [files, setFiles] = useState<TranslationFile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');

  // Results accumulated during translation run for final export
  const [results, setResults] = useState<Array<{ outputFileName: string; resultBase64: string }>>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour12: false }),
      message,
      type,
    }]);
  }, []);

  // ============================================================
  // BLOCK: File loading & analysis
  // ============================================================
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    for (const file of newFiles) {
      const format = detectFormat(file.name);
      if (!format) {
        addLog(`> ПРОПУСК: ${file.name} — неподдерживаемый формат`, 'warning');
        continue;
      }

      const id = `${Date.now()}-${Math.random()}`;
      const placeholder: TranslationFile = {
        id, name: file.name, size: file.size, format,
        status: 'extracting', stringsCount: 0, originalBase64: '',
      };
      setFiles(prev => [...prev, placeholder]);
      addLog(`> АНАЛИЗ: ${file.name}`, 'system');

      try {
        const base64 = await fileToBase64(file);
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, fileName: file.name }),
        });
        const stats = await res.json() as { stringsCount: number; langFilesCount?: number };

        setFiles(prev => prev.map(f => f.id !== id ? f : {
          ...f,
          status: 'pending',
          stringsCount: stats.stringsCount,
          langFilesCount: stats.langFilesCount,
          originalBase64: base64,
        }));

        const label = format === 'jar'
          ? `[${stats.langFilesCount} lang файлов, ${stats.stringsCount} строк]`
          : `[${stats.stringsCount} строк]`;
        addLog(`> ГОТОВО: ${file.name} ${label}`, 'success');
      } catch (err) {
        setFiles(prev => prev.map(f => f.id !== id ? f : { ...f, status: 'error', errorMessage: String(err) }));
        addLog(`> ОШИБКА АНАЛИЗА: ${file.name}`, 'error');
      }
    }
  }, [addLog]);

  // ============================================================
  // BLOCK: Translation run
  // ============================================================
  const handleTranslate = useCallback(async () => {
    const pending = files.filter(f => f.status === 'pending');
    if (!pending.length) { addLog('> ОЧЕРЕДЬ ПУСТА', 'warning'); return; }

    setIsRunning(true);
    setProgress(0);
    setResults([]);
    addLog('════════════════════════════════', 'system');
    addLog(`> ЗАПУСК // ${pending.length} файл(ов) в очереди`, 'system');

    const newResults: typeof results = [];

    for (let i = 0; i < pending.length; i++) {
      const file = pending[i];
      setCurrentFile(file.name);
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'translating' } : f));
      addLog(`> [${i + 1}/${pending.length}] ${file.name}`, 'info');

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: file.originalBase64, fileName: file.name }),
        });

        if (!res.ok) {
          const err = await res.json() as { error: string };
          throw new Error(err.error);
        }

        const data = await res.json() as {
          resultBase64: string;
          translatedCount: number;
          langFilesCount: number;
          outputFileName: string;
        };

        newResults.push({ outputFileName: data.outputFileName, resultBase64: data.resultBase64 });
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done' } : f));
        addLog(`> ОК: ${file.name} [${data.translatedCount} строк переведено]`, 'success');
      } catch (err) {
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', errorMessage: String(err) } : f));
        addLog(`> СБОЙ: ${file.name} — ${err}`, 'error');
      }

      setProgress(Math.round(((i + 1) / pending.length) * 100));
    }

    setResults(newResults);

    if (newResults.length > 0) {
      addLog('> ГОТОВО. Нажмите [СКАЧАТЬ АРХИВ] ↓', 'system');
    }

    setIsRunning(false);
    setCurrentFile('');
    addLog('════════════════════════════════', 'system');
  }, [files, addLog]);

  // ============================================================
  // BLOCK: Export ZIP
  // ============================================================
  const handleExport = useCallback(async () => {
    if (!results.length) return;
    addLog('> ГЕНЕРАЦИЯ АРХИВА...', 'system');
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: results }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'translated_mods.zip'; a.click();
      URL.revokeObjectURL(url);
      addLog('> АРХИВ СКАЧАН', 'success');
    } catch (err) {
      addLog(`> ОШИБКА ЭКСПОРТА: ${err}`, 'error');
    }
  }, [results, addLog]);

  const handleRemove = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount    = files.filter(f => f.status === 'done').length;

  return (
    <main className="min-h-screen bg-black text-green-400 p-4 md:p-6 lg:p-8">
      {/* CRT overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 crt-overlay" />

      {/* ── Header ── */}
      <header className="mb-6 border-b-2 border-green-900 pb-4">
        <div className="flex items-baseline gap-3 mb-1 flex-wrap">
          <span className="text-green-900 text-sm select-none">░▒▓█</span>
          <h1
            className="glitch text-2xl md:text-4xl font-bold tracking-widest uppercase"
            data-text="MOD_TRANSLATOR"
          >
            MOD_TRANSLATOR
          </h1>
          <span className="text-green-900 text-sm select-none">█▓▒░</span>
        </div>
        <p className="text-xs text-green-800 tracking-widest mt-1">
          MINECRAFT LOCALIZATION ENGINE v3.0 // DeepL API // EN→RU // .JAR .JSON .LANG
        </p>
        <div className="flex gap-6 mt-3 text-xs font-bold">
          <span>СТАТУС: <span className={isRunning ? 'text-yellow-400 animate-pulse' : 'text-green-400'}>
            {isRunning ? `ОБРАБОТКА: ${currentFile}` : 'ОЖИДАНИЕ'}
          </span></span>
          <span>ФАЙЛОВ: <span className="text-green-300">{files.length}</span></span>
          <span>ГОТОВО: <span className="text-green-300">{doneCount}</span></span>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Drop zone */}
          <div>
            <div className="section-label">// 01. ЗАГРУЗКА ФАЙЛОВ</div>
            <DropZone onFilesAdded={handleFilesAdded} disabled={isRunning} />
          </div>

          {/* File queue */}
          <div>
            <div className="section-label">// 02. ОЧЕРЕДЬ ОБРАБОТКИ [{files.length}]</div>
            <FileQueue files={files} onRemove={handleRemove} disabled={isRunning} />
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <div className="section-label">// 03. УПРАВЛЕНИЕ</div>

            <button
              onClick={handleTranslate}
              disabled={isRunning || pendingCount === 0}
              className="w-full py-3 border-2 border-green-500 text-green-400 font-bold tracking-widest uppercase text-sm
                         hover:bg-green-500 hover:text-black transition-colors duration-100
                         disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isRunning
                ? `▶ ВЫПОЛНЯЕТСЯ... [${progress}%]`
                : `▶ ЗАПУСТИТЬ ПЕРЕВОД [${pendingCount} ФАЙЛ(ОВ)]`}
            </button>

            {results.length > 0 && !isRunning && (
              <button
                onClick={handleExport}
                className="w-full py-3 border-2 border-green-300 text-green-300 font-bold tracking-widest uppercase text-sm
                           hover:bg-green-300 hover:text-black transition-colors duration-100 active:scale-[0.98]
                           animate-pulse"
              >
                ▼ СКАЧАТЬ АРХИВ [{results.length} ФАЙЛ(ОВ)]
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(isRunning || progress > 0) && (
            <div>
              <div className="section-label">// 04. ПРОГРЕСС</div>
              <ProgressBar value={progress} />
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Terminal ── */}
        <div>
          <div className="section-label">// СИСТЕМНЫЙ ЛОГ</div>
          <TerminalLog logs={logs} />
        </div>
      </div>

      <footer className="mt-8 border-t border-green-950 pt-3 flex flex-wrap justify-between text-xs text-green-900">
        <span>ФОРМАТЫ: .jar (1.13+ / pre-1.13) .json .lang</span>
        <span>DEEPL API // TARGET: RU // MAX: 200MB</span>
      </footer>
    </main>
  );
}
