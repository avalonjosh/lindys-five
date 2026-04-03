'use client';

import Link from 'next/link';
import type { SeasonSeriesGame } from '@/lib/types/boxscore';

interface SeasonSeriesProps {
  games: SeasonSeriesGame[];
  seriesWins: { awayTeamWins: number; homeTeamWins: number };
  homeAbbrev: string;
  awayAbbrev: string;
  currentGameId: string;
}

function getOutcomeSuffix(game: SeasonSeriesGame): string {
  const lastPeriod = game.gameOutcome?.lastPeriodType;
  if (lastPeriod === 'OT') return ' (OT)';
  if (lastPeriod === 'SO') return ' (SO)';
  return '';
}

export default function SeasonSeries({
  games,
  seriesWins,
  homeAbbrev,
  awayAbbrev,
  currentGameId,
}: SeasonSeriesProps) {
  if (!games || games.length === 0) return null;

  const completedGames = games.filter(
    (g) => g.gameState === 'FINAL' || g.gameState === 'OFF'
  );
  const futureGames = games.filter(
    (g) => g.gameState !== 'FINAL' && g.gameState !== 'OFF'
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Season Series</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-600">{awayAbbrev}</span>
          <span className="tabular-nums font-bold text-gray-900">
            {seriesWins.awayTeamWins}-{seriesWins.homeTeamWins}
          </span>
          <span className="font-semibold text-gray-600">{homeAbbrev}</span>
        </div>
      </div>

      <div className="space-y-2">
        {completedGames.map((game) => {
          const isCurrentGame = String(game.id) === currentGameId;
          const homeScore = game.homeTeam.score ?? 0;
          const awayScore = game.awayTeam.score ?? 0;
          const suffix = getOutcomeSuffix(game);

          const dateStr = new Date(game.gameDate + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          const content = (
            <div className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${
              isCurrentGame ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
            }`}>
              <span className="text-gray-400 w-14">{dateStr}</span>
              <div className="flex items-center gap-1.5 flex-1 justify-center">
                <img src={game.awayTeam.logo} alt={game.awayTeam.abbrev} className="w-5 h-5" />
                <span className={`tabular-nums ${awayScore > homeScore ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                  {awayScore}
                </span>
                <span className="text-gray-300 mx-0.5">-</span>
                <span className={`tabular-nums ${homeScore > awayScore ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                  {homeScore}
                </span>
                <img src={game.homeTeam.logo} alt={game.homeTeam.abbrev} className="w-5 h-5" />
              </div>
              <span className="text-gray-400 w-12 text-right">{suffix.trim() || 'REG'}</span>
            </div>
          );

          if (isCurrentGame) {
            return <div key={game.id}>{content}</div>;
          }

          return (
            <Link
              key={game.id}
              href={`/nhl/scores/${game.id}`}
              className="block transition-colors"
            >
              {content}
            </Link>
          );
        })}

        {futureGames.length > 0 && completedGames.length > 0 && (
          <div className="border-t border-gray-100 my-1" />
        )}

        {futureGames.map((game) => {
          const isCurrentGame = String(game.id) === currentGameId;
          const dateStr = new Date(game.gameDate + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          const content = (
            <div className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${
              isCurrentGame ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
            }`}>
              <span className="text-gray-400 w-14">{dateStr}</span>
              <div className="flex items-center gap-1.5 flex-1 justify-center">
                <img src={game.awayTeam.logo} alt={game.awayTeam.abbrev} className="w-5 h-5" />
                <span className="text-gray-400">@</span>
                <img src={game.homeTeam.logo} alt={game.homeTeam.abbrev} className="w-5 h-5" />
              </div>
              <span className="text-gray-400 w-12 text-right">TBD</span>
            </div>
          );

          if (isCurrentGame) {
            return <div key={game.id}>{content}</div>;
          }

          return (
            <Link
              key={game.id}
              href={`/nhl/scores/${game.id}`}
              className="block transition-colors"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
