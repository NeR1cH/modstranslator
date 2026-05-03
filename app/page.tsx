'use client';

import { useState, useCallback } from 'react';
import DropZone from '@/components/DropZone';
import FileQueue from '@/components/FileQueue';
import TerminalLog from '@/components/TerminalLog';
import ProgressBar from '@/components/ProgressBar';
import { UsageIndicator } from '@/components/UsageIndicator';
import { CacheIndicator } from '@/components/CacheIndicator';
import { HistoryPanel } from '@/components/HistoryPanel';
import { TranslationReportViewer } from '@/components/TranslationReportViewer';
import { TranslationFile, LogEntry, FileFormat } from '@/types';
import { QUEUE_LIMITS, ERROR_MESSAGES, formatBytes } from '@/lib/queueLimits';
import { getTranslationHistory } from '@/lib/translationHistory';
import { TranslationReport } from '@/lib/translationReport';


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
  const valid: FileFormat[] = ['jar','zip','json','lang','snbt'];
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
  properties: 'PROPERTIES',
  yaml: 'YAML',
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
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [translationReport, setTranslationReport] = useState<TranslationReport | null>(null);
  const [textReport, setTextReport] = useState<string | null>(null);
  const [htmlReportBase64, setHtmlReportBase64] = useState<string | null>(null);

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
      addLog(`> 📁 ${file.name}`, 'system');
      addLog(`> 📊 ${(file.size / 1024 / 1024).toFixed(2)} MB`, 'info');

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
        // Check if file is large (>800MB) - use streaming upload
        const useStreaming = file.size > 800 * 1024 * 1024 && (format === 'zip' || format === 'jar');

        if (useStreaming) {
          console.log('LARGE FILE: Using streaming upload');
          addLog(`> 🔄 Загрузка большого файла (streaming)...`, 'info');

          // Upload file using XMLHttpRequest to track progress
          const formData = new FormData();
          formData.append('file', file);

          const uploadData = await new Promise<{
            tempId: string;
            tempPath: string;
            fileName: string;
            fileSize: number;
          }>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                setUploadPercent(percentComplete);
                addLog(`> 📤 Загрузка: ${percentComplete}%`, 'info');
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status === 200) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  resolve(data);
                } catch (err) {
                  reject(new Error('Ошибка парсинга ответа'));
                }
              } else {
                try {
                  const errData = JSON.parse(xhr.responseText);
                  reject(new Error(errData.error || 'Ошибка загрузки файла'));
                } catch {
                  reject(new Error(`HTTP ${xhr.status}`));
                }
              }
            });

            xhr.addEventListener('error', () => {
              reject(new Error('Ошибка сети'));
            });

            xhr.addEventListener('abort', () => {
              reject(new Error('Загрузка отменена'));
            });

            xhr.open('POST', '/api/upload-stream');
            xhr.send(formData);
          });

          console.log('File uploaded to server:', uploadData);
          addLog(`> ✅ Файл загружен на сервер`, 'success');

          // Store temp info for translation
          setFiles(prev => prev.map(f => {
            if (f.id !== id) return f;
            return {
              ...f,
              status: 'pending' as const,
              stringsCount: 0, // Will be calculated during translation
              originalBase64: '', // Not used for streaming
              tempPath: uploadData.tempPath,
              tempId: uploadData.tempId,
            };
          }));

          addLog(`> ✅ Готов к переводу`, 'success');
        } else {
          // Small file - use existing base64 method
          console.log('STEP 1: Converting to base64...');
          addLog(`> 🔄 Конвертация...`, 'info');
          const base64 = await fileToBase64(file);
          console.log('base64 length:', base64.length);

          console.log('STEP 2: Sending to server...');
          addLog(`> 🔄 Анализ файла...`, 'info');

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
          addLog(`> 🔄 Обработка...`, 'info');
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
          addLog(`> ✅ ${file.name} ${detail}`, 'success');
        }

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

  // ── Translation run with streaming ─────────────────────────
  const handleTranslate = useCallback(async () => {
    console.log('=== handleTranslate START (STREAMING) ===');
    const pending = files.filter(f => f.status === 'pending');
    console.log('pending files:', pending);
    console.log('pending count:', pending.length);

    if (!pending.length) {
      console.warn('No pending files');
      addLog('> ОЧЕРЕДЬ ПУСТА', 'warning');
      return;
    }

    // Create AbortController for this translation session
    const controller = new AbortController();
    setAbortController(controller);

    setIsRunning(true);
    setProgress(0);
    setResults([]);
    addLog('════════════════════════════════════', 'system');
    addLog(`> СТАРТ ПЕРЕВОДА // ${pending.length} файл(ов)`, 'system');

    const newResults: typeof results = [];

    try {
      // Process each file individually
      for (let i = 0; i < pending.length; i++) {
        const file = pending[i];
        const current = i + 1;
        const total = pending.length;

        console.log(`[${current}/${total}] Processing:`, file.name);
        addLog(`> [${current}/${total}] ${file.name}`, 'info');

        setCurrentFile(file.name);
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: 'translating' } : f
        ));

        try {
          let resultBuffer: Buffer;
          let outputFileName: string;

          // Check if file was uploaded via streaming (has tempPath)
          if (file.tempPath) {
            console.log('Processing streaming-uploaded file:', file.tempPath);
            addLog(`> 🔄 Обработка большого файла...`, 'system');
            setProgress(10);

            // Call process-upload endpoint
            const res = await fetch('/api/process-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tempPath: file.tempPath,
                fileName: file.name,
                format: file.format,
              }),
              signal: controller.signal,
            });

            if (!res.ok) {
              const errText = await res.text();
              try {
                const errData = JSON.parse(errText);
                throw new Error(errData.error || 'Ошибка обработки файла');
              } catch {
                throw new Error(`HTTP ${res.status}: ${errText}`);
              }
            }

            const data = await res.json() as {
              success: boolean;
              resultId: string;
              outputFileName: string;
              fileSize: number;
            };

            addLog(`> ✅ Перевод завершён!`, 'success');
            addLog(`> 🔄 Скачивание результата...`, 'system');
            setProgress(90);

            // Download file from server
            const downloadUrl = `/api/download-result?id=${data.resultId}`;
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = data.outputFileName;
            a.click();

            addLog(`> ✅ Файл скачан: ${data.outputFileName}`, 'success');
            setProgress(100);

          } else {
            // Small file - use existing streaming API
            console.log('Processing base64 file');
            const filesPayload = [{
              id: file.id,
              fileName: file.name,
              base64: file.originalBase64,
            }];

            const res = await fetch('/api/translate-stream', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files: filesPayload }),
              signal: controller.signal,
            });

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }

            const reader = res.body?.getReader();
            if (!reader) {
              throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            // Read SSE stream
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                console.log('Stream finished');
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = JSON.parse(line.slice(6));
                console.log('[SSE]', data.type, data);

                if (data.type === 'file_complete') {
                  newResults.push({
                    outputFileName: data.outputFileName,
                    resultBase64: data.resultBase64,
                  });

                  // Save report data if available
                  if (data.report) {
                    setTranslationReport(data.report);
                  }
                  if (data.textReport) {
                    setTextReport(data.textReport);
                  }
                  if (data.htmlReportBase64) {
                    setHtmlReportBase64(data.htmlReportBase64);
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              }
            }
          }

          // Mark file as done
          setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'done' } : f
          ));

          addLog(`> ✅ ${file.name}`, 'success');

          const progressPercent = Math.round((current / total) * 100);
          setProgress(progressPercent);

        } catch (fileErr) {
          console.error('Error processing file:', fileErr);
          setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'error', errorMessage: String(fileErr) } : f
          ));
          addLog(`> ❌ ${file.name} — ${fileErr}`, 'error');
        }
      }

      addLog(`> Все файлы обработаны (${pending.length})`, 'success');

    } catch (err) {
      // Check if error is due to abort
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Translation aborted by user');
        addLog('> ⚠️ Перевод отменен', 'warning');
        setFiles(prev => prev.map(f =>
          f.status === 'translating' ? { ...f, status: 'pending' } : f
        ));
      } else {
        console.error('ERROR in streaming translation:', err);
        addLog(`> Ошибка: ${err}`, 'error');
      }
    } finally {
      console.log('=== handleTranslate END (STREAMING) ===');
      console.log('newResults:', newResults);
      setResults(newResults);
      if (newResults.length > 0) addLog('> Готово. Нажмите [СКАЧАТЬ ВСЕ]', 'system');
      setIsRunning(false);
      setCurrentFile('');
      setAbortController(null);
      addLog('════════════════════════════════════', 'system');
    }
  }, [files, addLog]);

  // ── Cancel translation ──────────────────────────────────────
  const handleCancelTranslation = useCallback(() => {
    if (abortController) {
      console.log('=== handleCancelTranslation ===');
      abortController.abort();
      addLog('> ⚠️ Отмена перевода...', 'warning');
    }
  }, [abortController, addLog]);

  // ── Export ──────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    console.log('=== handleExport START ===');
    console.log('results:', results);
    console.log('results.length:', results.length);

    if (!results.length) {
      console.warn('No results to export');
      return;
    }

    addLog('> Создание архива...', 'system');
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

    addLog('> Архив скачан', 'success');
    console.log('=== handleExport END ===');
  }, [results, addLog]);

  // ── Download single file ────────────────────────────────────
  const handleDownloadSingle = useCallback(async (file: { outputFileName: string; resultBase64: string }) => {
    console.log('=== handleDownloadSingle START ===');
    console.log('file:', file.outputFileName);

    try {
      const res = await fetch('/api/download-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });

      console.log('download-single response status:', res.status);

      if (!res.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await res.blob();
      console.log('blob size:', blob.size);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.outputFileName;
      a.click();

      URL.revokeObjectURL(url);
      console.log('=== handleDownloadSingle END ===');
    } catch (err) {
      console.error('Error downloading file:', err);
      addLog(`> Ошибка скачивания: ${file.outputFileName}`, 'error');
    }
  }, [addLog]);

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
          АВТОМАТИЧЕСКИЙ ПЕРЕВОДЧИК МОДОВ MINECRAFT // EN→RU
        </p>
        <p className="text-xs text-green-900 tracking-wider mt-0.5">
          ПОДДЕРЖКА: Моды (jar) • Модпаки (zip) • Квесты (snbt) • Конфиги (toml, cfg) • Языковые файлы (json, lang)
        </p>
        <div className="flex gap-6 mt-3 text-xs font-bold flex-wrap">
          <span>СТАТУС: <span className={isRunning ? 'text-yellow-400 animate-pulse' : 'text-green-400'}>
            {isRunning ? `► ${currentFile}` : 'Ожидание'}
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
          {/* Usage Indicator */}
          <UsageIndicator />

          {/* Cache Indicator */}
          <CacheIndicator />

          <div>
            <div className="section-label">// ЗАГРУЗКА ФАЙЛОВ</div>
            <DropZone onFilesAdded={handleFilesAdded} disabled={isRunning || isUploading} />

            {/* Upload progress indicator */}
            {isUploading && (
              <div className="mt-3 space-y-2">
                <div className="border-2 border-yellow-500 bg-yellow-900/20 p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-yellow-400 text-xl animate-spin">◐</span>
                    <div className="flex-1">
                      <div className="text-yellow-400 font-bold text-sm tracking-wider">
                        ⏳ Загрузка и анализ...
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
            <div className="section-label">// ОЧЕРЕДЬ [{files.length}]</div>
            <FileQueue files={files} onRemove={id => setFiles(p => p.filter(f => f.id !== id))} disabled={isRunning} />
          </div>

          <div className="space-y-3">
            <div className="section-label">// УПРАВЛЕНИЕ</div>
            <button
              onClick={handleTranslate}
              disabled={isRunning || pendingCount === 0 || isUploading}
              className="w-full py-3 border-2 border-green-500 text-green-400 font-bold tracking-widest uppercase text-sm
                         hover:bg-green-500 hover:text-black transition-colors duration-100
                         disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isRunning ? `▶ ПЕРЕВОД В ПРОЦЕССЕ... [${progress}%]` : `▶ ЗАПУСТИТЬ ПЕРЕВОД [${pendingCount}]`}
            </button>

            {/* Cancel button */}
            {isRunning && (
              <button
                onClick={handleCancelTranslation}
                className="w-full py-3 border-2 border-red-500 text-red-400 font-bold tracking-widest uppercase text-sm
                           hover:bg-red-500 hover:text-black transition-colors duration-100 active:scale-[0.98]"
              >
                ✕ ОТМЕНИТЬ ПЕРЕВОД
              </button>
            )}

            {results.length > 0 && !isRunning && (
              <>
                <button
                  onClick={handleExport}
                  className="w-full py-3 border-2 border-green-300 text-green-300 font-bold tracking-widest uppercase text-sm
                             hover:bg-green-300 hover:text-black transition-colors duration-100 active:scale-[0.98] animate-pulse"
                >
                  ▼ СКАЧАТЬ ВСЕ [{results.length}]
                </button>

                {/* Individual file downloads */}
                <div className="border border-green-900 divide-y divide-green-950">
                  <div className="px-3 py-2 text-xs text-green-700 font-bold tracking-wider">
                    СКАЧАТЬ ПО ОТДЕЛЬНОСТИ:
                  </div>
                  {results.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 hover:bg-green-950/20 transition-colors">
                      <span className="flex-1 text-xs text-green-300 truncate">
                        {file.outputFileName}
                      </span>
                      <button
                        onClick={() => handleDownloadSingle(file)}
                        className="text-xs px-2 py-1 border border-green-700 text-green-400 hover:bg-green-700 hover:text-black transition-colors"
                      >
                        ⬇
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Translation Report */}
          {translationReport && (
            <div>
              <div className="section-label">// ОТЧЕТ О ПЕРЕВОДЕ</div>
              <TranslationReportViewer
                report={translationReport}
                textReport={textReport}
                htmlReportBase64={htmlReportBase64}
              />
            </div>
          )}

          {(isRunning || progress > 0) && (
            <div>
              <div className="section-label">// ПРОГРЕСС</div>
              <ProgressBar value={progress} label="TRANSLATION" />
            </div>
          )}

          {/* History Panel */}
          <div>
            <div className="section-label">// ИСТОРИЯ ПЕРЕВОДОВ</div>
            <HistoryPanel />
          </div>
        </div>

        {/* Right */}
        <div>
          <div className="section-label">// ЛОГ</div>
          <TerminalLog logs={logs} />
        </div>
      </div>

      <footer className="mt-8 border-t border-green-950 pt-3 flex flex-wrap justify-between text-xs text-green-900">
        <span>Автоматический переводчик модов и модпаков Minecraft</span>
        <span>Версия 3.10.1</span>
      </footer>
    </main>
  );
}


