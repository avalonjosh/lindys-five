'use client';

// Slim sticky readout shown while What If mode is active and the Season Progress
// box has scrolled out of view, so the live projection follows the user as they
// pick game outcomes further down the page. Pinned to the bottom on mobile
// (thumb reach, clear of the set cards) and the top on desktop.

interface TeamColors {
  primary: string;
  accent: string;
}

interface DarkModeColors {
  accent: string;
  background: string;
  cardBackground?: string;
}

interface WhatIfStickyBarProps {
  show: boolean;
  gamesSimulated: number;
  record: string; // "8-4-3"
  projectedPoints: number;
  odds: number;
  projectionReady: boolean; // false before the first game is simulated
  onReset: () => void;
  onJumpToBox: () => void;
  isGoatMode: boolean;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
}

// Lighter shades so the odds stay legible on the dark team-colored bar.
function oddsColor(odds: number): string {
  return odds >= 60 ? '#34d399' : odds >= 35 ? '#fbbf24' : '#f87171';
}

export default function WhatIfStickyBar({
  show,
  gamesSimulated,
  record,
  projectedPoints,
  odds,
  projectionReady,
  onReset,
  onJumpToBox,
  isGoatMode,
  teamColors,
  darkModeColors,
}: WhatIfStickyBarProps) {
  const bg = isGoatMode ? darkModeColors.cardBackground || darkModeColors.background : teamColors.primary;

  return (
    <div
      className={`fixed inset-x-0 z-50 transition-transform duration-300 ease-out bottom-0 md:bottom-auto md:top-0 ${
        show ? 'translate-y-0' : 'translate-y-full md:-translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={!show}
    >
      <div className="mx-auto max-w-7xl px-3">
        <div
          className="flex items-center gap-3 rounded-t-xl md:rounded-t-none md:rounded-b-xl px-4 py-2.5 shadow-2xl border-t md:border-t-0 md:border-b border-white/10"
          style={{ backgroundColor: bg }}
        >
          <button
            type="button"
            onClick={onJumpToBox}
            className="flex items-baseline gap-2 flex-1 min-w-0 text-left focus:outline-none"
            title="Jump to the Season Progress box"
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/60 flex-shrink-0">
              What-If
            </span>
            <span className="text-sm font-bold text-white truncate" aria-live="polite">
              {projectionReady ? (
                <>
                  {gamesSimulated > 0 && <span className="text-white/80 font-semibold">{record} · </span>}
                  Proj {projectedPoints}
                  {' · '}
                  <span style={{ color: oddsColor(odds) }}>{odds}%</span>
                </>
              ) : (
                <span className="text-white/80 font-semibold">Tap games below to simulate</span>
              )}
            </span>
          </button>
          {gamesSimulated > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="flex-shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
