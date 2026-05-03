'use client';

import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}

      <style jsx>{`
        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 100;
          background: var(--bg-secondary);
          border: 2px solid var(--border-primary);
          color: var(--text-primary);
          width: 48px;
          height: 48px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .theme-toggle:hover {
          background: var(--bg-hover);
          border-color: var(--border-hover);
          transform: scale(1.05);
        }

        .theme-toggle:active {
          transform: scale(0.95);
        }
      `}</style>
    </button>
  );
}
