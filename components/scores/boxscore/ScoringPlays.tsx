'use client';

import { ScoringPeriod } from '@/lib/types/boxscore';
import { TEAMS, TeamConfig } from '@/lib/teamConfig';

interface ScoringPlaysProps {
  scoring: ScoringPeriod[];
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

function getTeamByAbbrev(abbrev: string): TeamConfig | undefined {
  return Object.values(TEAMS).find(
    (t) => t.abbreviation.toUpperCase() === abbrev.toUpperCase()
  );
}

function getPeriodLabel(period: { number: number; periodType: string }): string {
  if (period.periodType === 'OT') return 'Overtime';
  if (period.periodType === 'SO') return 'Shootout';
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
  return `${ordinals[period.number - 1] ?? `${period.number}th`} Period`;
}

export default function ScoringPlays({
  scoring,
  homeTeamAbbrev,
  awayTeamAbbrev,
}: ScoringPlaysProps) {
  const totalGoals = scoring.reduce((sum, p) => sum + p.goals.length, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Scoring Summary</h2>

      {totalGoals === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No goals scored
        </p>
      ) : (
        <div className="space-y-5">
          {scoring.map((period) => {
            if (period.goals.length === 0) return null;
            return (
              <div key={period.periodDescriptor.number}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {getPeriodLabel(period.periodDescriptor)}
                </h3>
                <div className="space-y-3">
                  {period.goals.map((goal, idx) => {
                    const teamConfig = getTeamByAbbrev(
                      goal.teamAbbrev.default
                    );
                    const borderColor =
                      teamConfig?.colors.primary ?? '#6b7280';
                    const isEmptyNet =
                      goal.situationCode?.includes('EN') ||
                      goal.strength === 'en';

                    return (
                      <div
                        key={`${period.periodDescriptor.number}-${idx}`}
                        className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5"
                        style={{ borderLeft: `4px solid ${borderColor}` }}
                      >
                        {/* Time */}
                        <span className="text-xs font-mono font-semibold text-gray-500 w-12 shrink-0">
                          {goal.timeInPeriod}
                        </span>

                        {/* Headshot */}
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                          {goal.headshot ? (
                            <img
                              src={goal.headshot}
                              alt={`${goal.firstName.default} ${goal.lastName.default}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              ?
                            </div>
                          )}
                        </div>

                        {/* Player info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">
                              {goal.firstName.default} {goal.lastName.default}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({goal.goalsToDate})
                            </span>

                            {/* Strength badges */}
                            {goal.strength === 'pp' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                                PP
                              </span>
                            )}
                            {goal.strength === 'sh' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                SH
                              </span>
                            )}
                            {isEmptyNet && goal.strength !== 'pp' && goal.strength !== 'sh' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                                EN
                              </span>
                            )}
                          </div>

                          {/* Assists */}
                          {goal.assists.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {goal.assists
                                .map(
                                  (a) =>
                                    `${a.firstName.default} ${a.lastName.default} (${a.assistsToDate})`
                                )
                                .join(', ')}
                            </p>
                          )}
                          {goal.assists.length === 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Unassisted
                            </p>
                          )}
                        </div>

                        {/* Score after goal + video */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-gray-800">
                            {goal.awayScore} - {goal.homeScore}
                          </span>

                          {goal.highlightClipSharingUrl && (
                            <a
                              href={goal.highlightClipSharingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                              title="Watch highlight"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
