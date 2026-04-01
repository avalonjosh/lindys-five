'use client';

import { useState, useEffect } from 'react';
import type { MLBSeriesRecord } from '@/lib/types/mlb';
import { fetchSeasonSeries } from '@/lib/services/mlbApi';

interface Props {
  awayTeamId: number;
  homeTeamId: number;
  awayAbbrev: string;
  homeAbbrev: string;
}

export default function MLBSeasonSeries({ awayTeamId, homeTeamId, awayAbbrev, homeAbbrev }: Props) {
  const [series, setSeries] = useState<MLBSeriesRecord | null>(null);

  useEffect(() => {
    const season = new Date().getFullYear();
    fetchSeasonSeries(awayTeamId, homeTeamId, season).then(setSeries);
  }, [awayTeamId, homeTeamId]);

  if (!series || (series.wins === 0 && series.losses === 0)) return null;

  const leader = series.wins > series.losses ? awayAbbrev : series.losses > series.wins ? homeAbbrev : 'Tied';
  const leadText = leader === 'Tied' ? `Tied ${series.wins}-${series.losses}` : `${leader} leads ${Math.max(series.wins, series.losses)}-${Math.min(series.wins, series.losses)}`;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900">Season Series</h3>
        <span className="text-sm font-semibold text-gray-600">{leadText}</span>
      </div>
      {series.games.length > 0 && (
        <div className="space-y-1.5">
          {series.games.map((game, i) => {
            const awayWon = game.awayScore > game.homeScore;
            return (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-20">{game.date}</span>
                <span className={`font-semibold ${awayWon ? 'text-gray-900' : 'text-gray-400'}`}>
                  {game.awayAbbrev} {game.awayScore}
                </span>
                <span className="text-gray-300 mx-2">-</span>
                <span className={`font-semibold ${!awayWon ? 'text-gray-900' : 'text-gray-400'}`}>
                  {game.homeAbbrev} {game.homeScore}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
