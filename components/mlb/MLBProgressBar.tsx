'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MLBSeasonStats, MLBStandingsTeam } from '@/lib/types/mlb';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import {
  getMLBPlayoffProbability,
  probabilityForFinalWins,
} from '@/lib/utils/mlbStandingsCalc';

interface MLBProgressBarProps {
  stats: MLBSeasonStats;
  teamColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  teamAbbrev?: string;
  teamName?: string;
}

interface CutLineState {
  probability: number;
  divCutLine: number;
  wcCutLine: number;
  activePath: 'division' | 'wildcard';
  effectiveCutLine: number;
  divBubbleAbbrev: string;
  wcBubbleAbbrev: string;
}

function deriveCutLineState(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): CutLineState {
  const { probability, divCutLine, wcCutLine, activePath } = getMLBPlayoffProbability(team, standings);

  // Division bubble: if team is the leader, bubble is 2nd; else bubble is the leader they're chasing
  const divTeams = standings
    .filter(t => t.division === team.division)
    .sort((a, b) => b.wins - a.wins);
  const isLeader = divTeams[0]?.teamAbbrev === team.teamAbbrev;
  const divBubble = isLeader ? divTeams[1] : divTeams[0];

  // Wild card bubble: first team out of WC (the 4th non-division-winner in the league)
  const leagueTeams = standings.filter(t => t.league === team.league);
  const divisions = Array.from(new Set(leagueTeams.map(t => t.division)));
  const divWinners = new Set(
    divisions
      .map(d => leagueTeams.filter(t => t.division === d).sort((a, b) => b.wins - a.wins)[0])
      .filter(Boolean)
      .map(t => t!.teamAbbrev)
  );
  const wcContenders = leagueTeams
    .filter(t => !divWinners.has(t.teamAbbrev))
    .sort((a, b) => b.wins - a.wins);
  // If team is already in the top 3, bubble is WC4 (first team out). Otherwise bubble is WC3 (last team in).
  const teamWcIdx = wcContenders.findIndex(t => t.teamAbbrev === team.teamAbbrev);
  const wcBubble = teamWcIdx >= 0 && teamWcIdx < 3 ? wcContenders[3] : wcContenders[2];

  return {
    probability,
    divCutLine,
    wcCutLine,
    activePath,
    effectiveCutLine: activePath === 'division' ? divCutLine : wcCutLine,
    divBubbleAbbrev: divBubble?.teamAbbrev || '',
    wcBubbleAbbrev: wcBubble?.teamAbbrev || '',
  };
}

export default function MLBProgressBar({ stats, teamColors, teamAbbrev, teamName }: MLBProgressBarProps) {
  const { totalWins, totalLosses, gamesPlayed, gamesRemaining, winPct, projectedWins, playoffTarget, totalGames } = stats;

  const currentProgress = playoffTarget > 0 ? (totalWins / playoffTarget) * 100 : 0;
  const expectedWinsAtThisPoint = totalGames > 0 ? (gamesPlayed / totalGames) * playoffTarget : 0;
  const expectedProgress = playoffTarget > 0 ? (expectedWinsAtThisPoint / playoffTarget) * 100 : 0;

  const currentPace = gamesPlayed > 0 ? (totalWins / gamesPlayed).toFixed(3) : '0';
  const neededPace = totalGames > 0 ? (playoffTarget / totalGames).toFixed(3) : '0';

  const winsDifference = totalWins - expectedWinsAtThisPoint;
  const indicatorColor = winsDifference >= -0.05 ? 'border-t-green-500' : 'border-t-red-500';

  const [playoffExpanded, setPlayoffExpanded] = useState(false);
  const [standings, setStandings] = useState<MLBStandingsTeam[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState(false);

  // Fetch standings client-side when team has played at least 10 games (avoids noisy projections too early)
  useEffect(() => {
    if (!teamAbbrev || standings.length > 0 || standingsLoading || standingsError) return;
    if (gamesPlayed < 10) return;
    setStandingsLoading(true);
    fetchMLBStandings()
      .then(setStandings)
      .catch(() => setStandingsError(true))
      .finally(() => setStandingsLoading(false));
  }, [teamAbbrev, gamesPlayed, standings.length, standingsLoading, standingsError]);

  const userTeam = teamAbbrev ? standings.find(t => t.teamAbbrev === teamAbbrev) : undefined;
  const cutLineData: CutLineState | null = userTeam ? deriveCutLineState(userTeam, standings) : null;
  const probability = cutLineData?.probability;
  const showProbabilityRow = teamAbbrev && gamesPlayed >= 10;
  const probabilityLabel = standingsLoading
    ? '--%'
    : probability !== undefined
      ? `${probability}%`
      : '--%';

  const probabilityColor = teamColors.primary;
  const shortName = teamName ? teamName.split(' ').pop() : 'Team';

  return (
    <div className="rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 relative bg-white" style={{ borderColor: '#e5e7eb' }}>
      {/* Header row with title + centered playoff probability link (desktop) */}
      <div className="relative flex items-center justify-between gap-2 mb-2 md:mb-3">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900">
          Season Progress
        </h3>

        {/* Desktop centered probability link */}
        {showProbabilityRow && (
          <div className="hidden md:flex absolute inset-0 justify-center items-center pointer-events-none">
            <button
              onClick={() => setPlayoffExpanded(!playoffExpanded)}
              className="flex items-center gap-1 text-sm font-semibold transition-all focus:outline-none pointer-events-auto"
              style={{ color: probabilityColor }}
              title={playoffExpanded ? 'Hide playoff details' : 'Show playoff details'}
            >
              <span className={playoffExpanded ? 'underline decoration-2 underline-offset-2' : ''}>
                Playoff Probability: {probabilityLabel}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${playoffExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Games Played
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{gamesPlayed}</div>
          <div className="text-xs text-gray-600 mt-1">{gamesRemaining} remaining</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Current Wins
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{totalWins}</div>
          <div className="text-xs text-gray-600 mt-1">
            {totalWins}-{totalLosses} ({gamesPlayed > 0 ? `${(winPct * 100).toFixed(1)}%` : '—'})
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Win Pace
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{currentPace}</div>
          <div className="text-xs text-gray-600 mt-1">wins/game (need {neededPace})</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Projected
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">
            {gamesPlayed > 0 ? projectedWins : '—'}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {gamesPlayed > 0 ? `season total (need ${playoffTarget})` : '—'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {gamesPlayed > 0 && (
        <div className="mb-4">
          <div className="flex justify-end text-sm font-semibold mb-2 text-gray-700">
            <span>{currentProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full rounded-full h-8 relative shadow-inner bg-gray-200">
            <div
              className="h-8 rounded-l-full transition-all duration-500 relative shadow-md flex items-center justify-end"
              style={{ width: `${Math.max(Math.min(currentProgress, 100), 5)}%`, backgroundColor: teamColors.primary }}
            >
              {currentProgress > 0 && (
                <span className="pr-1.5 md:pr-3 text-[10px] md:text-sm font-bold text-white whitespace-nowrap">
                  {totalWins}
                </span>
              )}
            </div>

            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{ left: `calc(${Math.max(Math.min(expectedProgress, 100), currentProgress < expectedProgress ? Math.max(currentProgress, 5) + 2 : 0)}% - 4px)` }}
            >
              <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent -mb-px ${indicatorColor}`} />
              {currentProgress <= expectedProgress && (
                <div className="w-0.5 h-8 bg-white shadow-sm" />
              )}
            </div>
          </div>

          <div className="mt-2 text-xs flex items-center gap-1 text-gray-600">
            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent ${indicatorColor}`} />
            <span>
              <span className="font-semibold">Expected:</span> {expectedWinsAtThisPoint.toFixed(1)} wins
            </span>
          </div>
        </div>
      )}

      {/* Mobile: probability link at bottom */}
      {showProbabilityRow && (
        <div className="flex md:hidden justify-center mt-3">
          <button
            onClick={() => setPlayoffExpanded(!playoffExpanded)}
            className="flex items-center gap-1 text-xs font-semibold transition-all focus:outline-none"
            style={{ color: probabilityColor }}
            title={playoffExpanded ? 'Hide playoff details' : 'Show playoff details'}
          >
            <span className={playoffExpanded ? 'underline decoration-2 underline-offset-2' : ''}>
              Playoff Probability: {probabilityLabel}
            </span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${playoffExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      )}

      {/* Expandable Playoff Probability Section */}
      {showProbabilityRow && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            playoffExpanded ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t-2 border-dashed border-gray-300 mb-4" />

          {standingsLoading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading playoff details…</p>
          ) : standingsError || !cutLineData ? (
            <p className="text-sm text-gray-500 text-center py-4">
              {gamesPlayed < 10 ? 'Available after 10 games' : 'Unable to load standings'}
            </p>
          ) : (
            <>
              {/* Two-column layout: Active cut line + Lindy's Five target */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Active Cut Line card */}
                <div className="rounded-lg p-3 border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide mb-1 text-gray-500">
                        {cutLineData.activePath === 'division' ? 'Division Cut Line' : 'Wild Card Cut Line'}
                      </p>
                      {(() => {
                        const winsNeeded = Math.max(0, cutLineData.effectiveCutLine - totalWins);
                        const paceNeeded = gamesRemaining > 0 ? winsNeeded / gamesRemaining : 0;
                        const bubble = cutLineData.activePath === 'division' ? cutLineData.divBubbleAbbrev : cutLineData.wcBubbleAbbrev;
                        return (
                          <>
                            <p className="text-lg md:text-xl font-bold text-gray-900">
                              {winsNeeded} wins to go
                            </p>
                            <p className="text-xs text-gray-500">
                              → {cutLineData.effectiveCutLine} wins • {paceNeeded.toFixed(3)} wins/game{bubble ? ` • ${bubble}` : ''}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <div
                      className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                      style={{
                        borderColor: probabilityColor,
                        backgroundColor: `${probabilityColor}15`,
                        borderWidth: '3px',
                        borderStyle: 'solid',
                      }}
                    >
                      <span className="text-base md:text-lg font-bold" style={{ color: probabilityColor }}>
                        {probability}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lindy's Five Target card (fixed 90-win target) */}
                <div className="rounded-lg p-3 border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide mb-1 text-gray-500">
                        Lindy&apos;s Five Target
                      </p>
                      <p className="text-lg md:text-xl font-bold text-gray-900">
                        {Math.max(0, playoffTarget - totalWins)} wins to go
                      </p>
                      <p className="text-xs text-gray-500">
                        → {playoffTarget} wins • {gamesRemaining > 0 ? ((playoffTarget - totalWins) / gamesRemaining).toFixed(3) : '0.000'} wins/game
                      </p>
                    </div>
                    {(() => {
                      const lindysProb = probabilityForFinalWins(projectedWins, gamesPlayed, playoffTarget);
                      return (
                        <div
                          className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                          style={{
                            borderColor: probabilityColor,
                            backgroundColor: `${probabilityColor}15`,
                            borderWidth: '3px',
                            borderStyle: 'solid',
                          }}
                        >
                          <span className="text-base md:text-lg font-bold" style={{ color: probabilityColor }}>
                            {lindysProb}%
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Probability Breakdown Table */}
              <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
                <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-500">
                  If the {shortName} Finish With...
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {(() => {
                    const cutLine = cutLineData.effectiveCutLine;
                    const gap = Math.abs(projectedWins - cutLine);
                    let start: number;
                    if (gap <= 5) {
                      const lower = Math.min(cutLine, projectedWins);
                      start = lower - 2;
                    } else {
                      start = cutLine - 3;
                    }
                    const winRange = Array.from({ length: 8 }, (_, i) => start + i);

                    return winRange.map((wins) => {
                      const prob = probabilityForFinalWins(wins, gamesPlayed, cutLine, cutLineData.activePath);
                      const isProjected = wins === projectedWins;
                      const isCutLine = wins === cutLine;
                      return (
                        <div
                          key={wins}
                          className={`text-center px-2 py-2 rounded-lg border ${
                            isProjected
                              ? 'bg-blue-100 border-blue-200'
                              : isCutLine
                                ? 'bg-gray-50 border-gray-400'
                                : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <p className="text-xs text-gray-500">{wins} wins</p>
                          <p className="text-lg font-bold text-gray-900">{prob}%</p>
                        </div>
                      );
                    });
                  })()}
                </div>
                <p className="mt-2 text-[11px] text-gray-400 text-center">
                  Highlighted: <span className="font-semibold text-gray-600">projected total</span> · cut line shown for reference
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
