'use client';

import { useEffect, useRef } from 'react';
import { LogEntry } from '@/types';

interface TerminalLogProps {
  logs: LogEntry[];
}

const COLOR: Record<LogEntry['type'], string> = {
  info:    'text-green-400',
  success: 'text-green-300',
  error:   'text-red-400',
  warning: 'text-yellow-400',
  system:  'text-cyan-500',
};

// ============================================================
// BLOCK: TerminalLog Component
// Scrollable real-time log window with auto-scroll
// ============================================================
export default function TerminalLog({ logs }: TerminalLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="border border-green-900 flex flex-col h-[520px] bg-black">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-green-900 bg-green-950/20 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-red-700 inline-block" />
        <span className="w-2 h-2 rounded-full bg-yellow-700 inline-block" />
        <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
        <span className="ml-2 text-green-800 text-xs tracking-widest">SYSTEM_LOG // MOD_TRANSLATOR</span>
        <span className="ml-auto text-green-900 text-xs">{logs.length} LINES</span>
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 text-xs font-mono">
        {logs.length === 0 ? (
          <div className="text-green-900 tracking-widest">{'> SYSTEM READY. AWAITING INPUT...'}</div>
        ) : logs.map(log => (
          <div key={log.id} className="flex gap-2 leading-5 boot-in">
            <span className="text-green-900 flex-shrink-0 select-none tabular-nums">
              {log.timestamp}
            </span>
            <span className={`${COLOR[log.type]} break-all`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input line (decorative) */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-green-950 text-green-700 text-xs">
        <span className="cursor">{'root@mod-translator:~$ '}</span>
      </div>
    </div>
  );
}
