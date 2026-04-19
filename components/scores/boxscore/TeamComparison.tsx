'use client';

import { TeamGameStat } from '@/lib/types/boxscore';
import { TEAMS, TeamConfig } from '@/lib/teamConfig';

interface TeamComparisonProps {
  teamGameStats?: TeamGameStat[];
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

function getTeamByAbbrev(abbrev: string): TeamConfig | undefined {
  return Object.values(TEAMS).find(
    (t) => t.abbreviation.toUpperCase() === abbrev.toUpperCase()
  );
}

const STAT_DISPLAY_NAMES: Record<string, string> = {
  sog: 'Shots',
  faceoffWinningPctg: 'Faceoff %',
  powerPlay: 'Power Play',
  pim: 'Penalties',
  hits: 'Hits',
  blockedShots: 'Blocked Shots',
  giveaways: 'Giveaways',
  takeaways: 'Takeaways',
};

const STAT_ORDER = [
  'sog',
  'faceoffWinningPctg',
  'powerPlay',
  'pim',
  'hits',
  'blockedShots',
  'giveaways',
  'takeaways',
];

/**
 * Parse a stat value to a numeric value for bar comparison.
 * - "2/5" (power play) -> 2 (successes)
 * - "52.3" (faceoff %) -> 52.3
 * - "14" -> 14
 */
function parseStatValue(value: string | undefined | null): number {
  if (!value) return 0;
  if (value.includes('/')) {
    const parts = value.split('/');
    return parseFloat(parts[0]) || 0;
  }
  return parseFloat(value) || 0;
}

export default function TeamComparison({
  teamGameStats,
  homeTeamAbbrev,
  awayTeamAbbrev,
}: TeamComparisonProps) {
  if (!teamGameStats || teamGameStats.length === 0) return null;

  const homeTeam = getTeamByAbbrev(homeTeamAbbrev);
  const awayTeam = getTeamByAbbrev(awayTeamAbbrev);
  const homeColor = homeTeam?.colors.primary ?? '#3b82f6';
  const awayColor = awayTeam?.colors.primary ?? '#ef4444';

  // Filter and order stats
  const filteredStats = STAT_ORDER.reduce<TeamGameStat[]>((acc, category) => {
    const stat = teamGameStats.find((s) => s.category === category);
    if (stat) acc.push(stat);
    return acc;
  }, []);

  // If none of the expected stats are found, show all stats
  const statsToShow =
    filteredStats.length > 0 ? filteredStats : teamGameStats;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Team Stats</h2>

      {/* Team headers */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-sm font-semibold text-gray-700">
          {awayTeamAbbrev}
        </span>
        <span className="text-sm font-semibold text-gray-700">
          {homeTeamAbbrev}
        </span>
      </div>

      <div className="space-y-4">
        {statsToShow.map((stat) => {
          const displayName =
            STAT_DISPLAY_NAMES[stat.category] ?? stat.category;
          const awayNum = parseStatValue(stat.awayValue);
          const homeNum = parseStatValue(stat.homeValue);
          const total = awayNum + homeNum;

          // Calculate percentages; default to 50/50 if both zero
          let awayPct = 50;
          let homePct = 50;
          if (total > 0) {
            awayPct = (awayNum / total) * 100;
            homePct = (homeNum / total) * 100;
          }

          // Ensure minimum bar width for visibility
          const minPct = 8;
          if (awayPct < minPct && total > 0) {
            awayPct = minPct;
            homePct = 100 - minPct;
          } else if (homePct < minPct && total > 0) {
            homePct = minPct;
            awayPct = 100 - minPct;
          }

          const awayBold = awayNum > homeNum;
          const homeBold = homeNum > awayNum;

          return (
            <div key={stat.category}>
              {/* Stat label centered */}
              <p className="text-xs text-gray-500 text-center mb-1.5">
                {displayName}
              </p>

              {/* Values + bar */}
              <div className="flex items-center gap-3">
                {/* Away value */}
                <span
                  className={`text-sm w-12 text-right shrink-0 ${
                    awayBold
                      ? 'font-bold text-gray-900'
                      : 'font-medium text-gray-500'
                  }`}
                >
                  {stat.awayValue}
                </span>

                {/* Comparison bar */}
                <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                  <div
                    className="h-full rounded-l-full transition-all duration-500"
                    style={{
                      width: `${awayPct}%`,
                      backgroundColor: awayColor,
                      opacity: awayBold ? 1 : 0.5,
                    }}
                  />
                  <div
                    className="h-full rounded-r-full transition-all duration-500"
                    style={{
                      width: `${homePct}%`,
                      backgroundColor: homeColor,
                      opacity: homeBold ? 1 : 0.5,
                    }}
                  />
                </div>

                {/* Home value */}
                <span
                  className={`text-sm w-12 shrink-0 ${
                    homeBold
                      ? 'font-bold text-gray-900'
                      : 'font-medium text-gray-500'
                  }`}
                >
                  {stat.homeValue}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
