'use client';

import type { MLBScoringPlay } from '@/lib/types/mlb';

interface Props {
  plays: MLBScoringPlay[];
  awayAbbrev: string;
  homeAbbrev: string;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function MLBScoringPlays({ plays, awayAbbrev, homeAbbrev }: Props) {
  if (plays.length === 0) return null;

  // Group by inning
  const byInning = new Map<string, MLBScoringPlay[]>();
  plays.forEach(play => {
    const key = `${play.halfInning === 'top' ? 'Top' : 'Bottom'} ${ordinal(play.inning)}`;
    if (!byInning.has(key)) byInning.set(key, []);
    byInning.get(key)!.push(play);
  });

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-bold text-gray-900">Scoring Plays</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {Array.from(byInning.entries()).map(([inningLabel, inningPlays]) => (
          <div key={inningLabel}>
            <div className="px-4 py-2 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
              {inningLabel}
            </div>
            {inningPlays.map((play, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{play.description}</p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-xs font-bold text-gray-900">
                    {awayAbbrev} {play.awayScore}, {homeAbbrev} {play.homeScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
