'use client';

import { useState } from 'react';
import { ScoringPeriod, ScoringGoal } from '@/lib/types/boxscore';
import { TEAMS, TeamConfig } from '@/lib/teamConfig';

interface ScoringTimelineProps {
  scoring: ScoringPeriod[];
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

/** Convert "MM:SS" time string to total seconds */
function timeToSeconds(time: string): number {
  const [minutes, seconds] = time.split(':').map(Number);
  return minutes * 60 + seconds;
}

/** Find a team config by its abbreviation */
function findTeamByAbbrev(abbrev: string): TeamConfig | undefined {
  return Object.values(TEAMS).find(
    (team) => team.abbreviation === abbrev
  );
}

/** Calculate the position of a goal as a percentage of the regulation timeline (0-60 min).
 *  For OT goals, returns a value > 100 which is handled separately. */
function goalPositionMinutes(periodNumber: number, timeInPeriod: string): number {
  const elapsedSeconds = timeToSeconds(timeInPeriod);
  const elapsedMinutes = elapsedSeconds / 60;
  const periodStartMinutes = (periodNumber - 1) * 20;
  return periodStartMinutes + elapsedMinutes;
}

interface GoalWithMeta {
  goal: ScoringGoal;
  periodNumber: number;
  periodType: string;
  positionMinutes: number;
}

export default function ScoringTimeline({
  scoring,
  homeTeamAbbrev,
  awayTeamAbbrev,
}: ScoringTimelineProps) {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);

  // Flatten all goals with metadata
  const allGoals: GoalWithMeta[] = scoring.flatMap((period) =>
    period.goals.map((goal) => ({
      goal,
      periodNumber: period.periodDescriptor.number,
      periodType: period.periodDescriptor.periodType,
      positionMinutes: goalPositionMinutes(
        period.periodDescriptor.number,
        goal.timeInPeriod
      ),
    }))
  );

  const hasOT = allGoals.some((g) => g.periodNumber > 3);
  const regulationGoals = allGoals.filter((g) => g.periodNumber <= 3);
  const otGoals = allGoals.filter((g) => g.periodNumber > 3);

  // Regulation is 60 minutes. OT section gets a fixed visual width ratio.
  const regulationWidthPct = hasOT ? 80 : 100;
  const otWidthPct = hasOT ? 20 : 0;

  const noGoals = allGoals.length === 0;

  if (noGoals) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">Game Flow</h3>
        <p className="text-sm text-gray-500">No goals scored</p>
      </div>
    );
  }

  function toggleGoal(id: string) {
    setActiveGoalId((prev) => (prev === id ? null : id));
  }

  function renderGoalMarker(g: GoalWithMeta, index: number) {
    const teamAbbrev = g.goal.teamAbbrev.default;
    const teamConfig = findTeamByAbbrev(teamAbbrev);
    const color = teamConfig?.colors.primary ?? '#6b7280';
    const isHome = teamAbbrev === homeTeamAbbrev;

    // Unique id for tooltip toggling
    const goalId = `${g.periodNumber}-${g.goal.timeInPeriod}-${g.goal.playerId}-${index}`;
    const isActive = activeGoalId === goalId;

    // Position within the regulation bar (0-100% of regulation section)
    let leftPct: number;
    if (g.periodNumber <= 3) {
      leftPct = (g.positionMinutes / 60) * 100;
    } else {
      // OT goals: position within the OT section (5 min OT)
      const otElapsed = g.positionMinutes - 60;
      leftPct = (otElapsed / 5) * 100;
    }

    // Clamp
    leftPct = Math.max(1, Math.min(99, leftPct));

    return (
      <div
        key={goalId}
        className="absolute z-10"
        style={{ left: `${leftPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Marker */}
        <button
          onClick={() => toggleGoal(goalId)}
          className="block h-3 w-3 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 focus:outline-none"
          style={{ backgroundColor: color }}
          aria-label={`Goal by ${g.goal.firstName.default} ${g.goal.lastName.default}`}
        />

        {/* Tooltip */}
        {isActive && (
          <div
            className="absolute z-20 left-1/2 -translate-x-1/2 top-4 w-48 sm:w-52 max-w-[calc(100vw-2rem)] rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg"
          >
            <div className="font-semibold">
              {g.goal.firstName.default} {g.goal.lastName.default}
            </div>
            {g.goal.assists.length > 0 && (
              <div className="mt-0.5 text-gray-300">
                Assists:{' '}
                {g.goal.assists
                  .map((a) => `${a.firstName.default} ${a.lastName.default}`)
                  .join(', ')}
              </div>
            )}
            <div className="mt-1 text-gray-400">
              {g.goal.timeInPeriod} &middot;{' '}
              {g.periodNumber <= 3
                ? `${['1st', '2nd', '3rd'][g.periodNumber - 1]} Period`
                : g.periodType === 'SO'
                ? 'Shootout'
                : 'OT'}
            </div>
            <div className="mt-0.5 font-medium">
              {awayTeamAbbrev} {g.goal.awayScore} - {homeTeamAbbrev} {g.goal.homeScore}
            </div>
            {g.goal.highlightClipSharingUrl && (
              <a
                href={g.goal.highlightClipSharingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block text-blue-400 underline hover:text-blue-300"
                onClick={(e) => e.stopPropagation()}
              >
                Watch highlight
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-3 sm:p-5 shadow-sm overflow-hidden">
      <h3 className="mb-4 text-lg font-bold text-gray-900">Game Flow</h3>

      {/* Team legend */}
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-600">
        {[awayTeamAbbrev, homeTeamAbbrev].map((abbrev) => {
          const team = findTeamByAbbrev(abbrev);
          return (
            <div key={abbrev} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: team?.colors.primary ?? '#6b7280' }}
              />
              <span className="font-medium">{abbrev}</span>
            </div>
          );
        })}
      </div>

      {/* Timeline container */}
      <div className="flex w-full items-stretch">
        {/* Regulation bar */}
        <div
          className="relative h-10 rounded-l-lg bg-gray-200"
          style={{ width: `${regulationWidthPct}%` }}
        >
          {/* Period dividers */}
          <div className="absolute left-1/3 top-0 h-full w-px bg-white" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white" />

          {/* Period labels */}
          {['1st', '2nd', '3rd'].map((label, i) => (
            <span
              key={label}
              className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-400 select-none z-0"
              style={{
                left: `${(i * 100) / 3 + 100 / 6}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {label}
            </span>
          ))}

          {/* Regulation goal markers */}
          {regulationGoals.map((g, i) => renderGoalMarker(g, i))}
        </div>

        {/* OT section */}
        {hasOT && (
          <div
            className="relative h-10 rounded-r-lg bg-gray-300"
            style={{ width: `${otWidthPct}%` }}
          >
            {/* OT label */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-500 select-none">
              OT
            </span>

            {/* OT goal markers */}
            {otGoals.map((g, i) => renderGoalMarker(g, i))}
          </div>
        )}

        {/* Round right side if no OT */}
        {!hasOT && (
          <div className="h-10 w-0 rounded-r-lg bg-gray-200" />
        )}
      </div>

      {/* Row labels */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
        <span>0:00</span>
        <span>20:00</span>
        <span>40:00</span>
        <span>60:00</span>
        {hasOT && <span>OT</span>}
      </div>
    </div>
  );
}
