'use client';

import type { SkaterComparison } from '@/lib/types/boxscore';

interface SkaterMatchupProps {
  skaterComparison: SkaterComparison;
  homeAbbrev: string;
  awayAbbrev: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  points: 'Points',
  goals: 'Goals',
  assists: 'Assists',
};

export default function SkaterMatchup({
  skaterComparison,
  homeAbbrev,
  awayAbbrev,
}: SkaterMatchupProps) {
  if (!skaterComparison?.leaders || skaterComparison.leaders.length === 0) return null;
  const renderable = skaterComparison.leaders.filter((l) => l.awayLeader && l.homeLeader);
  if (renderable.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Player Matchup</h3>
        <span className="text-xs text-gray-400">Last 5 Games</span>
      </div>

      {/* Team headers */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-bold text-gray-600">{awayAbbrev}</span>
        <span className="text-xs font-bold text-gray-600">{homeAbbrev}</span>
      </div>

      <div className="space-y-4">
        {renderable.map((leader) => {
          const { category, awayLeader, homeLeader } = leader;
          const label = CATEGORY_LABELS[category] || category;
          const awayWins = awayLeader.value > homeLeader.value;
          const homeWins = homeLeader.value > awayLeader.value;

          return (
            <div key={category}>
              <p className="text-xs text-gray-400 text-center mb-2 uppercase tracking-wide font-medium">
                {label}
              </p>
              <div className="flex items-center justify-between gap-3">
                {/* Away player */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img
                    src={awayLeader.headshot}
                    alt={awayLeader.name.default}
                    className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {awayLeader.lastName.default}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      #{awayLeader.sweaterNumber} {awayLeader.positionCode}
                    </p>
                  </div>
                </div>

                {/* Values */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-lg tabular-nums ${awayWins ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}>
                    {awayLeader.value}
                  </span>
                  <span className="text-xs text-gray-300">vs</span>
                  <span className={`text-lg tabular-nums ${homeWins ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}>
                    {homeLeader.value}
                  </span>
                </div>

                {/* Home player */}
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <div className="min-w-0 text-right">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {homeLeader.lastName.default}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      #{homeLeader.sweaterNumber} {homeLeader.positionCode}
                    </p>
                  </div>
                  <img
                    src={homeLeader.headshot}
                    alt={homeLeader.name.default}
                    className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
