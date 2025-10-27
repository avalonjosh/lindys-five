import { useState, useEffect } from 'react';
import type { GameChunk, ChunkStats, GameResult } from '../types';
import GameBox from './GameBox';
import { calculateChunkStats } from '../utils/chunkCalculator';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  accent: string;
  border: string;
  text: string;
}

interface ChunkCardProps {
  chunk: GameChunk;
  isGoatMode: boolean;
  previousChunkStats?: ChunkStats | null;
  onStatsCalculated?: (chunkNumber: number, stats: ChunkStats) => void;
  whatIfMode?: boolean;
  onGameClick?: (gameId: number, currentGame: GameResult, outcome: 'W' | 'OTL' | 'L') => void;
  hypotheticalResults?: Map<number, GameResult>;
  teamId?: number;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
}

export default function ChunkCard({ chunk, isGoatMode, previousChunkStats, onStatsCalculated, whatIfMode, onGameClick, hypotheticalResults, teamId = 7, teamColors, darkModeColors }: ChunkCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate display values with hypotheticals applied
  const getDisplayGame = (game: GameResult): GameResult => {
    const hypo = hypotheticalResults?.get(game.gameId || 0);
    return hypo || game;
  };

  const displayWins = chunk.games.filter(g => getDisplayGame(g).outcome === 'W').length;
  const displayOTLosses = chunk.games.filter(g => getDisplayGame(g).outcome === 'OTL').length;
  const displayLosses = chunk.games.filter(g => getDisplayGame(g).outcome === 'L').length;
  const displayPoints = chunk.games.reduce((sum, g) => sum + getDisplayGame(g).points, 0);

  const targetMet = displayPoints >= (chunk.totalGames * 2 * 0.6);
  const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');

  // Load stats when expanded
  useEffect(() => {
    if (isExpanded && !stats && hasPlayed) {
      setLoading(true);
      calculateChunkStats(chunk, teamId)
        .then(calculatedStats => {
          setStats(calculatedStats);
          if (calculatedStats && onStatsCalculated) {
            onStatsCalculated(chunk.chunkNumber, calculatedStats);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isExpanded, stats, chunk, hasPlayed, onStatsCalculated]);

  // Subtle styling based on performance
  const borderClass = hasPlayed && chunk.isComplete
    ? (targetMet
      ? 'border-2'
      : isGoatMode ? 'border-2 border-dashed' : 'border-gray-300 border-2 border-dashed')
    : isGoatMode ? 'border-2' : 'border-gray-200 border-2';

  const borderColorStyle = hasPlayed && chunk.isComplete
    ? (targetMet
      ? (isGoatMode ? { borderColor: darkModeColors.border } : { borderColor: teamColors.primary })
      : (isGoatMode ? { borderColor: darkModeColors.border, borderStyle: 'dashed' } : undefined))
    : (isGoatMode ? { borderColor: darkModeColors.border } : undefined);

  const shadowStyle = targetMet && chunk.isComplete ? 'shadow-xl' : 'shadow-lg';
  const opacity = hasPlayed && !targetMet && chunk.isComplete ? 'opacity-80' : 'opacity-100';

  return (
    <div
      className={`${borderClass} ${shadowStyle} ${opacity} rounded-2xl p-3 md:p-4 hover:shadow-2xl transition-all ${
        isGoatMode ? '' : 'bg-white'
      }`}
      style={isGoatMode ? {
        backgroundColor: darkModeColors.background,
        ...borderColorStyle
      } : borderColorStyle}
    >
      {/* Set Header */}
      <div className={`mb-3 md:mb-4 pb-3 md:pb-4 border-b-2 ${
        isGoatMode ? 'border-zinc-800' : 'border-gray-100'
      }`}>
        <div className="flex justify-between items-center mb-2 md:mb-3">
          <div>
            <h3 className={`font-bold text-xl md:text-2xl ${
              isGoatMode ? 'text-white' : 'text-sabres-navy'
            }`}>Set {chunk.chunkNumber}</h3>
            <p className={`text-xs md:text-sm mt-1 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>
              {chunk.games.length > 0 ? (() => {
                const firstDate = new Date(chunk.games[0].date);
                const lastDate = new Date(chunk.games[chunk.games.length - 1].date);
                const firstMonth = firstDate.toLocaleDateString('en-US', { month: 'short' });
                const lastMonth = lastDate.toLocaleDateString('en-US', { month: 'short' });
                const firstDay = firstDate.getDate();
                const lastDay = lastDate.getDate();

                if (chunk.games.length === 1) {
                  return `${firstMonth} ${firstDay}`;
                } else if (firstMonth === lastMonth) {
                  // Same month: "Oct 9-15"
                  return `${firstMonth} ${firstDay}-${lastDay}`;
                } else {
                  // Different months: "Oct 28 - Nov 5"
                  return `${firstMonth} ${firstDay} - ${lastMonth} ${lastDay}`;
                }
              })() : (
                `${chunk.totalGames} game${chunk.totalGames !== 1 ? 's' : ''}`
              )}
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl md:text-5xl font-bold ${isGoatMode ? 'text-red-500' : ''}`}
              style={!isGoatMode ? { color: teamColors.primary } : undefined}
            >
              {displayPoints}
            </div>
            <div className={`text-xs mt-1 font-semibold ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>of {chunk.maxPoints} points</div>
          </div>
        </div>

        {/* Record Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-xl p-2 text-center border ${
            isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div
              className={`text-2xl md:text-3xl font-bold ${isGoatMode ? 'text-red-500' : ''}`}
              style={!isGoatMode ? { color: teamColors.primary } : undefined}
            >
              {displayWins}
            </div>
            <div className={`text-xs font-semibold mt-1 uppercase tracking-wide ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>Wins</div>
          </div>
          <div className={`rounded-xl p-2 text-center border ${
            isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div
              className={`text-2xl md:text-3xl font-bold ${isGoatMode ? 'text-red-500' : ''}`}
              style={!isGoatMode ? { color: teamColors.primary } : undefined}
            >
              {displayOTLosses}
            </div>
            <div className={`text-xs font-semibold mt-1 uppercase tracking-wide ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>OT Losses</div>
          </div>
          <div className={`rounded-xl p-2 text-center border ${
            isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div
              className={`text-2xl md:text-3xl font-bold ${isGoatMode ? 'text-red-500' : ''}`}
              style={!isGoatMode ? { color: teamColors.primary } : undefined}
            >
              {displayLosses}
            </div>
            <div className={`text-xs font-semibold mt-1 uppercase tracking-wide ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>Losses</div>
          </div>
        </div>

        {/* Target Status */}
        {chunk.isComplete && (
          <div className="mt-3 text-center">
            {chunk.points >= (chunk.totalGames * 2 * 0.6) ? (
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border`}
                style={isGoatMode ? {
                  backgroundColor: `${darkModeColors.accent}30`,
                  color: darkModeColors.accent,
                  borderColor: darkModeColors.accent
                } : {
                  backgroundColor: `${teamColors.primary}20`,
                  color: teamColors.primary,
                  borderColor: `${teamColors.primary}50`
                }}
              >
                <span className="text-lg">✓</span> Target Met! (6+ points)
              </span>
            ) : (
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                isGoatMode
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  : 'bg-slate-100 text-gray-700 border-zinc-300'
              }`}>
                <span className="text-lg">—</span> Below Target (need 6+ points)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Individual Game Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {chunk.games.map((game, idx) => {
          const hypothetical = hypotheticalResults?.get(game.gameId || 0);
          const hypotheticalOutcome = hypothetical?.outcome === 'W' || hypothetical?.outcome === 'OTL' || hypothetical?.outcome === 'L'
            ? hypothetical.outcome
            : null;

          return (
            <GameBox
              key={idx}
              game={game}
              gameNumber={(chunk.chunkNumber - 1) * 5 + idx + 1}
              isGoatMode={isGoatMode}
              whatIfMode={whatIfMode}
              onGameClick={onGameClick}
              hypotheticalOutcome={hypotheticalOutcome}
              teamColors={teamColors}
              darkModeColors={darkModeColors}
            />
          );
        })}

        {/* Empty placeholders for games not yet scheduled */}
        {chunk.games.length < chunk.totalGames &&
          Array.from({ length: chunk.totalGames - chunk.games.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className={`rounded-md p-3 text-center opacity-50 ${
                isGoatMode
                  ? 'bg-zinc-950 text-zinc-600'
                  : 'bg-gray-700 text-white'
              }`}
            >
              <div className="text-xs font-semibold opacity-60 mb-2">
                Game {(chunk.chunkNumber - 1) * 5 + chunk.games.length + idx + 1}
              </div>
              <div className="text-sm py-4">Not Scheduled Yet</div>
            </div>
          ))}
      </div>

      {/* Show Stats Button - Only show if set has completed games */}
      {hasPlayed && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full mt-3 md:mt-4 py-2 px-4 rounded-xl font-semibold text-sm transition-all border`}
            style={isGoatMode ? {
              backgroundColor: darkModeColors.background,
              color: darkModeColors.accent,
              borderColor: darkModeColors.border
            } : {
              backgroundColor: `${teamColors.primary}10`,
              color: teamColors.primary,
              borderColor: `${teamColors.primary}40`
            }}
            onMouseEnter={(e) => {
              if (isGoatMode) {
                e.currentTarget.style.backgroundColor = '#000000';
              } else {
                e.currentTarget.style.backgroundColor = `${teamColors.primary}20`;
              }
            }}
            onMouseLeave={(e) => {
              if (isGoatMode) {
                e.currentTarget.style.backgroundColor = darkModeColors.background;
              } else {
                e.currentTarget.style.backgroundColor = `${teamColors.primary}10`;
              }
            }}
          >
            {isExpanded ? '▲ Hide Set Stats' : '▼ Show Set Stats'}
          </button>

          {/* Stats Section */}
          {isExpanded && (
            <div className={`mt-3 pt-3 border-t-2 ${
              isGoatMode ? 'border-zinc-700' : 'border-gray-200'
            }`}>
              {loading ? (
                <div className={`text-center py-6 ${
                  isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
                  Loading stats...
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <StatItem
                    label="Goals Per Game"
                    mobileLabel="GPG"
                    value={stats.goalsPerGame.toFixed(2)}
                    previousValue={previousChunkStats?.goalsPerGame}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Goals Against Per Game"
                    mobileLabel="GAA"
                    value={stats.goalsAgainstPerGame.toFixed(2)}
                    previousValue={previousChunkStats?.goalsAgainstPerGame}
                    higherIsBetter={false}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Shots Per Game"
                    mobileLabel="SPG"
                    value={stats.shotsPerGame.toFixed(1)}
                    previousValue={previousChunkStats?.shotsPerGame}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Shots Against Per Game"
                    mobileLabel="SAPG"
                    value={stats.shotsAgainstPerGame.toFixed(1)}
                    previousValue={previousChunkStats?.shotsAgainstPerGame}
                    higherIsBetter={false}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Power Play %"
                    mobileLabel="PP%"
                    value={stats.powerPlayPct.toFixed(1) + '%'}
                    previousValue={previousChunkStats?.powerPlayPct}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Penalty Kill %"
                    mobileLabel="PK%"
                    value={stats.penaltyKillPct.toFixed(1) + '%'}
                    previousValue={previousChunkStats?.penaltyKillPct}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Save %"
                    mobileLabel="SV%"
                    value={stats.savePct.toFixed(1) + '%'}
                    previousValue={previousChunkStats?.savePct}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <div className={`rounded-xl p-3 text-center border ${
                    isGoatMode
                      ? 'bg-zinc-900 border-zinc-700'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`text-xs font-semibold mb-2 uppercase tracking-wide ${
                      isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                    }`}>
                      Games Played
                    </div>
                    <div className={`text-2xl md:text-3xl font-bold ${
                      isGoatMode ? 'text-white' : 'text-gray-800'
                    }`}>
                      {stats.gamesPlayed}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`text-center py-6 ${
                  isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
                  No stats available
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface StatItemProps {
  label: string;
  mobileLabel?: string;
  value: string;
  previousValue?: number;
  higherIsBetter: boolean;
  isGoatMode: boolean;
}

function StatItem({ label, mobileLabel, value, previousValue, higherIsBetter, isGoatMode }: StatItemProps) {
  let indicator: 'up' | 'down' | 'none' = 'none';
  let indicatorColor = '';
  let percentChange = '';

  if (previousValue !== undefined) {
    const currentNumeric = parseFloat(value);
    const diff = currentNumeric - previousValue;

    if (Math.abs(diff) > 0.1) { // Only show indicator if difference is meaningful
      // Calculate percentage change
      const pctChange = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
      percentChange = `${Math.abs(pctChange).toFixed(1)}%`;

      if (diff > 0) {
        indicator = 'up';
        indicatorColor = higherIsBetter ? 'text-emerald-600' : 'text-red-600';
      } else {
        indicator = 'down';
        indicatorColor = higherIsBetter ? 'text-red-600' : 'text-emerald-600';
      }
    }
  }

  return (
    <div className={`rounded-xl p-3 text-center border ${
      isGoatMode
        ? 'bg-zinc-900 border-zinc-700'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={`text-xs font-semibold mb-2 uppercase tracking-wide ${
        isGoatMode ? 'text-zinc-400' : 'text-gray-500'
      }`}>
        {mobileLabel ? (
          <>
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className={`text-2xl md:text-3xl font-bold ${
          isGoatMode ? 'text-white' : 'text-gray-800'
        }`}>
          {value}
        </div>
        {indicator !== 'none' && (
          <div className={`flex flex-col items-center justify-center ${indicatorColor}`}>
            <span className="text-sm md:text-base leading-none">
              {indicator === 'up' ? '↑' : '↓'}
            </span>
            <span className="text-[10px] md:text-xs font-semibold leading-none">
              {percentChange}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
