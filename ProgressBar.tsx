'use client';

// ============================================================
// BLOCK: ProgressBar Component
// Retro segmented progress bar, 40 cells
// ============================================================
export default function ProgressBar({ value }: { value: number }) {
  const CELLS = 40;
  const filled = Math.round((value / 100) * CELLS);

  return (
    <div className="space-y-1.5">
      {/* Cell bar */}
      <div className="flex gap-px">
        {Array.from({ length: CELLS }, (_, i) => (
          <div
            key={i}
            style={{ transitionDelay: `${i * 8}ms` }}
            className={`h-5 flex-1 transition-all duration-150 ${
              i < filled
                ? 'bg-green-400 shadow-[0_0_6px_rgba(0,255,0,0.7)]'
                : 'bg-green-950 border-r border-green-900/30'
            }`}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="text-green-800 tracking-widest">LOADING</span>
        <span className={`font-bold tracking-widest ${value === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
          {String(value).padStart(3, '0')}%
          {value === 100 && '  [COMPLETE]'}
        </span>
      </div>
    </div>
  );
}
