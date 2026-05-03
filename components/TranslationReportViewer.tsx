'use client';

import { useState } from 'react';
import { TranslationReport } from '@/lib/translationReport';

interface Props {
  report: TranslationReport | null;
  textReport: string | null;
  htmlReportBase64: string | null;
}

export function TranslationReportViewer({ report, textReport, htmlReportBase64 }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<number | null>(null);

  if (!report) return null;

  const handleDownloadHtmlReport = () => {
    if (!htmlReportBase64) return;

    const blob = new Blob(
      [Buffer.from(htmlReportBase64, 'base64').toString('utf-8')],
      { type: 'text/html' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation_report_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getModeLabel = () => {
    switch (report.mode) {
      case 'file': return 'Одиночный файл';
      case 'jar': return 'JAR мод';
      case 'modpack': return 'Модпак (ZIP)';
      default: return 'Неизвестно';
    }
  };

  return (
    <div className="border border-[var(--border-primary)] p-4 mb-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent-success)] transition-colors"
        >
          <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
          <span className="font-bold">📊 ОТЧЕТ О ПЕРЕВОДЕ</span>
        </button>

        {htmlReportBase64 && (
          <button
            onClick={handleDownloadHtmlReport}
            className="px-3 py-1 border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm"
            title="Скачать HTML отчет"
          >
            ⬇ HTML
          </button>
        )}
      </div>

      {/* Краткая статистика (всегда видна) */}
      <div className="text-sm text-[var(--text-secondary)] space-y-1">
        <div>Режим: {getModeLabel()}</div>
        <div>Файлов: {report.totalFiles}</div>
        <div>Строк переведено: {report.totalStrings}</div>
        <div>Дата: {new Date(report.timestamp).toLocaleString('ru-RU')}</div>
      </div>

      {/* Развернутый отчет */}
      {isExpanded && (
        <div className="mt-4 border-t border-[var(--border-secondary)] pt-4">
          {/* Список файлов */}
          <div className="space-y-3">
            {report.files.map((file, fileIndex) => (
              <div key={fileIndex} className="border border-[var(--border-secondary)] p-3">
                {/* Заголовок файла */}
                <button
                  onClick={() => setSelectedFile(selectedFile === fileIndex ? null : fileIndex)}
                  className="w-full text-left flex items-center justify-between hover:text-[var(--accent-success)] transition-colors"
                >
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">
                      📄 {file.fileName}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      [{file.format.toUpperCase()}] • {file.totalStrings} строк
                    </div>
                  </div>
                  <span className="text-xl">{selectedFile === fileIndex ? '▼' : '▶'}</span>
                </button>

                {/* Примеры перевода */}
                {selectedFile === fileIndex && (
                  <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                    {file.entries.slice(0, 20).map((entry, entryIndex) => (
                      <div
                        key={entryIndex}
                        className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-xs"
                      >
                        {entry.key && (
                          <div className="text-[var(--accent-info)] mb-1 font-mono">
                            [{entry.key}]
                          </div>
                        )}
                        <div className="text-[var(--accent-warning)] mb-1">
                          <span className="font-bold">EN:</span> {entry.original}
                        </div>
                        <div className="text-[var(--accent-success)]">
                          <span className="font-bold">RU:</span> {entry.translated}
                        </div>
                      </div>
                    ))}

                    {file.entries.length > 20 && (
                      <div className="text-center text-[var(--text-dim)] text-sm py-2">
                        ... и еще {file.entries.length - 20} строк(и)
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Текстовый отчет */}
          {textReport && (
            <div className="mt-4">
              <button
                onClick={() => {
                  const blob = new Blob([textReport], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `translation_report_${Date.now()}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full px-4 py-2 border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm"
              >
                ⬇ Скачать текстовый отчет
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
