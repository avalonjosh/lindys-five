'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, MoreHorizontal, X as XIcon, Link as LinkIcon, Check } from 'lucide-react';
import type { MLBSeasonStats, MLBStandingsTeam } from '@/lib/types/mlb';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import {
  getMLBPlayoffProbability,
  probabilityForFinalWins,
  probabilityOfReachingTotal,
} from '@/lib/utils/mlbStandingsCalc';
import { trackClick } from '@/lib/analytics';

interface MLBProgressBarProps {
  stats: MLBSeasonStats;
  teamColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  teamAbbrev?: string;
  teamName?: string;
  teamSlug?: string;
  yearOverYearMode?: boolean;
  yearOverYearLoading?: boolean;
  onYearOverYearToggle?: () => void;
  lastSeasonStats?: MLBSeasonStats;
  showShareButton?: boolean;
  /** Mirrors the displayed playoff probability up to the What-If save flow. */
  onProbabilityComputed?: (probability: number) => void;
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

interface ClinchState {
  kind: 'division' | 'playoff' | 'eliminated';
  label: string;
}

function deriveCutLineState(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): CutLineState {
  const { probability, divCutLine, wcCutLine, activePath } = getMLBPlayoffProbability(team, standings);

  const divTeams = standings
    .filter(t => t.division === team.division)
    .sort((a, b) => b.wins - a.wins);
  const isLeader = divTeams[0]?.teamAbbrev === team.teamAbbrev;
  const divBubble = isLeader ? divTeams[1] : divTeams[0];

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

/**
 * What-If support: overlay simulated wins/losses onto the team's standings row
 * so the probability model sees the simulated record. Runs are scaled to the
 * simulated game count so the Pythagorean blend keeps its per-game rates.
 */
function withSimulatedRecord(team: MLBStandingsTeam, stats: MLBSeasonStats): MLBStandingsTeam {
  const realGames = team.wins + team.losses;
  const simGames = stats.totalWins + stats.totalLosses;
  if (realGames === 0 || (stats.totalWins === team.wins && stats.totalLosses === team.losses)) return team;
  const scale = simGames / realGames;
  return {
    ...team,
    wins: stats.totalWins,
    losses: stats.totalLosses,
    runsScored: Math.round(team.runsScored * scale),
    runsAllowed: Math.round(team.runsAllowed * scale),
  };
}

function deriveClinchState(team: MLBStandingsTeam): ClinchState | null {
  if (team.divisionChamp) return { kind: 'division', label: 'Clinched Division' };
  if (team.clinched) return { kind: 'playoff', label: 'Clinched Playoff Spot' };
  if (team.eliminationNumber === 'E' && team.wildCardEliminationNumber === 'E') {
    return { kind: 'eliminated', label: 'Eliminated from Playoff Contention' };
  }
  return null;
}

function StatCard({
  label,
  value,
  hint,
  teamColors,
  delta,
  deltaPositiveColor = 'text-green-600',
  deltaNegativeColor = 'text-red-600',
  faded = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  teamColors: { primary: string };
  delta?: { value: number; format: (n: number) => string };
  deltaPositiveColor?: string;
  deltaNegativeColor?: string;
  faded?: boolean;
}) {
  const containerClass = faded
    ? 'bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-2 md:p-3 border border-slate-300'
    : 'bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200';
  const labelColor = faded ? '#475569' : teamColors.primary;
  const valueColor = faded ? 'text-slate-700' : 'text-gray-900';
  const hintColor = faded ? 'text-slate-500' : 'text-gray-600';
  return (
    <div className={containerClass}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: labelColor }}>
        {label}
      </div>
      <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${valueColor}`}>
        {value}
        {delta && delta.value !== 0 && (
          <span className={`text-sm font-semibold ${delta.value > 0 ? deltaPositiveColor : deltaNegativeColor}`}>
            {delta.value > 0 ? '+' : ''}{delta.format(delta.value)}
          </span>
        )}
      </div>
      {hint && <div className={`text-xs mt-1 ${hintColor}`}>{hint}</div>}
    </div>
  );
}

export default function MLBProgressBar({
  stats,
  teamColors,
  teamAbbrev,
  teamName,
  teamSlug,
  yearOverYearMode,
  yearOverYearLoading,
  onYearOverYearToggle,
  lastSeasonStats,
  showShareButton,
  onProbabilityComputed,
}: MLBProgressBarProps) {
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
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
  // In What-If mode the stats prop carries the simulated record; fold it into
  // the standings row so the probability reacts to the user's picks.
  const probTeam = userTeam ? withSimulatedRecord(userTeam, stats) : undefined;
  const cutLineData: CutLineState | null = probTeam ? deriveCutLineState(probTeam, standings) : null;
  const clinchState: ClinchState | null = userTeam ? deriveClinchState(userTeam) : null;
  const probability = cutLineData?.probability;

  // Mirror the displayed probability up to the What-If save flow (same pattern
  // as the NHL ProgressBar). Same-value setState in the parent is a no-op.
  useEffect(() => {
    if (probability !== undefined) onProbabilityComputed?.(probability);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probability]);

  const showProbabilityRow = teamAbbrev && gamesPlayed >= 10;
  const probabilityLabel = standingsLoading
    ? '--%'
    : probability !== undefined
      ? `${probability}%`
      : '--%';

  const probabilityColor = teamColors.primary;
  const shortName = teamName ? teamName.split(' ').pop() : 'Team';

  // Last season label (e.g., "2025")
  const lastSeasonLabel = String(new Date().getFullYear() - 1);

  // Last season computed values for deltas
  const lastYearWins = lastSeasonStats?.totalWins ?? 0;
  const lastYearLosses = lastSeasonStats?.totalLosses ?? 0;
  const lastYearPace = lastSeasonStats && lastSeasonStats.gamesPlayed > 0
    ? lastYearWins / lastSeasonStats.gamesPlayed
    : 0;
  const lastYearProjected = lastSeasonStats?.projectedWins ?? 0;

  // Share URL/text
  const teamUrl = typeof window !== 'undefined' && teamSlug
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.origin}/mlb/${teamSlug}`
      : `https://www.lindysfive.com/mlb/${teamSlug}`)
    : '';
  const tweetText = `Track the ${teamName ?? ''} road to the playoffs! ⚾\n${teamUrl}\n@lindysfive #LindysFive`;

  const handleTwitterShare = () => {
    if (!teamUrl) return;
    trackClick('share-x', 'mlb-progress-bar');
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank', 'noopener,noreferrer');
    setShareMenuOpen(false);
  };

  const handleCopyLink = async () => {
    if (!teamUrl) return;
    try {
      await navigator.clipboard.writeText(teamUrl);
      setCopied(true);
      trackClick('share-copy', 'mlb-progress-bar');
      setTimeout(() => {
        setCopied(false);
        setShareMenuOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 relative bg-white" style={{ borderColor: '#e5e7eb' }}>
      {/* Year-over-Year Toggle */}
      {onYearOverYearToggle && (
        <button
          onClick={onYearOverYearToggle}
          disabled={yearOverYearLoading}
          className={`absolute top-3 md:top-4 right-3 md:right-4 flex items-center gap-1 text-xs md:text-sm font-semibold transition-all focus:outline-none z-10 ${
            yearOverYearMode ? '' : 'text-gray-500 hover:text-gray-700'
          } ${yearOverYearLoading ? 'opacity-70 cursor-wait' : ''}`}
          style={yearOverYearMode ? { color: teamColors.primary } : undefined}
          title={yearOverYearLoading ? 'Loading…' : yearOverYearMode ? `Hide ${lastSeasonLabel} comparison` : `Compare to ${lastSeasonLabel}`}
        >
          <span className={yearOverYearMode ? 'underline decoration-2 underline-offset-2' : ''}>
            vs Last Year
          </span>
          {yearOverYearLoading ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <ChevronDown size={12} className={`transition-transform ${yearOverYearMode ? 'rotate-180' : ''}`} />
          )}
        </button>
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 mb-2 md:mb-3">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900">
          Season Progress
        </h3>

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

      {/* Clinch / Elimination banner */}
      {clinchState && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-center text-sm font-bold ${
          clinchState.kind === 'eliminated'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {clinchState.label}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
        <StatCard
          label="Games Played"
          value={gamesPlayed}
          hint={`${gamesRemaining} remaining`}
          teamColors={teamColors}
        />
        <StatCard
          label="Current Wins"
          value={totalWins}
          hint={`${totalWins}-${totalLosses} (${gamesPlayed > 0 ? `${(winPct * 100).toFixed(1)}%` : '—'})`}
          teamColors={teamColors}
        />
        <StatCard
          label="Win Pace"
          value={currentPace}
          hint={`wins/game (need ${neededPace})`}
          teamColors={teamColors}
        />
        <StatCard
          label="Projected"
          value={gamesPlayed > 0 ? projectedWins : '—'}
          hint={gamesPlayed > 0 ? `season total (need ${playoffTarget})` : '—'}
          teamColors={teamColors}
        />
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

      {/* Mobile probability link */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      // "Lindy's Five Target" asks: what's the probability the team actually
                      // reaches 90 wins given their current pace + variance over remaining games.
                      // This is a different question than the breakdown table's conditional cells.
                      const lindysProb = userTeam ? probabilityOfReachingTotal(playoffTarget, userTeam) : 50;
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

      {/* Share Button (hidden when playoff section is open to avoid overlap) */}
      {showShareButton && teamSlug && !playoffExpanded && (
        <div className="relative">
          {shareMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)} />
              <div
                className="absolute bottom-12 right-0 rounded-lg shadow-2xl p-2 border-2 z-50 min-w-[240px] bg-white"
                style={{ borderColor: teamColors.primary }}
              >
                <div
                  className="absolute -bottom-2 right-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent"
                  style={{ borderTopColor: teamColors.primary }}
                />
                <button
                  onClick={handleTwitterShare}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-left hover:bg-gray-100"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black">
                    <XIcon size={16} color="#FFFFFF" />
                  </div>
                  <span className="font-semibold text-sm text-gray-800">Share on X</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-left hover:bg-gray-100"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: teamColors.primary }}
                  >
                    {copied ? <Check size={16} color="#FFFFFF" /> : <LinkIcon size={16} color="#FFFFFF" />}
                  </div>
                  <span className="font-semibold text-sm text-gray-800">
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </span>
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setShareMenuOpen(!shareMenuOpen)}
            className="absolute -bottom-1 md:-bottom-2 right-2 md:right-3 p-2 rounded-full hover:bg-gray-200 transition-colors group"
            aria-label="Share team page"
            title="Share this page"
          >
            <MoreHorizontal size={18} className="text-gray-500 group-hover:text-gray-700" />
          </button>
        </div>
      )}

      {/* Last Year Section */}
      {lastSeasonStats && (
        <>
          <div className="my-6 border-t-2 border-dashed border-gray-300" />

          <div className="mb-2 md:mb-3">
            <h3 className="text-xl md:text-2xl font-bold text-slate-700">
              Last Year ({lastSeasonLabel})
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
            <StatCard
              label="Games Played"
              value={lastSeasonStats.gamesPlayed}
              hint={`Same point last year`}
              teamColors={teamColors}
              faded
            />
            <StatCard
              label="Wins"
              value={lastYearWins}
              hint={`${lastYearWins}-${lastYearLosses}`}
              teamColors={teamColors}
              faded
              delta={{
                value: lastYearWins - totalWins,
                format: (n) => `${Math.abs(n)}`,
              }}
              deltaPositiveColor="text-red-600"
              deltaNegativeColor="text-green-600"
            />
            <StatCard
              label="Win Pace"
              value={lastYearPace.toFixed(3)}
              hint="wins/game"
              teamColors={teamColors}
              faded
              delta={{
                value: parseFloat((lastYearPace - parseFloat(currentPace)).toFixed(3)),
                format: (n) => Math.abs(n).toFixed(3),
              }}
              deltaPositiveColor="text-red-600"
              deltaNegativeColor="text-green-600"
            />
            <StatCard
              label="Projected"
              value={lastYearProjected}
              hint="season total"
              teamColors={teamColors}
              faded
              delta={{
                value: lastYearProjected - projectedWins,
                format: (n) => `${Math.abs(n)}`,
              }}
              deltaPositiveColor="text-red-600"
              deltaNegativeColor="text-green-600"
            />
          </div>

          {lastSeasonStats.gamesPlayed > 0 && (
            <div>
              <div className="flex justify-end text-sm font-semibold mb-2 text-slate-600">
                <span>{((lastYearWins / playoffTarget) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full rounded-full h-8 relative shadow-inner bg-slate-200">
                <div
                  className="h-8 rounded-l-full transition-all duration-500 relative shadow-md flex items-center justify-end bg-slate-500"
                  style={{ width: `${Math.max(Math.min((lastYearWins / playoffTarget) * 100, 100), 5)}%` }}
                >
                  {lastYearWins > 0 && (
                    <span className="pr-1.5 md:pr-3 text-[10px] md:text-sm font-bold text-white whitespace-nowrap">
                      {lastYearWins}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
