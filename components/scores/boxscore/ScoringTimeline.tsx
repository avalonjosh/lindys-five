'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ScoringPeriod, ScoringGoal } from '@/lib/types/boxscore';
import { TEAMS, TeamConfig } from '@/lib/teamConfig';

interface ScoringTimelineProps {
  scoring: ScoringPeriod[];
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

function timeToSeconds(time: string | undefined | null): number {
  if (!time) return 0;
  const [minutes, seconds] = time.split(':').map(Number);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return 0;
  return minutes * 60 + seconds;
}

function findTeamByAbbrev(abbrev: string): TeamConfig | undefined {
  return Object.values(TEAMS).find(
    (team) => team.abbreviation === abbrev
  );
}

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

/** Portal tooltip that positions itself relative to a marker element */
function GoalTooltip({
  goal,
  periodNumber,
  periodType,
  markerRect,
  homeTeamAbbrev,
  awayTeamAbbrev,
}: {
  goal: ScoringGoal;
  periodNumber: number;
  periodType: string;
  markerRect: DOMRect;
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const tooltipWidth = tooltip.offsetWidth;
    const viewportWidth = window.innerWidth;

    // Center below the marker
    let left = markerRect.left + markerRect.width / 2 - tooltipWidth / 2;
    const top = markerRect.bottom + window.scrollY + 8;

    // Clamp to viewport with 12px padding
    left = Math.max(12, Math.min(left, viewportWidth - tooltipWidth - 12));

    setPosition({ top, left });
  }, [markerRect]);

  const teamAbbrev = goal.teamAbbrev.default;
  const teamConfig = findTeamByAbbrev(teamAbbrev);
  const color = teamConfig?.colors.primary ?? '#6b7280';

  return createPortal(
    <div
      ref={tooltipRef}
      data-goal-tooltip
      className="fixed z-50 w-48 sm:w-52 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg"
      style={{ top: `${position.top}px`, left: `${position.left}px`, position: 'absolute' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold">
          {goal.firstName.default} {goal.lastName.default}
        </span>
      </div>
      {goal.assists.length > 0 && (
        <div className="mt-0.5 text-gray-300">
          Assists:{' '}
          {goal.assists
            .map((a) => `${a.firstName.default} ${a.lastName.default}`)
            .join(', ')}
        </div>
      )}
      <div className="mt-1 text-gray-400">
        {goal.timeInPeriod} &middot;{' '}
        {periodNumber <= 3
          ? `${['1st', '2nd', '3rd'][periodNumber - 1]} Period`
          : periodType === 'SO'
          ? 'Shootout'
          : 'OT'}
      </div>
      <div className="mt-0.5 font-medium">
        {awayTeamAbbrev} {goal.awayScore} - {homeTeamAbbrev} {goal.homeScore}
      </div>
      {goal.highlightClipSharingUrl && (
        <a
          href={goal.highlightClipSharingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block text-blue-400 hover:text-blue-300 transition-colors"
        >
          ▶ Watch highlight
        </a>
      )}
    </div>,
    document.body
  );
}

export default function ScoringTimeline({
  scoring,
  homeTeamAbbrev,
  awayTeamAbbrev,
}: ScoringTimelineProps) {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [activeMarkerRect, setActiveMarkerRect] = useState<DOMRect | null>(null);
  const [isClickLocked, setIsClickLocked] = useState(false);
  const markerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isClickLocked) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside tooltip or on a marker
      if (target.closest('[data-goal-tooltip]') || target.closest('[data-goal-marker]')) return;
      setActiveGoalId(null);
      setIsClickLocked(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isClickLocked]);

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

  // Keep original allGoals index for each goal so IDs match across lookups
  const regulationGoals = allGoals
    .map((g, i) => ({ ...g, allGoalsIndex: i }))
    .filter((g) => g.periodNumber <= 3);
  const otGoals = allGoals
    .map((g, i) => ({ ...g, allGoalsIndex: i }))
    .filter((g) => g.periodNumber > 3);

  if (allGoals.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">Game Flow</h3>
        <p className="text-sm text-gray-500">No goals scored</p>
      </div>
    );
  }

  function showGoal(id: string) {
    if (isClickLocked) return; // Don't override click-locked tooltip with hover
    const el = markerRefs.current.get(id);
    if (el) {
      setActiveMarkerRect(el.getBoundingClientRect());
    }
    setActiveGoalId(id);
  }

  function hideGoal(id: string) {
    if (isClickLocked) return; // Don't close click-locked tooltip on mouse leave
    setActiveGoalId((prev) => (prev === id ? null : prev));
  }

  const activeGoal = activeGoalId
    ? allGoals.find((g, i) => `${g.periodNumber}-${g.goal.timeInPeriod}-${g.goal.playerId}-${i}` === activeGoalId)
    : null;

  function renderGoalMarker(g: GoalWithMeta, index: number) {
    const teamAbbrev = g.goal.teamAbbrev.default;
    const teamConfig = findTeamByAbbrev(teamAbbrev);
    const color = teamConfig?.colors.primary ?? '#6b7280';

    const goalId = `${g.periodNumber}-${g.goal.timeInPeriod}-${g.goal.playerId}-${index}`;

    let leftPct: number;
    if (g.periodNumber <= 3) {
      leftPct = (g.positionMinutes / 60) * 100;
    } else {
      const otElapsed = g.positionMinutes - 60;
      leftPct = (otElapsed / 5) * 100;
    }
    leftPct = Math.max(1, Math.min(99, leftPct));

    return (
      <button
        key={goalId}
        ref={(el) => {
          if (el) markerRefs.current.set(goalId, el);
        }}
        onMouseEnter={() => showGoal(goalId)}
        onMouseLeave={() => hideGoal(goalId)}
        onClick={(e) => {
          e.stopPropagation();
          if (isClickLocked && activeGoalId === goalId) {
            setActiveGoalId(null);
            setIsClickLocked(false);
          } else {
            const el = markerRefs.current.get(goalId);
            if (el) setActiveMarkerRect(el.getBoundingClientRect());
            setActiveGoalId(goalId);
            setIsClickLocked(true);
          }
        }}
        data-goal-marker
        className="absolute z-10 h-3 w-3 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 focus:outline-none"
        style={{
          backgroundColor: color,
          left: `${leftPct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        aria-label={`Goal by ${g.goal.firstName.default} ${g.goal.lastName.default}`}
      />
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

      {/* Timeline bar */}
      <div className="flex w-full items-stretch">
        {/* Regulation bar */}
        <div
          className={`relative h-10 bg-gray-200 overflow-hidden ${hasOT ? 'rounded-l-lg' : 'rounded-lg'}`}
          style={{ width: `${hasOT ? 80 : 100}%` }}
        >
          <div className="absolute left-1/3 top-0 h-full w-px bg-white" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white" />

          {['1st', '2nd', '3rd'].map((label, i) => (
            <span
              key={label}
              className="absolute text-[10px] font-medium text-gray-400 select-none z-0"
              style={{
                left: `${(i * 100) / 3 + 100 / 6}%`,
                top: '3px',
                transform: 'translateX(-50%)',
              }}
            >
              {label}
            </span>
          ))}

          {regulationGoals.map((g) => renderGoalMarker(g, g.allGoalsIndex))}
        </div>

        {/* OT section */}
        {hasOT && (
          <div
            className="relative h-10 rounded-r-lg bg-gray-300 overflow-hidden"
            style={{ width: '20%' }}
          >
            <span
              className="absolute text-[10px] font-medium text-gray-500 select-none"
              style={{ left: '50%', top: '3px', transform: 'translateX(-50%)' }}
            >
              OT
            </span>
            {otGoals.map((g) => renderGoalMarker(g, g.allGoalsIndex))}
          </div>
        )}
      </div>

      {/* Time labels */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
        <span>0:00</span>
        <span>20:00</span>
        <span>40:00</span>
        <span>60:00</span>
        {hasOT && <span>OT</span>}
      </div>

      {/* Portal tooltip - renders into document.body, outside all overflow containers */}
      {activeGoal && activeMarkerRect && (
        <GoalTooltip
          goal={activeGoal.goal}
          periodNumber={activeGoal.periodNumber}
          periodType={activeGoal.periodType}
          markerRect={activeMarkerRect}
          homeTeamAbbrev={homeTeamAbbrev}
          awayTeamAbbrev={awayTeamAbbrev}
        />
      )}
    </div>
  );
}
