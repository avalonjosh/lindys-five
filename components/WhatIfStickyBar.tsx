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
  // Progress-bar inputs, mirroring the Season Progress box: current points
  // toward the target, plus the expected-pace marker from games played.
  totalPoints: number;
  gamesPlayed: number;
  totalGames: number;
  playoffTarget: number;
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

const AHEAD = '#34d399';
const BEHIND = '#f87171';

export default function WhatIfStickyBar({
  show,
  gamesSimulated,
  record,
  projectedPoints,
  odds,
  totalPoints,
  gamesPlayed,
  totalGames,
  playoffTarget,
  projectionReady,
  onReset,
  onJumpToBox,
  isGoatMode,
  teamColors,
  darkModeColors,
}: WhatIfStickyBarProps) {
  const bg = isGoatMode ? darkModeColors.cardBackground || darkModeColors.background : teamColors.primary;
  // Same progress math as the Season Progress box: fill by current points toward
  // the target, with the expected-pace marker at where they should be by now.
  const currentProgress = playoffTarget > 0 ? (totalPoints / playoffTarget) * 100 : 0;
  const expectedPoints = totalGames > 0 ? (playoffTarget / totalGames) * gamesPlayed : 0;
  const expectedProgress = playoffTarget > 0 ? (expectedPoints / playoffTarget) * 100 : 0;
  const aheadOfPace = totalPoints - expectedPoints >= -0.05;
  const showMarker = gamesPlayed > 0;

  return (
    <div
      className={`fixed inset-x-0 z-50 transition-transform duration-300 ease-out bottom-0 md:bottom-auto md:top-0 ${
        show ? 'translate-y-0' : 'translate-y-full md:-translate-y-full'
      }`}
      aria-hidden={!show}
    >
      {/* Edge-to-edge on mobile; a centered rounded pill on desktop. */}
      <div className="mx-auto max-w-7xl md:px-3">
        {/* Safe-area padding lives inside the colored strip so the background
            reaches the screen edge (no dead gap below it on notched phones). */}
        <div
          className="rounded-t-none md:rounded-b-xl px-4 pt-2.5 shadow-2xl border-t md:border-t-0 md:border-b border-white/10"
          style={{ backgroundColor: bg, paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3">
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

          {/* Progress toward the playoff target — mirrors the Season Progress
              box: current-points fill + green/red expected-pace marker. */}
          <div className="mt-2 flex items-center gap-2">
            <div
              className="relative flex-1 h-2 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white transition-all duration-300"
                style={{ width: `${Math.min(currentProgress, 100)}%` }}
              />
              {showMarker && (
                <div
                  className="absolute -top-1 -bottom-1 flex flex-col items-center"
                  style={{ left: `calc(${Math.min(expectedProgress, 100)}% - 3px)` }}
                  aria-hidden="true"
                >
                  <div
                    className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent"
                    style={{ borderTopColor: aheadOfPace ? AHEAD : BEHIND }}
                  />
                  <div className="w-px flex-1" style={{ backgroundColor: aheadOfPace ? AHEAD : BEHIND }} />
                </div>
              )}
            </div>
            {projectionReady && (
              <span className="flex-shrink-0 text-[10px] font-semibold text-white/60 tabular-nums">
                {currentProgress.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
