'use client';

import { useEffect, useState } from 'react';
import { getTranslationHistory, HistoryEntry } from '@/lib/translationHistory';

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      const history = getTranslationHistory();
      const data = await history.getAll();
      setEntries(data);
    } catch (error) {
      console.error('[HistoryPanel] Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(entry: HistoryEntry) {
    try {
      const blob = base64ToBlob(entry.resultBase64);
      downloadBlob(blob, entry.outputFileName);
    } catch (error) {
      console.error('[HistoryPanel] Error downloading:', error);
      alert('Ошибка при скачивании файла');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту запись из истории?')) {
      return;
    }

    try {
      const history = getTranslationHistory();
      await history.delete(id);
      await loadHistory();
    } catch (error) {
      console.error('[HistoryPanel] Error deleting:', error);
      alert('Ошибка при удалении записи');
    }
  }

  async function handleClearAll() {
    if (!confirm('Очистить всю историю переводов? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const history = getTranslationHistory();
      await history.clear();
      await loadHistory();
    } catch (error) {
      console.error('[HistoryPanel] Error clearing:', error);
      alert('Ошибка при очистке истории');
    }
  }

  function base64ToBlob(base64: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray]);
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  if (loading) {
    return (
      <div className="history-panel loading">
        <div className="history-text">Загрузка истории...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="history-panel empty">
        <div className="history-header">
          <span className="history-title">📜 История переводов</span>
        </div>
        <div className="history-empty">
          История пуста. Переведите файлы, чтобы они сохранились здесь.
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const displayEntries = isExpanded ? entries : entries.slice(0, 5);

  return (
    <div className="history-panel">
      <div className="history-header">
        <span className="history-title">📜 История переводов ({entries.length})</span>
        <div className="history-actions">
          <button
            className="history-refresh"
            onClick={loadHistory}
            title="Обновить"
          >
            ↻
          </button>
          {entries.length > 0 && (
            <button
              className="history-clear"
              onClick={handleClearAll}
              title="Очистить всю историю"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="history-list">
        {displayEntries.map((entry) => (
          <div key={entry.id} className="history-entry">
            <div className="entry-main">
              <div className="entry-info">
                <div className="entry-name">{entry.outputFileName}</div>
                <div className="entry-meta">
                  <span className="entry-format">{entry.format.toUpperCase()}</span>
                  <span className="entry-date">{formatDate(entry.timestamp)}</span>
                  <span className="entry-strings">{entry.stringsCount} строк</span>
                </div>
              </div>
              <div className="entry-buttons">
                <button
                  className="entry-download"
                  onClick={() => handleDownload(entry)}
                  title="Скачать"
                >
                  ⬇
                </button>
                <button
                  className="entry-delete"
                  onClick={() => handleDelete(entry.id)}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {entries.length > 5 && (
        <button
          className="history-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▲ Свернуть' : `▼ Показать все (${entries.length})`}
        </button>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .history-panel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .history-panel.loading,
  .history-panel.empty {
    opacity: 0.6;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .history-title {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .history-actions {
    display: flex;
    gap: 4px;
  }

  .history-refresh,
  .history-clear {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    transition: color 0.2s;
  }

  .history-refresh:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .history-clear:hover {
    color: #ef4444;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  .history-entry {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 8px;
    transition: background 0.2s;
  }

  .history-entry:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .entry-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .entry-info {
    flex: 1;
    min-width: 0;
  }

  .entry-name {
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  .entry-meta {
    display: flex;
    gap: 8px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  .entry-format {
    color: #10b981;
    font-weight: 600;
  }

  .entry-buttons {
    display: flex;
    gap: 4px;
  }

  .entry-download,
  .entry-delete {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 3px;
    transition: all 0.2s;
  }

  .entry-download:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #10b981;
  }

  .entry-delete:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
  }

  .history-toggle {
    width: 100%;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 11px;
    padding: 6px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .history-toggle:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.9);
  }

  .history-empty {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    text-align: center;
    padding: 16px 8px;
  }

  .history-text {
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    padding: 8px;
  }
`;
