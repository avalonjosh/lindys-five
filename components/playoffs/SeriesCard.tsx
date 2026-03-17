'use client';

import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { BracketMatchup } from '@/lib/types/playoffs';

function getTeamSlug(abbrev: string): string | null {
  const entry = Object.entries(TEAMS).find(([, t]) => t.abbreviation === abbrev);
  return entry ? entry[0] : null;
}

interface SeriesCardProps {
  matchup: BracketMatchup;
  compact?: boolean;
}

function formatGameTime(utcTime: string): string {
  return new Date(utcTime).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getSeriesStatusText(topWins: number, bottomWins: number, topAbbrev: string, bottomAbbrev: string): string {
  if (topWins === 4) return `${topAbbrev} wins 4-${bottomWins}`;
  if (bottomWins === 4) return `${bottomAbbrev} wins 4-${topWins}`;
  if (topWins === 0 && bottomWins === 0) return 'Series not started';
  if (topWins === bottomWins) return `Series tied ${topWins}-${bottomWins}`;
  if (topWins > bottomWins) return `${topAbbrev} leads ${topWins}-${bottomWins}`;
  return `${bottomAbbrev} leads ${bottomWins}-${topWins}`;
}

export default function SeriesCard({ matchup, compact }: SeriesCardProps) {
  const { topSeed, bottomSeed, topSeedWins, bottomSeedWins, games, isComplete, topSeedSeriesWinPct, bottomSeedSeriesWinPct } = matchup;

  if (!topSeed || !bottomSeed) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm opacity-50">
        <p className="text-gray-400 text-sm text-center">TBD</p>
      </div>
    );
  }

  const statusText = getSeriesStatusText(topSeedWins, bottomSeedWins, topSeed.abbrev, bottomSeed.abbrev);

  // Next game in the series
  const nextGame = games.find(g => g.gameState === 'FUT' || g.gameState === 'PRE');
  const liveGame = games.find(g => g.gameState === 'LIVE' || g.gameState === 'CRIT');

  // Win probability bar widths
  const topPct = Math.round(topSeedSeriesWinPct);
  const bottomPct = Math.round(bottomSeedSeriesWinPct);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${
      liveGame ? 'ring-2 ring-green-400' : ''
    }`}>
      {/* Series status header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          {statusText}
        </span>
        {liveGame && (
          <span className="flex items-center gap-1 text-xs font-bold text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="p-4">
        {/* Top Seed */}
        <div className={`flex items-center gap-3 py-2 ${isComplete && topSeedWins < 4 ? 'opacity-40' : ''}`}>
          {(() => {
            const slug = getTeamSlug(topSeed.abbrev);
            return slug ? (
              <Link href={`/${slug}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <img src={topSeed.logo} alt={topSeed.abbrev} className="w-10 h-10 object-contain" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">{topSeed.name}</span>
                  <span className="ml-2 text-xs text-gray-400">({topSeed.seed})</span>
                </div>
              </Link>
            ) : (
              <>
                <img src={topSeed.logo} alt={topSeed.abbrev} className="w-10 h-10 object-contain" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">{topSeed.name}</span>
                  <span className="ml-2 text-xs text-gray-400">({topSeed.seed})</span>
                </div>
              </>
            );
          })()}
          <div className="flex items-center gap-3">
            {!compact && !isComplete && (
              <span className={`text-xs font-medium ${topPct >= 50 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {topPct}%
              </span>
            )}
            <SeriesDots wins={topSeedWins} total={4} />
          </div>
        </div>

        {/* Bottom Seed */}
        <div className={`flex items-center gap-3 py-2 ${isComplete && bottomSeedWins < 4 ? 'opacity-40' : ''}`}>
          {(() => {
            const slug = getTeamSlug(bottomSeed.abbrev);
            return slug ? (
              <Link href={`/${slug}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <img src={bottomSeed.logo} alt={bottomSeed.abbrev} className="w-10 h-10 object-contain" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">{bottomSeed.name}</span>
                  <span className="ml-2 text-xs text-gray-400">({bottomSeed.seed})</span>
                </div>
              </Link>
            ) : (
              <>
                <img src={bottomSeed.logo} alt={bottomSeed.abbrev} className="w-10 h-10 object-contain" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">{bottomSeed.name}</span>
                  <span className="ml-2 text-xs text-gray-400">({bottomSeed.seed})</span>
                </div>
              </>
            );
          })()}
          <div className="flex items-center gap-3">
            {!compact && !isComplete && (
              <span className={`text-xs font-medium ${bottomPct >= 50 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {bottomPct}%
              </span>
            )}
            <SeriesDots wins={bottomSeedWins} total={4} />
          </div>
        </div>

        {/* Probability bar */}
        {!isComplete && !compact && (topSeedWins > 0 || bottomSeedWins > 0 || games.some(g => g.gameState !== 'FUT')) && (
          <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-gray-100">
            <div
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${topPct}%` }}
            />
            <div
              className="bg-orange-400 transition-all duration-500"
              style={{ width: `${bottomPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Game results + next game */}
      {!compact && (
        <div className="px-4 pb-3 space-y-1">
          {games.filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF' || g.gameState === 'LIVE' || g.gameState === 'CRIT').map(g => (
            <Link
              key={g.gameId}
              href={`/scores/${g.gameId}`}
              className="flex items-center justify-between text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <span>Game {g.gameNumber}</span>
              <span className="font-medium">
                {g.awayTeam.abbrev} {g.awayTeam.score} - {g.homeTeam.score} {g.homeTeam.abbrev}
                {g.gameOutcome?.lastPeriodType && g.gameOutcome.lastPeriodType !== 'REG' && (
                  <span className="ml-1 text-gray-400">({g.gameOutcome.lastPeriodType})</span>
                )}
              </span>
            </Link>
          ))}
          {nextGame && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Game {nextGame.gameNumber}</span>
              <span>{nextGame.startTimeUTC ? formatGameTime(nextGame.startTimeUTC) : 'TBD'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeriesDots({ wins, total }: { wins: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full ${
            i < wins ? 'bg-emerald-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
