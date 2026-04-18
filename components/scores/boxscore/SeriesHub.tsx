'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { SeriesHubData, SeriesHubGame } from '@/lib/services/boxscoreApi';

interface SeriesHubProps {
  data: SeriesHubData;
  currentGameId: string;
}

function formatGameTime(game: SeriesHubGame): string {
  if (!game.startTimeUTC || game.gameScheduleState === 'TBD') return 'TBD';
  const d = new Date(game.startTimeUTC);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

function gameStatusLabel(game: SeriesHubGame): string {
  if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
    const ot = game.gameOutcome?.lastPeriodType;
    const suffix = ot === 'OT' ? '/OT' : ot === 'SO' ? '/SO' : '';
    return `Final${suffix}`;
  }
  if (game.gameState === 'LIVE' || game.gameState === 'CRIT') return 'LIVE';
  return formatGameTime(game);
}

function SeriesDots({ wins, needed }: { wins: number; needed: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: needed }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i < wins ? 'bg-gray-800' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

export default function SeriesHub({ data, currentGameId }: SeriesHubProps) {
  const { topSeed, bottomSeed, neededToWin, games, currentGameNumber, roundLabel } = data;

  const leader =
    topSeed.wins > bottomSeed.wins
      ? topSeed.abbrev
      : bottomSeed.wins > topSeed.wins
      ? bottomSeed.abbrev
      : null;
  const seriesComplete = topSeed.wins >= neededToWin || bottomSeed.wins >= neededToWin;
  const seriesWinner =
    topSeed.wins >= neededToWin ? topSeed.abbrev : bottomSeed.wins >= neededToWin ? bottomSeed.abbrev : null;

  const statusLine = seriesComplete
    ? `${seriesWinner} wins series ${Math.max(topSeed.wins, bottomSeed.wins)}-${Math.min(topSeed.wins, bottomSeed.wins)}`
    : leader
    ? `${leader} leads ${Math.max(topSeed.wins, bottomSeed.wins)}-${Math.min(topSeed.wins, bottomSeed.wins)}`
    : `Series tied ${topSeed.wins}-${bottomSeed.wins}`;

  const currentIdNum = Number(currentGameId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
      {/* Header: round + status */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/playoffs" className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-gray-700 hover:bg-gray-600 transition-colors">{roundLabel.replace(/-/g, ' ')}</Link>
        <span className="text-xs text-gray-400">Best of {neededToWin * 2 - 1}</span>
      </div>

      {/* Matchup row */}
      <div className="flex items-center justify-between mb-4">
        {/* Top seed */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {topSeed.logo && (
            <Image src={topSeed.logo} alt={topSeed.abbrev} width={40} height={40} className="w-10 h-10 flex-shrink-0" unoptimized />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{topSeed.name}</p>
            {topSeed.points != null && (
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{topSeed.points} pts</p>
            )}
          </div>
        </div>

        {/* Series score */}
        <div className="flex flex-col items-center gap-1 px-2 sm:px-4 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${topSeed.wins > bottomSeed.wins ? 'text-gray-900' : 'text-gray-400'}`}>
              {topSeed.wins}
            </span>
            <span className="text-xs text-gray-300">-</span>
            <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${bottomSeed.wins > topSeed.wins ? 'text-gray-900' : 'text-gray-400'}`}>
              {bottomSeed.wins}
            </span>
          </div>
          <SeriesDots wins={topSeed.wins + bottomSeed.wins} needed={neededToWin * 2 - 1} />
        </div>

        {/* Bottom seed */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-sm font-bold text-gray-900 truncate">{bottomSeed.name}</p>
            {bottomSeed.points != null && (
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{bottomSeed.points} pts</p>
            )}
          </div>
          {bottomSeed.logo && (
            <Image src={bottomSeed.logo} alt={bottomSeed.abbrev} width={40} height={40} className="w-10 h-10 flex-shrink-0" unoptimized />
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Schedule</p>
        <div className="space-y-1.5">
          {games.map((g) => {
            const isCurrent = g.id === currentIdNum;
            const isFinal = g.gameState === 'FINAL' || g.gameState === 'OFF';
            const awayWon = isFinal && (g.awayTeam.score ?? 0) > (g.homeTeam.score ?? 0);
            const homeWon = isFinal && (g.homeTeam.score ?? 0) > (g.awayTeam.score ?? 0);
            const row = (
              <div
                className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-xs transition-colors ${
                  isCurrent ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <span className="w-12 flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Gm {g.gameNumber}
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={`tabular-nums font-medium ${awayWon ? 'text-gray-900 font-bold' : homeWon ? 'text-gray-400' : 'text-gray-700'}`}>
                    {g.awayTeam.abbrev}
                    {isFinal && g.awayTeam.score != null ? ` ${g.awayTeam.score}` : ''}
                  </span>
                  <span className="text-gray-300">@</span>
                  <span className={`tabular-nums font-medium ${homeWon ? 'text-gray-900 font-bold' : awayWon ? 'text-gray-400' : 'text-gray-700'}`}>
                    {g.homeTeam.abbrev}
                    {isFinal && g.homeTeam.score != null ? ` ${g.homeTeam.score}` : ''}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 flex-shrink-0">
                  {gameStatusLabel(g)}
                  {g.ifNecessary && !isFinal ? ' • if nec.' : ''}
                </span>
              </div>
            );
            const isTbd = g.gameScheduleState === 'TBD';
            if (isCurrent || !g.id || isTbd) return <div key={g.id || g.gameNumber}>{row}</div>;
            return (
              <Link key={g.id} href={`/nhl/scores/${g.id}`} className="block">
                {row}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
