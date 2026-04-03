'use client';

import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { BracketMatchup } from '@/lib/types/playoffs';

function getTeamSlug(abbrev: string): string | null {
  const entry = Object.entries(TEAMS).find(([, t]) => t.abbreviation === abbrev);
  return entry ? entry[0] : null;
}

function getTeamColor(abbrev: string): string {
  const entry = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return entry?.colors.primary || '#003087';
}

interface BracketCellProps {
  matchup: BracketMatchup;
  cupFinal?: boolean;
}

export default function BracketCell({ matchup, cupFinal }: BracketCellProps) {
  const { topSeed, bottomSeed, topSeedWins, bottomSeedWins, isComplete, topSeedSeriesWinPct, bottomSeedSeriesWinPct } = matchup;

  if (!topSeed || !bottomSeed) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center py-3 px-3">
        {cupFinal && (
          <img src="/stanley-cup.png" alt="Stanley Cup" className="w-16 h-20 object-contain mb-1" />
        )}
        <span className="text-xs text-gray-400">TBD</span>
      </div>
    );
  }

  const topPct = Math.round(topSeedSeriesWinPct);
  const bottomPct = Math.round(bottomSeedSeriesWinPct);
  const liveGame = matchup.games.find(g => g.gameState === 'LIVE' || g.gameState === 'CRIT');

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
      liveGame ? 'ring-2 ring-green-400' : ''
    }`}>
      {/* Top team */}
      <TeamRow
        logo={topSeed.logo}
        abbrev={topSeed.abbrev}
        seed={topSeed.seed}
        wins={topSeedWins}
        pct={topPct}
        isWinner={isComplete && topSeedWins >= 4}
        isLoser={isComplete && topSeedWins < 4}
        showPct={!isComplete}
        slug={getTeamSlug(topSeed.abbrev)}
      />
      {/* Divider with probability bar */}
      <div className="relative h-[3px] bg-gray-100">
        {!isComplete && (
          <>
            <div
              className="absolute top-0 left-0 h-full bg-blue-400 transition-all duration-500"
              style={{ width: `${topPct}%` }}
            />
            <div
              className="absolute top-0 right-0 h-full bg-orange-300 transition-all duration-500"
              style={{ width: `${bottomPct}%` }}
            />
          </>
        )}
      </div>
      {/* Bottom team */}
      <TeamRow
        logo={bottomSeed.logo}
        abbrev={bottomSeed.abbrev}
        seed={bottomSeed.seed}
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
  seed,
  wins,
  pct,
  isWinner,
  isLoser,
  showPct,
  slug,
}: {
  logo: string;
  abbrev: string;
  seed: number;
  wins: number;
  pct: number;
  isWinner: boolean;
  isLoser: boolean;
  showPct: boolean;
  slug: string | null;
}) {
  const logoEl = <img src={logo} alt={abbrev} className="w-6 h-6 object-contain flex-shrink-0" />;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 ${isLoser ? 'opacity-40' : ''}`}>
      {slug ? (
        <Link href={`/nhl/${slug}`} className="flex items-center gap-1.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
          {logoEl}
          <span className={`text-[10px] font-semibold flex-1 truncate ${
            isWinner ? 'text-gray-900' : 'text-gray-700'
          }`}>
            {abbrev}
          </span>
        </Link>
      ) : (
        <>
          {logoEl}
          <span className={`text-[10px] font-semibold flex-1 truncate ${
            isWinner ? 'text-gray-900' : 'text-gray-700'
          }`}>
            {abbrev}
          </span>
        </>
      )}
      {showPct && (
        <span
          className="text-[10px] font-bold tabular-nums flex-shrink-0 text-white rounded px-1 py-0.5 leading-none"
          style={{ backgroundColor: pct >= 50 ? getTeamColor(abbrev) : '#9ca3af' }}
        >
          {pct}%
        </span>
      )}
      <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${
        wins > 0 ? 'text-gray-700' : 'text-gray-300'
      }`}>
        {wins}
      </span>
    </div>
  );
}
