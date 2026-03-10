'use client';

import { useMemo } from 'react';
import type { PenaltyPeriod } from '@/lib/types/boxscore';
import { TEAMS } from '@/lib/teamConfig';

interface PenaltySummaryProps {
  penalties: PenaltyPeriod[];
  homeAbbrev: string;
  awayAbbrev: string;
}

function getTeamColor(abbrev: string): string {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.colors.primary ?? '#6b7280';
}

function formatDescKey(descKey: string): string {
  return descKey
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getPeriodLabel(periodNumber: number, periodType: string): string {
  if (periodType === 'OT') return 'Overtime';
  if (periodType === 'SO') return 'Shootout';
  return `Period ${periodNumber}`;
}

export default function PenaltySummary({ penalties, homeAbbrev, awayAbbrev }: PenaltySummaryProps) {
  const teamColors = useMemo(
    () => ({
      [homeAbbrev]: getTeamColor(homeAbbrev),
      [awayAbbrev]: getTeamColor(awayAbbrev),
    }),
    [homeAbbrev, awayAbbrev]
  );

  if (!penalties || penalties.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 text-base">Penalties</h3>
        </div>
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          No penalties in this game
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-bold text-gray-900 text-base">Penalties</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {penalties.map(period => {
          const label = getPeriodLabel(
            period.periodDescriptor.number,
            period.periodDescriptor.periodType
          );

          return (
            <div key={`${period.periodDescriptor.number}-${period.periodDescriptor.periodType}`}>
              {/* Period header */}
              <div className="px-4 py-2 bg-gray-50">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {label}
                </span>
              </div>

              {period.penalties.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">No penalties</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {period.penalties.map((penalty, idx) => {
                    const teamAbbrev = penalty.teamAbbrev.default;
                    const dotColor = teamColors[teamAbbrev] ?? '#6b7280';

                    return (
                      <div
                        key={`${period.periodDescriptor.number}-${idx}`}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Time */}
                        <span className="text-xs tabular-nums text-gray-500 w-11 shrink-0">
                          {penalty.timeInPeriod}
                        </span>

                        {/* Team color dot */}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                          title={teamAbbrev}
                        />

                        {/* Player and infraction */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">
                            {penalty.committedByPlayer
                              ? `${penalty.committedByPlayer.firstName.default} ${penalty.committedByPlayer.lastName.default}`
                              : 'Bench'}
                          </span>
                          <span className="text-sm text-gray-500 ml-1.5">
                            {formatDescKey(penalty.descKey)}
                          </span>
                        </div>

                        {/* Duration */}
                        <span className="text-xs tabular-nums text-gray-500 shrink-0">
                          {penalty.duration} min
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
