'use client';

import { ThreeStar } from '@/lib/types/boxscore';
import { TEAMS, TeamConfig } from '@/lib/teamConfig';

interface ThreeStarsProps {
  threeStars?: ThreeStar[];
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

function getTeamByAbbrev(abbrev: string | undefined): TeamConfig | undefined {
  if (!abbrev) return undefined;
  return Object.values(TEAMS).find(
    (t) => t.abbreviation.toUpperCase() === abbrev.toUpperCase()
  );
}

function getStarLabel(star: number): string {
  switch (star) {
    case 1:
      return '1st Star';
    case 2:
      return '2nd Star';
    case 3:
      return '3rd Star';
    default:
      return `${star}th Star`;
  }
}

export default function ThreeStars({
  threeStars,
  homeTeamAbbrev,
  awayTeamAbbrev,
}: ThreeStarsProps) {
  if (!threeStars || threeStars.length === 0) return null;

  const sorted = [...threeStars].sort((a, b) => a.star - b.star);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Three Stars</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sorted.map((star) => {
          const teamConfig = getTeamByAbbrev(star.teamAbbrev.default);
          const accentColor = teamConfig?.colors.primary ?? '#6b7280';

          return (
            <div
              key={star.star}
              className="relative rounded-lg bg-gray-50 p-4 overflow-hidden"
              style={{ borderLeft: `4px solid ${accentColor}` }}
            >
              {/* Star label */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-yellow-400 text-sm">
                  {'★'.repeat(Math.min(star.star, 3))}
                </span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {getStarLabel(star.star)}
                </span>
              </div>

              {/* Player info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
                  {star.headshot ? (
                    <img
                      src={star.headshot}
                      alt={star.name.default}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      ?
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {star.firstName?.default && star.lastName?.default
                      ? `${star.firstName.default} ${star.lastName.default}`
                      : star.name?.default ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {star.position} &middot; #{star.sweaterNo}
                  </p>
                </div>
              </div>

              {/* Stat line */}
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="font-semibold text-gray-700">
                  {star.goals}G
                </span>
                <span className="font-semibold text-gray-700">
                  {star.assists}A
                </span>
                <span className="font-bold text-gray-900">
                  {star.points}PTS
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
