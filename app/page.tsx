'use client';

import { useState, useCallback } from 'react';
import DropZone from '@/components/DropZone';
import FileQueue from '@/components/FileQueue';
import TerminalLog from '@/components/TerminalLog';
import ProgressBar from '@/components/ProgressBar';
import { TranslationFile, LogEntry, FileFormat } from '@/types';
import { QUEUE_LIMITS, ERROR_MESSAGES, formatBytes } from '@/lib/queueLimits';


const MAX_LOG_ENTRIES = 500;

function fileToBase64(file: File): Promise<string> {
  console.log('fileToBase64 called for:', file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = (reader.result as string).split(',')[1];
      console.log('fileToBase64 success, length:', result.length);
      resolve(result);
    };
    reader.onerror = (error) => {
      console.error('fileToBase64 error:', error);
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

function detectFormat(name: string): FileFormat | null {
  console.log('detectFormat called for:', name);
  const ext = name.split('.').pop()?.toLowerCase();
  console.log('extracted extension:', ext);
  const valid: FileFormat[] = ['jar','zip','json','lang','snbt','toml','cfg','xml','txt'];
  const result = valid.includes(ext as FileFormat) ? ext as FileFormat : null;
  console.log('detectFormat result:', result);
  return result;
}

const FORMAT_LABELS: Record<string, string> = {
  jar:  'МОД',
  zip:  'МОДПАК',
  json: 'JSON',
  lang: 'LANG',
  snbt: 'КВЕСТЫ',
  toml: 'КОНФИГ',
  cfg:  'КОНФИГ',
  xml:  'XML',
  txt:  'ТЕКСТ',
};

export default function Home() {
  const [files,      setFiles]      = useState<TranslationFile[]>([]);
  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [isRunning,  setIsRunning]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [currentFile,setCurrentFile]= useState('');
  const [results,    setResults]    = useState<Array<{ outputFileName: string; resultBase64: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour12: false }),
        message, type,
      };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES
        ? next.slice(next.length - MAX_LOG_ENTRIES)
        : next;
    });
  }, []);

  // ── File loading ────────────────────────────────────────────
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    console.log('=== handleFilesAdded START ===');
    console.log('newFiles:', newFiles);
    console.log('newFiles.length:', newFiles.length);

    // Check queue limits
    const currentQueueSize = files.length;
    const currentTotalSize = files.reduce((sum, f) => sum + f.size, 0);
    const newTotalSize = newFiles.reduce((sum, f) => sum + f.size, 0);

    console.log('Current queue size:', currentQueueSize);
    console.log('Current total size:', formatBytes(currentTotalSize));
    console.log('New files total size:', formatBytes(newTotalSize));

    // Check max files limit
    if (currentQueueSize + newFiles.length > QUEUE_LIMITS.MAX_FILES) {
      const msg = `${ERROR_MESSAGES.QUEUE_FULL}${QUEUE_LIMITS.MAX_FILES}. Текущих файлов: ${currentQueueSize}`;
      console.error(msg);
      addLog(`> ❌ ${msg}`, 'error');
      return;
    }

    // Check total size limit
    if (currentTotalSize + newTotalSize > QUEUE_LIMITS.MAX_TOTAL_SIZE) {
      const msg = `${ERROR_MESSAGES.QUEUE_SIZE_EXCEEDED}${formatBytes(QUEUE_LIMITS.MAX_TOTAL_SIZE)}. Текущий размер: ${formatBytes(currentTotalSize)}`;
      console.error(msg);
      addLog(`> ❌ ${msg}`, 'error');
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);

    for (let idx = 0; idx < newFiles.length; idx++) {
      const file = newFiles[idx];
      const fileNum = idx + 1;
      const totalFiles = newFiles.length;

      console.log(`\n--- Processing file ${fileNum}/${totalFiles} ---`);
      console.log('file.name:', file.name);
      console.log('file.size:', file.size);
      console.log('file.type:', file.type);

      setUploadProgress(`[${fileNum}/${totalFiles}] ${file.name}`);

      const format = detectFormat(file.name);
      console.log('detected format:', format);

      if (!format) {
        console.warn('SKIP: unsupported format');
        addLog(`> ПРОПУСК: ${file.name} - ${ERROR_MESSAGES.UNSUPPORTED_FORMAT}`, 'warning');
        setUploadPercent(Math.round((fileNum / totalFiles) * 100));
        continue;
      }

      // Validate file size
      if (file.size > QUEUE_LIMITS.MAX_FILE_SIZE) {
        console.error('ERROR: file too large');
        addLog(`> ОШИБКА: ${file.name} ${ERROR_MESSAGES.FILE_TOO_LARGE}${formatBytes(QUEUE_LIMITS.MAX_FILE_SIZE)}`, 'error');
        setUploadPercent(Math.round((fileNum / totalFiles) * 100));
        continue;
      }

      const id = `${Date.now()}-${Math.random()}`;
      console.log('generated id:', id);

      addLog(`════════════════════════════════════`, 'system');
      addLog(`> 📁 НОВЫЙ ФАЙЛ: ${file.name}`, 'system');
      addLog(`> 📊 РАЗМЕР: ${(file.size / 1024 / 1024).toFixed(2)} MB`, 'info');

      setFiles(prev => {
        const newFile = {
          id, name: file.name, size: file.size, format,
          status: 'extracting' as const, stringsCount: 0, originalBase64: '',
        };
        console.log('adding file to queue:', newFile);
        return [...prev, newFile];
      });

      const typeLabel = FORMAT_LABELS[format] ?? format.toUpperCase();

      try {
        console.log('STEP 1: Converting to base64...');
        addLog(`> 🔄 ШАГ 1/3: Конвертация в base64...`, 'info');
        const base64 = await fileToBase64(file);
        console.log('base64 length:', base64.length);

        console.log('STEP 2: Sending to server...');
        addLog(`> 🔄 ШАГ 2/3: Отправка на сервер...`, 'info');

        const requestBody = { base64, fileName: file.name };
        console.log('request body keys:', Object.keys(requestBody));
        console.log('fileName:', requestBody.fileName);

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        console.log('response status:', res.status);
        console.log('response ok:', res.ok);

        if (!res.ok) {
          const errData = await res.json() as { error: string };
          console.error('API error:', errData);
          throw new Error(errData.error || 'Ошибка анализа файла');
        }

        console.log('STEP 3: Processing result...');
        addLog(`> 🔄 ШАГ 3/3: Обработка результата...`, 'info');
        const stats = await res.json() as { stringsCount: number; langFilesCount?: number; mode?: string };
        console.log('stats received:', stats);

        setFiles(prev => prev.map(f => {
          if (f.id !== id) return f;
          const updated = {
            ...f, status: 'pending' as const, stringsCount: stats.stringsCount,
            langFilesCount: stats.langFilesCount, originalBase64: base64,
          };
          console.log('updating file status:', updated);
          return updated;
        }));

        const detail = format === 'zip' || format === 'jar'
          ? `[${stats.langFilesCount} файлов, ${stats.stringsCount} строк]`
          : `[${stats.stringsCount} строк]`;
        addLog(`> ✅ УСПЕШНО ЗАГРУЖЕН: ${file.name} ${detail}`, 'success');
        addLog(`════════════════════════════════════`, 'system');
        console.log('SUCCESS:', file.name);
      } catch (err) {
        console.error('ERROR processing file:', err);
        console.error('error stack:', err instanceof Error ? err.stack : 'no stack');
        setFiles(prev => prev.map(f => f.id !== id ? f : { ...f, status: 'error', errorMessage: String(err) }));
        addLog(`> ❌ ОШИБКА: ${file.name} — ${err}`, 'error');
        addLog(`════════════════════════════════════`, 'system');
      }

      const percent = Math.round((fileNum / totalFiles) * 100);
      console.log('upload percent:', percent);
      setUploadPercent(percent);
    }

    console.log('=== handleFilesAdded END ===');
    setIsUploading(false);
    setUploadProgress('');
    setUploadPercent(0);
  }, [addLog, files]);

  // ── Translation run ─────────────────────────────────────────
  const handleTranslate = useCallback(async () => {
    console.log('=== handleTranslate START ===');
    const pending = files.filter(f => f.status === 'pending');
    console.log('pending files:', pending);
    console.log('pending count:', pending.length);

    if (!pending.length) {
      console.warn('No pending files');
      addLog('> ОЧЕРЕДЬ ПУСТА', 'warning');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults([]);
    addLog('════════════════════════════════════', 'system');
    addLog(`> СТАРТ // ${pending.length} объект(ов) в очереди`, 'system');

    const newResults: typeof results = [];

    for (let i = 0; i < pending.length; i++) {
      const file = pending[i];
      console.log(`\n--- Translating file ${i+1}/${pending.length} ---`);
      console.log('file:', file);

      const typeLabel = FORMAT_LABELS[file.format] ?? file.format.toUpperCase();
      setCurrentFile(file.name);
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'translating' } : f));
      addLog(`> [${i+1}/${pending.length}] [${typeLabel}] ${file.name}`, 'info');

      if (file.format === 'zip') {
        console.log('MODPACK detected');
        addLog(`> МОДПАК: сканирование всех файлов...`, 'system');
      }

      try {
        console.log('Sending translate request...');
        console.log('base64 length:', file.originalBase64?.length || 0);

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: file.originalBase64, fileName: file.name }),
        });

        console.log('translate response status:', res.status);
        console.log('translate response ok:', res.ok);

        if (!res.ok) {
          const err = await res.json() as { error: string };
          console.error('translate API error:', err);
          throw new Error(err.error);
        }

        const data = await res.json() as {
          resultBase64: string; translatedCount: number;
          langFilesCount: number; outputFileName: string;
        };
        console.log('translate result:', {
          outputFileName: data.outputFileName,
          translatedCount: data.translatedCount,
          langFilesCount: data.langFilesCount,
          resultBase64Length: data.resultBase64?.length || 0
        });

        newResults.push({ outputFileName: data.outputFileName, resultBase64: data.resultBase64 });
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done' } : f));

        const countMsg = data.translatedCount > 0 ? `[${data.translatedCount} строк]` : '';
        addLog(`> ГОТОВО: ${file.name} ${countMsg}`, 'success');
        console.log('SUCCESS:', file.name);
      } catch (err) {
        console.error('ERROR translating file:', err);
        console.error('error stack:', err instanceof Error ? err.stack : 'no stack');
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', errorMessage: String(err) } : f));
        addLog(`> СБОЙ: ${file.name} — ${err}`, 'error');
      }

      const progressPercent = Math.round(((i + 1) / pending.length) * 100);
      console.log('progress:', progressPercent);
      setProgress(progressPercent);
    }

    console.log('=== handleTranslate END ===');
    console.log('newResults:', newResults);
    setResults(newResults);
    if (newResults.length > 0) addLog('> ГОТОВО. Нажмите [СКАЧАТЬ АРХИВ]', 'system');
    setIsRunning(false);
    setCurrentFile('');
    addLog('════════════════════════════════════', 'system');
  }, [files, addLog]);

  // ── Export ──────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    console.log('=== handleExport START ===');
    console.log('results:', results);
    console.log('results.length:', results.length);

    if (!results.length) {
      console.warn('No results to export');
      return;
    }

    addLog('> СОЗДАНИЕ АРХИВА...', 'system');
    console.log('Sending export request...');

    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: results }),
    });

    console.log('export response status:', res.status);
    console.log('export response ok:', res.ok);

    const blob = await res.blob();
    console.log('blob size:', blob.size);
    console.log('blob type:', blob.type);

    const url = URL.createObjectURL(blob);
    console.log('blob URL created:', url);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'translated_mods.zip';
    a.click();
    console.log('download triggered');

    URL.revokeObjectURL(url);
    console.log('blob URL revoked');

    addLog('> АРХИВ СКАЧАН', 'success');
    console.log('=== handleExport END ===');
  }, [results, addLog]);

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount    = files.filter(f => f.status === 'done').length;
  const totalSize    = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <main className="min-h-screen bg-black text-green-400 p-4 md:p-6 lg:p-8">
      <div className="fixed inset-0 pointer-events-none z-50 crt-overlay" />

      {/* Header */}
      <header className="mb-6 border-b-2 border-green-900 pb-4">
        <div className="flex items-baseline gap-3 mb-1 flex-wrap">
          <span className="text-green-900 text-sm select-none">░▒▓█</span>
          <h1 className="glitch text-2xl md:text-4xl font-bold tracking-widest uppercase" data-text="MOD_TRANSLATOR">
            MOD_TRANSLATOR
          </h1>
          <span className="text-green-900 text-sm select-none">█▓▒░</span>
        </div>
        <p className="text-xs text-green-800 tracking-widest mt-1">
          MINECRAFT FULL LOCALIZATION ENGINE v4.0 // DeepL API // EN→RU
        </p>
        <p className="text-xs text-green-900 tracking-wider mt-0.5">
          ПОДДЕРЖКА: .jar .zip(модпак) .snbt(квесты) .toml .cfg .json .lang .xml .txt
        </p>
        <div className="flex gap-6 mt-3 text-xs font-bold flex-wrap">
          <span>СТАТУС: <span className={isRunning ? 'text-yellow-400 animate-pulse' : 'text-green-400'}>
            {isRunning ? `► ${currentFile}` : 'ОЖИДАНИЕ'}
          </span></span>
          <span>ФАЙЛОВ: <span className={files.length >= QUEUE_LIMITS.MAX_FILES ? 'text-red-400' : 'text-green-300'}>
            {files.length}/{QUEUE_LIMITS.MAX_FILES}
          </span></span>
          <span>РАЗМЕР: <span className={totalSize >= QUEUE_LIMITS.MAX_TOTAL_SIZE ? 'text-red-400' : 'text-green-300'}>
            {formatBytes(totalSize)}/{formatBytes(QUEUE_LIMITS.MAX_TOTAL_SIZE)}
          </span></span>
          <span>ГОТОВО: <span className="text-green-300">{doneCount}</span></span>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-5">
          <div>
            <div className="section-label">// 01. ЗАГРУЗКА — МОДЫ, МОДПАКИ, КВЕСТЫ, КОНФИГИ</div>
            <DropZone onFilesAdded={handleFilesAdded} disabled={isRunning || isUploading} />

            {/* Upload progress indicator */}
            {isUploading && (
              <div className="mt-3 space-y-2">
                <div className="border-2 border-yellow-500 bg-yellow-900/20 p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-yellow-400 text-xl animate-spin">◐</span>
                    <div className="flex-1">
                      <div className="text-yellow-400 font-bold text-sm tracking-wider">
                        ⏳ ЗАГРУЗКА И АНАЛИЗ...
                      </div>
                      <div className="text-yellow-600 text-xs mt-1">
                        {uploadProgress || 'Обработка файла...'}
                      </div>
                    </div>
                  </div>
                  <ProgressBar value={uploadPercent} />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="section-label">// 02. ОЧЕРЕДЬ [{files.length}]</div>
            <FileQueue files={files} onRemove={id => setFiles(p => p.filter(f => f.id !== id))} disabled={isRunning} />
          </div>

          <div className="space-y-3">
            <div className="section-label">// 03. УПРАВЛЕНИЕ</div>
            <button
              onClick={handleTranslate}
              disabled={isRunning || pendingCount === 0 || isUploading}
              className="w-full py-3 border-2 border-green-500 text-green-400 font-bold tracking-widest uppercase text-sm
                         hover:bg-green-500 hover:text-black transition-colors duration-100
                         disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isRunning ? `▶ ПЕРЕВОД... [${progress}%]` : `▶ ЗАПУСТИТЬ ПЕРЕВОД [${pendingCount} ОБЪ.]`}
            </button>

            {results.length > 0 && !isRunning && (
              <button
                onClick={handleExport}
                className="w-full py-3 border-2 border-green-300 text-green-300 font-bold tracking-widest uppercase text-sm
                           hover:bg-green-300 hover:text-black transition-colors duration-100 active:scale-[0.98] animate-pulse"
              >
                ▼ СКАЧАТЬ АРХИВ [{results.length} ФАЙЛ(ОВ)]
              </button>
            )}
          </div>

          {(isRunning || progress > 0) && (
            <div>
              <div className="section-label">// 04. ПРОГРЕСС</div>
              <ProgressBar value={progress} label="TRANSLATION" />
            </div>
          )}
        </div>

        {/* Right */}
        <div>
          <div className="section-label">// СИСТЕМНЫЙ ЛОГ</div>
          <TerminalLog logs={logs} />
        </div>
      </div>

      <footer className="mt-8 border-t border-green-950 pt-3 flex flex-wrap justify-between text-xs text-green-900">
        <span>МОДЫ • МОДПАКИ • КВЕСТЫ • ДИАЛОГИ • HUD • КАТСЦЕНЫ • КОНФИГИ</span>
        <span>DEEPL API // EN→RU // MAX 1000MB</span>
      </footer>
    </main>
  );
}


