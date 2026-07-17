'use client';

import { useState } from 'react';
import type { SeasonSummary } from '@/lib/utils/seasonSummary';
import { playoffResultText } from '@/lib/utils/seasonSummary';
import type { PreseasonInfo } from '@/lib/utils/seasonContext';
import { probabilityForFinalPoints } from '@/lib/utils/playoffProbability';
import { PlayoffOddsPill, CollapsibleOddsPanel } from '@/components/PlayoffOddsToggle';
import { TEAMS } from '@/lib/teamConfig';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  cardBackground?: string;
  accent: string;
  border: string;
  text: string;
}

interface PreseasonCardProps {
  preseason: PreseasonInfo;
  lastSeasonSummary: SeasonSummary | null;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
  teamName: string;
}

function teamNameFromAbbrev(abbrev: string): string {
  const team = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return team ? team.name : abbrev;
}

// Whole calendar days from today (Eastern) until a YYYY-MM-DD date.
function daysUntil(dateStr: string): number {
  const todayEastern = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const today = Date.parse(`${todayEastern}T00:00:00Z`);
  const target = Date.parse(`${dateStr}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

function formatOpenerDate(dateStr: string): string {
  // Render the calendar date without timezone drift by pinning to noon UTC.
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function PreseasonCard({
  preseason,
  lastSeasonSummary,
  teamColors,
  darkModeColors,
  isGoatMode,
  teamName,
}: PreseasonCardProps) {
  const { seasonLabel, totalGames, opener } = preseason;
  const [oddsExpanded, setOddsExpanded] = useState(false);

  const labelStyle = isGoatMode ? { color: darkModeColors.accent } : { color: teamColors.primary };
  const valueColor = isGoatMode ? 'text-white' : 'text-gray-900';
  const subColor = isGoatMode ? 'text-zinc-400' : 'text-gray-600';
  const accent = isGoatMode ? darkModeColors.accent : teamColors.primary;

  const countdown = opener ? daysUntil(opener.date) : null;
  const countdownLabel =
    countdown === null
      ? 'Schedule released'
      : countdown <= 0
        ? 'Season under way'
        : countdown === 1
          ? '1 day to puck drop'
          : `${countdown} days to puck drop`;

  const setCount = Math.ceil(totalGames / 5);
  const odds = preseason.odds;

  const tileClass = `rounded-xl p-2 md:p-3 border ${
    isGoatMode
      ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
      : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
  }`;
  const tileLabel = `text-xs font-semibold uppercase tracking-wide mb-1`;

  return (
    <div
      className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 ${
        isGoatMode ? '' : 'bg-white border-gray-200'
      }`}
      style={
        isGoatMode
          ? {
              backgroundColor: darkModeColors.cardBackground || darkModeColors.background,
              borderColor: darkModeColors.border,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className={`text-xl md:text-2xl font-bold ${valueColor}`}>
          {seasonLabel} Season Preview
        </h3>
        <span
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          {countdownLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3">
        {/* Opening Night */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Opening Night</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>
            {opener ? formatOpenerDate(opener.date) : '—'}
          </div>
          <div className={`text-xs mt-1 ${subColor}`}>
            {opener ? `${opener.isHome ? 'vs' : '@'} ${teamNameFromAbbrev(opener.opponent)}` : 'schedule TBA'}
          </div>
        </div>

        {/* Games */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Games</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>{totalGames}</div>
          <div className={`text-xs mt-1 ${subColor}`}>regular season</div>
        </div>

        {/* 5-Game Sets */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>5-Game Sets</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>{setCount}</div>
          <div className={`text-xs mt-1 ${subColor}`}>to track</div>
        </div>

        {/* Last Season */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Last Season</div>
          {lastSeasonSummary?.finalRecord ? (
            <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>
              {lastSeasonSummary.finalRecord.wins}-{lastSeasonSummary.finalRecord.losses}-{lastSeasonSummary.finalRecord.otLosses}
            </div>
          ) : (
            <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>—</div>
          )}
          <div className={`text-xs mt-1 ${subColor}`}>
            {lastSeasonSummary ? lastSeasonSummary.seasonLabel : 'prior season'}
          </div>
        </div>
      </div>

      {/* Way-too-early playoff odds — same pill + expand affordance as the live
          tracker, backed by the preseason projection. */}
      {odds ? (
        <>
          <div className="flex justify-center">
            <PlayoffOddsPill
              label="Way-Too-Early Playoff Odds"
              value={`${odds.playoffProbability}%`}
              expanded={oddsExpanded}
              onToggle={() => setOddsExpanded((v) => !v)}
              color={accent}
              size="sm"
            />
          </div>

          <CollapsibleOddsPanel expanded={oddsExpanded} isGoatMode={isGoatMode}>
            {/* Framing: make clear this is a preseason estimate, not live odds */}
            <div
              className="rounded-lg px-3 py-2 mb-3 text-xs md:text-sm"
              style={{ backgroundColor: `${accent}12`, color: accent }}
            >
              <span className="font-bold">Heads up — these are way-too-early preseason odds.</span>{' '}
              {lastSeasonSummary ? `${playoffResultText(lastSeasonSummary)} last season. ` : ''}
              This projects last season&apos;s pace regressed toward the league average and ignores roster moves; the live model takes over once games start.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Projected finish */}
              <div className={tileClass}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={tileLabel} style={labelStyle}>Projected Finish</div>
                    <div className={`text-lg md:text-xl font-bold ${valueColor}`}>
                      {odds.projectedPoints} pts
                    </div>
                    <div className={`text-xs ${subColor}`}>{odds.tier}</div>
                  </div>
                  <div
                    className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                    style={{ borderColor: accent, backgroundColor: `${accent}15`, borderWidth: '3px', borderStyle: 'solid' }}
                  >
                    <span className="text-base md:text-lg font-bold" style={{ color: accent }}>
                      {odds.playoffProbability}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Projected cut line */}
              <div className={tileClass}>
                <div className={tileLabel} style={labelStyle}>Projected Cut Line</div>
                <div className={`text-lg md:text-xl font-bold ${valueColor}`}>
                  ~{odds.cutLine} pts
                </div>
                <div className={`text-xs ${subColor}`}>
                  {odds.projectedPoints >= odds.cutLine
                    ? `${odds.projectedPoints - odds.cutLine} pts above the projected line`
                    : `${odds.cutLine - odds.projectedPoints} pts below the projected line`}
                </div>
              </div>
            </div>

            {/* Points -> odds breakdown, using the same shared curve as the live view */}
            <div className={`mt-4 pt-4 border-t border-dashed ${isGoatMode ? 'border-zinc-700' : 'border-gray-300'}`}>
              <p className={tileLabel} style={labelStyle}>
                If the {teamName} finish with...
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {(() => {
                  const anchor = Math.min(odds.cutLine, odds.projectedPoints) - 3;
                  const range = Array.from({ length: 8 }, (_, i) => anchor + i);
                  return range.map((pts) => {
                    const prob = probabilityForFinalPoints(pts, 0, odds.cutLine);
                    const isProjected = pts === odds.projectedPoints;
                    const isCutLine = pts === odds.cutLine;
                    return (
                      <div
                        key={pts}
                        className={`text-center px-2 py-2 rounded-lg border ${
                          isProjected
                            ? isGoatMode ? 'bg-zinc-700 border-zinc-600' : 'bg-blue-100 border-blue-200'
                            : isCutLine
                              ? isGoatMode ? 'bg-zinc-800/50 border-zinc-500' : 'bg-gray-50 border-gray-400'
                              : isGoatMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <p className={`text-xs ${isGoatMode ? 'text-zinc-500' : 'text-gray-500'}`}>{pts} pts</p>
                        <p className={`text-lg font-bold ${valueColor}`}>{prob}%</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </CollapsibleOddsPanel>
        </>
      ) : (
        <div
          className="rounded-lg px-3 py-2 text-sm md:text-base font-semibold text-center"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {`The ${seasonLabel} schedule is set. Track all ${setCount} five-game sets below.`}
        </div>
      )}
    </div>
  );
}
