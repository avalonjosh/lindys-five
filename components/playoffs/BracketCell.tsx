'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import type { BracketMatchup, PlayoffGame } from '@/lib/types/playoffs';

function getTeamSlug(abbrev: string): string | null {
  const entry = Object.entries(TEAMS).find(([, t]) => t.abbreviation === abbrev);
  return entry ? entry[0] : null;
}

function getTeamColor(abbrev: string): string {
  const entry = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return entry?.colors.primary || '#003087';
}

function getPeriodLabel(g: PlayoffGame): string {
  const period = g.periodDescriptor;
  const clock = g.clock;
  if (!period) return 'LIVE';
  if (clock?.inIntermission) return `INT P${period.number}`;
  if (period.periodType === 'OT') {
    const otNum = period.number - 3;
    return otNum > 1 ? `${otNum}OT` : 'OT';
  }
  if (period.periodType === 'SO') return 'SO';
  const time = clock?.timeRemaining;
  return time ? `P${period.number} ${time}` : `P${period.number}`;
}

interface BracketCellProps {
  matchup: BracketMatchup;
  cupFinal?: boolean;
  compact?: boolean;
}

export default function BracketCell({ matchup, cupFinal, compact }: BracketCellProps) {
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
    if (compact) {
      return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-center h-[40px] px-1">
            <span className="text-[10px] font-semibold italic text-gray-400">TBD</span>
          </div>
          <div className="border-t border-gray-200" />
          <div className="flex items-center justify-center h-[40px] px-1">
            <span className="text-[10px] font-semibold italic text-gray-400">TBD</span>
          </div>
        </div>
      );
    }
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

  const router = useRouter();

  return (
    <div
      className={`relative bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${
        liveGame ? 'ring-2 ring-green-400 cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={liveGame ? () => router.push(`/scores/${liveGame.gameId}`) : undefined}
    >
      <TeamRow
        logo={topSeed.logo}
        abbrev={topSeed.abbrev}
        wins={topSeedWins}
        pct={topPct}
        isWinner={isComplete && topSeedWins >= 4}
        isLoser={isComplete && topSeedWins < 4}
        showPct={!compact}
        compact={compact}
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
        showPct={!compact}
        compact={compact}
        slug={getTeamSlug(bottomSeed.abbrev)}
      />

      {liveGame && !compact && (() => {
        const topIsHome = liveGame.homeTeam.abbrev === topSeed.abbrev;
        const topScore = (topIsHome ? liveGame.homeTeam.score : liveGame.awayTeam.score) ?? 0;
        const bottomScore = (topIsHome ? liveGame.awayTeam.score : liveGame.homeTeam.score) ?? 0;
        const topLeads = topScore > bottomScore;
        const bottomLeads = bottomScore > topScore;
        return (
          <>
            <div className="border-t border-gray-100" />
            <div className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5 px-2 py-1 bg-gray-50 text-[9px] sm:text-xs">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="font-bold text-red-600 whitespace-nowrap">{getPeriodLabel(liveGame)}</span>
              </div>
              <span className="tabular-nums text-gray-700 whitespace-nowrap sm:ml-auto">
                <span className={topLeads ? 'font-bold text-gray-900' : 'font-semibold'}>
                  {topSeed.abbrev} {topScore}
                </span>
                -
                <span className={bottomLeads ? 'font-bold text-gray-900' : 'font-semibold'}>
                  {bottomSeed.abbrev} {bottomScore}
                </span>
              </span>
            </div>
          </>
        );
      })()}

      {liveGame && compact && (
        <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
      )}
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
  compact,
  slug,
}: {
  logo: string;
  abbrev: string;
  wins: number;
  pct: number;
  isWinner: boolean;
  isLoser: boolean;
  showPct: boolean;
  compact?: boolean;
  slug: string | null;
}) {
  const logoEl = (
    <img
      src={logo}
      alt={abbrev}
      className={`${compact ? 'w-8 h-8' : 'w-10 h-10 sm:w-16 sm:h-16'} object-contain flex-shrink-0`}
    />
  );

  return (
    <div
      className={`flex items-center gap-0 ${
        compact ? 'px-0 h-[40px]' : 'pl-1 pr-1 sm:pr-2 h-[52px] sm:h-[68px]'
      } ${isLoser ? 'opacity-40' : ''}`}
    >
      {slug ? (
        <Link href={`/nhl/${slug}`} className="flex-shrink-0 hover:opacity-80 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {logoEl}
        </Link>
      ) : (
        logoEl
      )}

      {showPct && (
        <span
          className="-ml-1 text-sm sm:text-lg font-bold tabular-nums text-white rounded-md px-1.5 py-0.5 sm:px-2 sm:py-1 leading-none text-center min-w-[44px] sm:min-w-[56px]"
          style={{ backgroundColor: pct >= 50 ? getTeamColor(abbrev) : '#9ca3af' }}
        >
          {pct}%
        </span>
      )}
      <span
        className={`ml-auto ${compact ? 'mr-0 text-sm min-w-[14px]' : 'mr-0 sm:mr-1 text-base sm:text-2xl min-w-[16px] sm:min-w-[20px]'} font-bold tabular-nums flex-shrink-0 text-center ${
          isWinner ? 'text-gray-900' : wins > 0 ? 'text-gray-700' : 'text-gray-300'
        }`}
      >
        {wins}
      </span>
    </div>
  );
}
