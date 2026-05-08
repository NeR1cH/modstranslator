'use client';

import { useEffect, useState } from 'react';

interface KeyStats {
  key: string;
  charactersUsed: number;
  requestsCount: number;
  monthlyLimit: number;
  remaining: number;
  usagePercent: number;
  status: 'active' | 'exhausted' | 'error';
  lastReset: string;
  isCurrent: boolean;
}

interface UsageStats {
  keys: KeyStats[];
  currentKeyIndex: number;
  total: {
    charactersUsed: number;
    monthlyLimit: number;
    remaining: number;
    usagePercent: number;
  };
}

export function UsageIndicator() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/usage');

      if (!response.ok) {
        throw new Error('Failed to fetch usage stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('[UsageIndicator] Error:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="usage-indicator loading">
        <div className="usage-text">Загрузка статистики...</div>
      </div>
    );
  }

  if (error || !stats) {
    return null; // Silently fail - usage indicator is not critical
  }

  // Determine color based on usage percentage
  const getColorClass = (percent: number): string => {
    if (percent >= 90) return 'usage-critical';
    if (percent >= 75) return 'usage-warning';
    return 'usage-normal';
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'active': return '✓';
      case 'exhausted': return '✗';
      case 'error': return '⚠';
      default: return '?';
    }
  };

  const colorClass = getColorClass(stats.total.usagePercent);
  const multiKey = stats.keys.length > 1;

  return (
    <div className={`usage-indicator ${colorClass}`}>
      <div className="usage-header">
        <span className="usage-title">
          📊 DeepL API {multiKey && `(${stats.keys.length} ключей)`}
        </span>
        <button
          className="usage-refresh"
          onClick={fetchStats}
          title="Обновить статистику"
        >
          ↻
        </button>
      </div>

      <div className="usage-bar-container">
        <div
          className="usage-bar-fill"
          style={{ width: `${Math.min(stats.total.usagePercent, 100)}%` }}
        />
      </div>

      <div className="usage-text">
        <span className="usage-numbers">
          {stats.total.charactersUsed.toLocaleString('ru-RU')} / {stats.total.monthlyLimit.toLocaleString('ru-RU')} символов
        </span>
        <span className="usage-percent">
          {stats.total.usagePercent}%
        </span>
      </div>

      <div className="usage-details">
        <span>Осталось: {stats.total.remaining.toLocaleString('ru-RU')} символов</span>
        <span>Всего запросов: {stats.keys.reduce((sum, k) => sum + k.requestsCount, 0)}</span>
      </div>

      {multiKey && (
        <>
          <button
            className="usage-expand"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'} {expanded ? 'Скрыть детали' : 'Показать детали'}
          </button>

          {expanded && (
            <div className="usage-keys">
              {stats.keys.map((key, index) => (
                <div key={index} className={`usage-key ${key.isCurrent ? 'current' : ''} ${key.status}`}>
                  <div className="key-header">
                    <span className="key-name">
                      {getStatusIcon(key.status)} {key.key} {key.isCurrent && '(активный)'}
                    </span>
                    <span className="key-percent">{key.usagePercent}%</span>
                  </div>
                  <div className="key-bar-container">
                    <div
                      className="key-bar-fill"
                      style={{ width: `${Math.min(key.usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="key-details">
                    <span>{key.charactersUsed.toLocaleString('ru-RU')} / {key.monthlyLimit.toLocaleString('ru-RU')}</span>
                    <span>{key.requestsCount} запросов</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .usage-indicator {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .usage-indicator.loading {
          opacity: 0.6;
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .usage-title {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .usage-refresh {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          font-size: 16px;
          padding: 2px 6px;
          transition: color 0.2s;
        }

        .usage-refresh:hover {
          color: rgba(255, 255, 255, 0.9);
        }

        .usage-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .usage-bar-fill {
          height: 100%;
          transition: width 0.3s ease, background-color 0.3s ease;
          border-radius: 3px;
        }

        .usage-normal .usage-bar-fill {
          background: linear-gradient(90deg, #10b981, #34d399);
        }

        .usage-warning .usage-bar-fill {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        .usage-critical .usage-bar-fill {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }

        .usage-text {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 6px;
        }

        .usage-numbers {
          font-size: 12px;
        }

        .usage-percent {
          font-weight: 600;
          font-size: 14px;
        }

        .usage-details {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }

        .usage-expand {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.7);
          padding: 6px 8px;
          margin-top: 8px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        }

        .usage-expand:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .usage-keys {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .usage-key {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 8px;
        }

        .usage-key.current {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.05);
        }

        .usage-key.exhausted {
          opacity: 0.6;
        }

        .key-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .key-name {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          font-family: monospace;
        }

        .key-percent {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .key-bar-container {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .key-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #34d399);
          transition: width 0.3s ease;
        }

        .usage-key.exhausted .key-bar-fill {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }

        .key-details {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
        }

        .usage-critical .usage-title,
        .usage-critical .usage-percent {
          color: #fca5a5;
        }

        .usage-warning .usage-title,
        .usage-warning .usage-percent {
          color: #fcd34d;
        }
      `}</style>
    </div>
  );
}
