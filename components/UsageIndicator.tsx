'use client';

import { useEffect, useState } from 'react';

interface UsageStats {
  charactersUsed: number;
  requestsCount: number;
  lastReset: string;
  monthlyLimit: number;
  remaining: number;
  usagePercent: number;
}

export function UsageIndicator() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const colorClass = getColorClass(stats.usagePercent);

  return (
    <div className={`usage-indicator ${colorClass}`}>
      <div className="usage-header">
        <span className="usage-title">📊 DeepL API</span>
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
          style={{ width: `${Math.min(stats.usagePercent, 100)}%` }}
        />
      </div>

      <div className="usage-text">
        <span className="usage-numbers">
          {stats.charactersUsed.toLocaleString('ru-RU')} / {stats.monthlyLimit.toLocaleString('ru-RU')} символов
        </span>
        <span className="usage-percent">
          {stats.usagePercent}%
        </span>
      </div>

      <div className="usage-details">
        <span>Осталось: {stats.remaining.toLocaleString('ru-RU')} символов</span>
        <span>Запросов: {stats.requestsCount}</span>
      </div>

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
