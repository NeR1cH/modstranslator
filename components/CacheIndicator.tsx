'use client';

import { useEffect, useState } from 'react';

interface CacheStats {
  size: number;
  cacheFile: string;
  cacheDir: string;
}

export function CacheIndicator() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/cache-stats');

      if (!response.ok) {
        throw new Error('Failed to fetch cache stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('[CacheIndicator] Error:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleClearCache() {
    if (!confirm('Очистить весь кэш переводов? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const response = await fetch('/api/cache-stats', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to clear cache');
      }

      await fetchStats(); // Refresh stats
      alert('Кэш успешно очищен');
    } catch (err) {
      console.error('[CacheIndicator] Error clearing cache:', err);
      alert('Ошибка при очистке кэша: ' + err);
    }
  }

  if (loading) {
    return (
      <div className="cache-indicator loading">
        <div className="cache-text">Загрузка кэша...</div>
      </div>
    );
  }

  if (error || !stats) {
    return null; // Silently fail - cache indicator is not critical
  }

  return (
    <div className="cache-indicator">
      <div className="cache-header">
        <span className="cache-title">💾 Кэш переводов</span>
        <div className="cache-actions">
          <button
            className="cache-refresh"
            onClick={fetchStats}
            title="Обновить статистику"
          >
            ↻
          </button>
          {stats.size > 0 && (
            <button
              className="cache-clear"
              onClick={handleClearCache}
              title="Очистить кэш"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="cache-content">
        <div className="cache-stat">
          <span className="cache-label">Записей в кэше:</span>
          <span className="cache-value">{stats.size.toLocaleString('ru-RU')}</span>
        </div>

        {stats.size > 0 && (
          <div className="cache-info">
            Повторные переводы этих строк будут мгновенными и бесплатными
          </div>
        )}

        {stats.size === 0 && (
          <div className="cache-empty">
            Кэш пуст. Переведите файлы, чтобы начать кэширование.
          </div>
        )}
      </div>

      <style jsx>{`
        .cache-indicator {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .cache-indicator.loading {
          opacity: 0.6;
        }

        .cache-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .cache-title {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .cache-actions {
          display: flex;
          gap: 4px;
        }

        .cache-refresh,
        .cache-clear {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 14px;
          padding: 2px 6px;
          transition: color 0.2s;
        }

        .cache-refresh:hover,
        .cache-clear:hover {
          color: rgba(255, 255, 255, 0.9);
        }

        .cache-clear:hover {
          color: #ef4444;
        }

        .cache-content {
          color: rgba(255, 255, 255, 0.8);
        }

        .cache-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .cache-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }

        .cache-value {
          font-weight: 600;
          font-size: 16px;
          color: #10b981;
        }

        .cache-info {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.4;
          padding: 8px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 4px;
          border-left: 2px solid #10b981;
        }

        .cache-empty {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
          text-align: center;
          padding: 8px;
        }
      `}</style>
    </div>
  );
}
