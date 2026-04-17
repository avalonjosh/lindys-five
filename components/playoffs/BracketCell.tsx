'use client';

import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { BracketMatchup } from '@/lib/types/playoffs';

function getTeamSlug(abbrev: string): string | null {
  const entry = Object.entries(TEAMS).find(([, t]) => t.abbreviation === abbrev);
  return entry ? entry[0] : null;
}

function getTeamColor(abbrev: string): string {
  const entry = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return entry?.colors.primary || '#003087';
}

interface BracketCellProps {
  matchup: BracketMatchup;
  cupFinal?: boolean;
}

export default function BracketCell({ matchup, cupFinal }: BracketCellProps) {
  const { topSeed, bottomSeed, topSeedWins, bottomSeedWins, isComplete, topSeedSeriesWinPct, bottomSeedSeriesWinPct } = matchup;

  if (!topSeed || !bottomSeed) {
    if (cupFinal) {
      return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center py-3 px-3">
          <img src="/stanley-cup.png" alt="Stanley Cup" className="w-16 h-20 object-contain mb-1" />
          <span className="text-xs text-gray-400">TBD</span>
        </div>
      );
    }
    // Standard TBD matchup — mirror the 2-row layout of a real matchup so the bracket reads consistently
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-center px-2 py-2 sm:py-3">
          <span className="text-sm font-semibold italic text-gray-400">TBD</span>
        </div>
        <div className="border-t border-gray-200" />
        <div className="flex items-center justify-center px-2 py-2 sm:py-3">
          <span className="text-sm font-semibold italic text-gray-400">TBD</span>
        </div>
      </div>
    );
  }

  const topPct = Math.round(topSeedSeriesWinPct);
  const bottomPct = Math.round(bottomSeedSeriesWinPct);
  const liveGame = matchup.games.find((g) => g.gameState === 'LIVE' || g.gameState === 'CRIT');

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
        liveGame ? 'ring-2 ring-green-400' : ''
      }`}
    >
      <TeamRow
        logo={topSeed.logo}
        abbrev={topSeed.abbrev}
        wins={topSeedWins}
        pct={topPct}
        isWinner={isComplete && topSeedWins >= 4}
        isLoser={isComplete && topSeedWins < 4}
        showPct={!isComplete}
        slug={getTeamSlug(topSeed.abbrev)}
      />

      {/* Thin divider between the two teams */}
      <div className="border-t border-gray-100" />

      <TeamRow
        logo={bottomSeed.logo}
        abbrev={bottomSeed.abbrev}
        wins={bottomSeedWins}
        pct={bottomPct}
        isWinner={isComplete && bottomSeedWins >= 4}
        isLoser={isComplete && bottomSeedWins < 4}
        showPct={!isComplete}
        slug={getTeamSlug(bottomSeed.abbrev)}
      />
    </div>
  );
}

function TeamRow({
  logo,
  abbrev,
  wins,
  pct,
  isWinner,
  isLoser,
  showPct,
  slug,
}: {
  logo: string;
  abbrev: string;
  wins: number;
  pct: number;
  isWinner: boolean;
  isLoser: boolean;
  showPct: boolean;
  slug: string | null;
}) {
  const logoEl = <img src={logo} alt={abbrev} className="w-10 h-10 sm:w-16 sm:h-16 object-contain flex-shrink-0" />;

  return (
    <div className={`flex items-center gap-0 pl-1 pr-2 h-[52px] sm:h-[68px] ${isLoser ? 'opacity-40' : ''}`}>
      {slug ? (
        <Link href={`/nhl/${slug}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
          {logoEl}
        </Link>
      ) : (
        logoEl
      )}

      {showPct && (
        <span
          className="-ml-1 text-sm sm:text-lg font-bold tabular-nums text-white rounded-md px-1.5 py-0.5 sm:px-2 sm:py-1 leading-none"
          style={{ backgroundColor: pct >= 50 ? getTeamColor(abbrev) : '#9ca3af' }}
        >
          {pct}%
        </span>
      )}
      <span
        className={`ml-auto text-base sm:text-2xl font-bold tabular-nums flex-shrink-0 min-w-[16px] sm:min-w-[20px] text-center ${
          isWinner ? 'text-gray-900' : wins > 0 ? 'text-gray-700' : 'text-gray-300'
        }`}
      >
        {wins}
      </span>
    </div>
  );
}
