'use client';

import { useState, useEffect } from 'react';
import type { MLBRecentGame } from '@/lib/types/mlb';
import { fetchRecentGames } from '@/lib/services/mlbApi';

interface Props {
  awayTeamId: number;
  homeTeamId: number;
  awayAbbrev: string;
  homeAbbrev: string;
}

function FormRow({ abbrev, games }: { abbrev: string; games: MLBRecentGame[] }) {
  const wins = games.filter(g => g.won).length;
  const losses = games.length - wins;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-gray-900">{abbrev}</span>
        <span className="text-xs text-gray-500">{wins}-{losses} last {games.length}</span>
      </div>
      <div className="flex gap-1">
        {games.map((game, i) => (
          <div
            key={i}
            className={`flex-1 h-7 rounded flex items-center justify-center text-[10px] font-bold text-white ${
              game.won ? 'bg-emerald-500' : 'bg-red-400'
            }`}
            title={`${game.won ? 'W' : 'L'} ${game.teamScore}-${game.oppScore} vs ${game.opponent} (${game.date})`}
          >
            {game.won ? 'W' : 'L'}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MLBRecentForm({ awayTeamId, homeTeamId, awayAbbrev, homeAbbrev }: Props) {
  const [awayGames, setAwayGames] = useState<MLBRecentGame[]>([]);
  const [homeGames, setHomeGames] = useState<MLBRecentGame[]>([]);

  useEffect(() => {
    const season = new Date().getFullYear();
    fetchRecentGames(awayTeamId, season, 10).then(setAwayGames);
    fetchRecentGames(homeTeamId, season, 10).then(setHomeGames);
  }, [awayTeamId, homeTeamId]);

  if (awayGames.length === 0 && homeGames.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 md:p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Form</h3>
      {awayGames.length > 0 && <FormRow abbrev={awayAbbrev} games={awayGames} />}
      {homeGames.length > 0 && <FormRow abbrev={homeAbbrev} games={homeGames} />}
    </div>
  );
}
