import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameChunk, SeasonStats, ChunkStats, GameResult } from './types';
import { fetchSabresSchedule, fetchLastSeasonComparison } from './services/nhlApi';
import { calculateChunks, calculateSeasonStats, calculateChunkStats } from './utils/chunkCalculator';
import ChunkCard from './components/ChunkCard';
import ProgressBar from './components/ProgressBar';
import TeamNav from './components/TeamNav';
import type { TeamConfig } from './teamConfig';
import { getDarkModeColors } from './teamConfig';

// Force rebuild - clean deploy
interface AppProps {
  team: TeamConfig;
}

function App({ team }: AppProps) {
  const navigate = useNavigate();
  const darkModeColors = getDarkModeColors(team);
  const [chunks, setChunks] = useState<GameChunk[]>([]);
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [chunkStatsCache, setChunkStatsCache] = useState<Map<number, ChunkStats>>(new Map());
  const [isGoatMode, setIsGoatMode] = useState(() => {
    const saved = localStorage.getItem(`${team.id}-theme`);
    return saved === 'goat';
  });
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [hypotheticalResults, setHypotheticalResults] = useState<Map<number, GameResult>>(new Map());
  const [yearOverYearMode, setYearOverYearMode] = useState(false);
  const [lastSeasonData, setLastSeasonData] = useState<{ pointsLastYear: number; recordLastYear: string } | null>(null);

  const toggleTheme = () => {
    setIsGoatMode(prev => {
      const newMode = !prev;
      localStorage.setItem(`${team.id}-theme`, newMode ? 'goat' : 'classic');
      return newMode;
    });
  };

  const handleStatsCalculated = (chunkNumber: number, stats: ChunkStats) => {
    setChunkStatsCache(prev => {
      const newCache = new Map(prev);
      newCache.set(chunkNumber, stats);
      return newCache;
    });
  };

  // Find the current active set (first set with pending games)
  const getCurrentSet = (): GameChunk | null => {
    return chunks.find(chunk =>
      chunk.games.some(g => g.outcome === 'PENDING') &&
      chunk.games.some(g => g.outcome !== 'PENDING')
    ) || chunks.find(chunk =>
      chunk.games.every(g => g.outcome === 'PENDING')
    ) || null;
  };

  // Get sets available for What If mode (current set + next 2 sets)
  const getWhatIfSets = (): GameChunk[] => {
    const currentSet = getCurrentSet();
    if (!currentSet) return [];

    const currentIndex = chunks.findIndex(c => c.chunkNumber === currentSet.chunkNumber);
    if (currentIndex === -1) return [];

    // Return current set + next 2 sets (up to 3 total)
    return chunks.slice(currentIndex, currentIndex + 3);
  };

  // Check if a completed set should be hidden
  // A set should only be hidden if it's complete AND the next set has started
  const shouldHideCompletedSet = (chunk: GameChunk): boolean => {
    if (!chunk.isComplete) return false;

    // Find the next chunk
    const nextChunk = chunks.find(c => c.chunkNumber === chunk.chunkNumber + 1);
    if (!nextChunk) return true; // If no next chunk, hide completed ones

    // Check if the next chunk has started (has at least one game that's not pending or has a past date)
    const now = new Date();
    const nextChunkFirstGame = nextChunk.games[0];

    if (!nextChunkFirstGame?.date) return true; // If no date info, use old behavior

    const firstGameDate = new Date(nextChunkFirstGame.date);

    // Only hide if the next set's first game date has passed (or is today)
    return now >= firstGameDate;
  };

  // Apply hypothetical results to chunks
  const getChunksWithHypotheticals = (): GameChunk[] => {
    if (!whatIfMode || hypotheticalResults.size === 0) {
      return chunks;
    }

    return chunks.map(chunk => ({
      ...chunk,
      games: chunk.games.map(game => {
        const hypothetical = hypotheticalResults.get(game.gameId || 0);
        return hypothetical || game;
      }),
      // Recalculate chunk totals
      wins: chunk.games.filter(g => {
        const hypo = hypotheticalResults.get(g.gameId || 0);
        return (hypo || g).outcome === 'W';
      }).length,
      otLosses: chunk.games.filter(g => {
        const hypo = hypotheticalResults.get(g.gameId || 0);
        return (hypo || g).outcome === 'OTL';
      }).length,
      losses: chunk.games.filter(g => {
        const hypo = hypotheticalResults.get(g.gameId || 0);
        return (hypo || g).outcome === 'L';
      }).length,
      points: chunk.games.reduce((sum, g) => {
        const hypo = hypotheticalResults.get(g.gameId || 0);
        return sum + (hypo || g).points;
      }, 0),
    }));
  };

  const handleGameClick = (gameId: number, currentGame: GameResult, outcome: 'W' | 'OTL' | 'L') => {
    if (!whatIfMode || currentGame.outcome !== 'PENDING') return;

    const whatIfSets = getWhatIfSets();
    if (whatIfSets.length === 0) return;

    // Only allow editing games in the What If sets (current + next 2)
    const isInWhatIfSets = whatIfSets.some(set =>
      set.games.some(g => g.gameId === gameId)
    );
    if (!isInWhatIfSets) return;

    const currentHypo = hypotheticalResults.get(gameId);

    // If clicking the same outcome, remove the simulation
    if (currentHypo?.outcome === outcome) {
      setHypotheticalResults(prev => {
        const newMap = new Map(prev);
        newMap.delete(gameId);
        return newMap;
      });
      return;
    }

    // Set the new outcome
    const hypotheticalGame: GameResult = {
      ...currentGame,
      outcome: outcome,
      points: outcome === 'W' ? 2 : outcome === 'OTL' ? 1 : 0,
      sabresScore: outcome === 'W' ? 3 : outcome === 'OTL' ? 2 : 1,
      opponentScore: outcome === 'W' ? 2 : outcome === 'OTL' ? 3 : 3,
    };

    setHypotheticalResults(prev => {
      const newMap = new Map(prev);
      newMap.set(gameId, hypotheticalGame);
      return newMap;
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const schedule = await fetchSabresSchedule('20252026', team.abbreviation, team.nhlId);

      const calculatedChunks = calculateChunks(schedule);
      setChunks(calculatedChunks);

      const seasonStats = calculateSeasonStats(calculatedChunks);
      setStats(seasonStats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [team]);

  // Fetch last season comparison data when Year-over-Year mode is enabled
  useEffect(() => {
    const fetchLastSeasonData = async () => {
      if (yearOverYearMode && stats && stats.gamesPlayed > 0) {
        const comparison = await fetchLastSeasonComparison(stats.gamesPlayed, team.abbreviation, team.nhlId);
        setLastSeasonData(comparison);
      }
    };
    fetchLastSeasonData();
  }, [yearOverYearMode, stats?.gamesPlayed, team]);

  // Pre-calculate stats for all completed chunks so comparisons work even when chunks are hidden
  useEffect(() => {
    const calculateAllCompletedStats = async () => {
      for (const chunk of chunks) {
        if (chunk.isComplete && !chunkStatsCache.has(chunk.chunkNumber)) {
          const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');
          if (hasPlayed) {
            try {
              const stats = await calculateChunkStats(chunk, team.nhlId);
              if (stats) {
                handleStatsCalculated(chunk.chunkNumber, stats);
              }
            } catch (error) {
              console.error(`Error calculating stats for chunk ${chunk.chunkNumber}:`, error);
            }
          }
        }
      }
    };

    if (chunks.length > 0) {
      calculateAllCompletedStats();
    }
  }, [chunks]);

  if (loading && chunks.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isGoatMode
          ? `bg-gradient-to-b ${darkModeColors.backgroundGradient}`
          : 'bg-gradient-to-b from-sabres-navy to-sabres-blue'
      }`}>
        <div className="text-white text-2xl">Loading {team.name} data...</div>
      </div>
    );
  }

  const logoUrl = isGoatMode && team.altLogo
    ? team.altLogo
    : team.logo;

  // Special cases: treat certain teams' dark mode as classic mode with custom colors
  const isNordiquesMode = team.id === 'avalanche' && isGoatMode;
  const isVintagePanthersMode = team.id === 'panthers' && isGoatMode;
  const useClassicStyling = !isGoatMode || isNordiquesMode || isVintagePanthersMode;

  // For special modes, create custom team colors using their palette
  const effectiveTeamColors = isNordiquesMode ? {
    primary: darkModeColors.accent, // Nordiques red
    secondary: darkModeColors.border, // Nordiques navy blue
    accent: darkModeColors.accent // Nordiques red
  } : isVintagePanthersMode ? {
    primary: team.colors.primary, // Panthers red
    secondary: team.colors.secondary, // Panthers navy blue
    accent: team.colors.accent // Panthers gold
  } : team.colors;

  return (
    <div
      className={`min-h-screen ${
        useClassicStyling
          ? 'bg-gradient-to-br from-slate-50 to-blue-50'
          : `bg-gradient-to-br ${darkModeColors.backgroundGradient}`
      }`}
    >
      {/* Header */}
      <header
        className={`shadow-xl border-b-4 ${
          isGoatMode
            ? ''
            : ''
        }`}
        style={useClassicStyling ? {
          background: team.id === 'sabres'
            ? `linear-gradient(to right, ${team.colors.primary}, ${team.colors.secondary})`
            : isVintagePanthersMode
              ? effectiveTeamColors.accent // Gold for vintage Panthers
              : isNordiquesMode
                ? darkModeColors.background // Nordiques powder blue (#5AB7E6)
                : team.colors.primary,
          borderBottomColor: team.id === 'sabres' ? team.colors.accent : isNordiquesMode ? darkModeColors.accent : team.colors.secondary
        } : {
          backgroundColor: team.id === 'lightning' || team.id === 'penguins' ? '#FFFFFF' : darkModeColors.background,
          borderBottomColor: team.id === 'lightning' ? team.colors.primary : team.id === 'penguins' ? team.colors.secondary : darkModeColors.border
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col items-center text-center relative">
            {/* Team Navigation */}
            <div className="absolute left-0 top-0">
              <TeamNav currentTeamId={team.id} isGoatMode={!useClassicStyling} darkModeColors={darkModeColors} teamColors={team.colors} />
            </div>

            {/* Theme Toggle Switch */}
            <div className="absolute right-0 top-0">
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 md:h-7 md:w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2`}
                style={isGoatMode ? {
                  backgroundColor: team.id === 'lightning' ? team.colors.primary : team.id === 'penguins' ? team.colors.primary : darkModeColors.accent,
                  boxShadow: `0 0 0 2px ${team.id === 'lightning' ? team.colors.primary : team.id === 'penguins' ? team.colors.primary : darkModeColors.accent}`
                } : {
                  backgroundColor: team.colors.accent,
                  boxShadow: `0 0 0 2px ${team.colors.accent === '#FFFFFF' ? team.colors.secondary : 'rgba(255, 255, 255, 0.5)'}`
                }}
                role="switch"
                aria-checked={isGoatMode}
                title={isGoatMode ? 'Switch to Classic Mode' : 'Switch to Dark Mode'}
              >
                <span
                  className={`inline-block h-4 w-4 md:h-5 md:w-5 transform rounded-full shadow-lg transition-transform ${
                    isGoatMode ? 'translate-x-6 md:translate-x-8' : 'translate-x-1'
                  }`}
                  style={!isGoatMode ? {
                    backgroundColor: team.colors.accent === '#FFFFFF' ? team.colors.secondary : '#FFFFFF',
                    border: team.colors.accent === '#FFFFFF' ? `2px solid ${team.colors.secondary}` : 'none'
                  } : {
                    backgroundColor: '#FFFFFF',
                    border: team.id === 'lightning' || team.id === 'penguins' ? `2px solid ${team.colors.primary}` : 'none'
                  }}
                />
              </button>
            </div>

            <button
              onClick={() => navigate('/')}
              className="hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded-lg"
              title="Back to Home"
            >
              {team.id === 'lightning' && !isGoatMode ? (
                <div className="p-2 md:p-3 rounded-full bg-white mb-2 md:mb-3">
                  <img
                    src={logoUrl}
                    alt={`${team.city} ${team.name} Logo`}
                    className="w-12 h-12 md:w-18 md:h-18"
                  />
                </div>
              ) : team.id === 'lightning' && isGoatMode ? (
                <img
                  src={logoUrl}
                  alt={`${team.city} ${team.name} Logo`}
                  className="h-16 md:h-24 mb-2 md:mb-3 w-auto"
                />
              ) : (team.id === 'canucks' && isGoatMode) ? (
                <img
                  src={logoUrl}
                  alt={`${team.city} ${team.name} Logo`}
                  className="h-16 md:h-24 mb-2 md:mb-3 w-auto"
                />
              ) : (team.id === 'senators' && isGoatMode) ? (
                <img
                  src={logoUrl}
                  alt={`${team.city} ${team.name} Logo`}
                  className="h-16 md:h-24 mb-2 md:mb-3 w-auto"
                />
              ) : (team.id === 'blackhawks' && isGoatMode) ? (
                <img
                  src={logoUrl}
                  alt={`${team.city} ${team.name} Logo`}
                  className="h-16 md:h-24 mb-2 md:mb-3 w-auto"
                />
              ) : (team.id === 'penguins' && isGoatMode) ? (
                <img
                  src={logoUrl}
                  alt={`${team.city} ${team.name} Logo`}
                  className="h-16 md:h-24 mb-2 md:mb-3 w-auto"
                />
              ) : (
                <img
                  src={logoUrl}
                  alt={`${team.city} ${team.name} Logo`}
                  className="w-16 h-16 md:w-24 md:h-24 mb-2 md:mb-3"
                />
              )}
            </button>
            <h1
              className={`text-4xl md:text-6xl font-bold mb-2 tracking-wider ${
                (team.id === 'lightning' || team.id === 'penguins') && isGoatMode ? '' : 'text-white'
              }`}
              style={(team.id === 'lightning' || team.id === 'penguins') && isGoatMode ? {
                fontFamily: 'Bebas Neue, sans-serif',
                color: team.colors.primary
              } : { fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {team.id === 'canadiens' && isGoatMode ? (
                <span className="relative inline-block">
                  <span
                    className="absolute -top-5 md:-top-8 left-1/2 transform -translate-x-1/2 text-xl md:text-3xl -rotate-1 whitespace-nowrap"
                    style={{
                      fontFamily: 'Permanent Marker, cursive',
                      color: darkModeColors.accent
                    }}
                  >
                    Les cinq de Lindy
                  </span>
                  <span style={{ textDecoration: 'line-through', textDecorationThickness: '3px' }}>
                    Lindy's Five
                  </span>
                </span>
              ) : (
                "Lindy's Five"
              )}
            </h1>
            <h2
              className={`text-xs md:text-2xl font-semibold mb-1 px-2 leading-tight whitespace-nowrap`}
              style={isGoatMode ? { color: (team.id === 'lightning' || team.id === 'penguins') ? team.colors.primary : darkModeColors.accent } : { color: team.id === 'sabres' ? team.colors.accent : team.colors.secondary }}
            >
              {team.city} {team.name} Road to the Playoffs 2025-2026
            </h2>
            <p
              className={`text-xs md:text-base opacity-90 px-2 leading-tight ${
                (team.id === 'lightning' || team.id === 'penguins') && isGoatMode ? '' : 'text-white'
              }`}
              style={(team.id === 'lightning' || team.id === 'penguins') && isGoatMode ? { color: team.colors.primary } : undefined}
            >
              5-Game Set Analysis • Target: 6+ points per set
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        {stats && (
          <ProgressBar
            stats={whatIfMode && hypotheticalResults.size > 0 ? calculateSeasonStats(getChunksWithHypotheticals()) : stats}
            isGoatMode={!useClassicStyling}
            yearOverYearMode={yearOverYearMode}
            onYearOverYearToggle={() => setYearOverYearMode(!yearOverYearMode)}
            lastSeasonStats={yearOverYearMode && lastSeasonData ? {
              totalPoints: lastSeasonData.pointsLastYear,
              totalGames: stats.totalGames,
              gamesPlayed: stats.gamesPlayed,
              gamesRemaining: stats.gamesRemaining,
              currentPace: lastSeasonData.pointsLastYear / stats.gamesPlayed,
              projectedPoints: Math.round((lastSeasonData.pointsLastYear / stats.gamesPlayed) * stats.totalGames),
              playoffTarget: stats.playoffTarget,
              pointsAboveBelow: Math.round((lastSeasonData.pointsLastYear / stats.gamesPlayed) * stats.totalGames) - stats.playoffTarget
            } : undefined}
            teamColors={effectiveTeamColors}
            darkModeColors={darkModeColors}
            teamId={team.id}
            showShareButton={true}
            teamName={`${team.city} ${team.name}`}
          />
        )}

        {/* What If Mode Banner */}
        {whatIfMode && (
          <div
            className={`mt-4 mb-4 p-3 rounded-lg border-2`}
            style={isGoatMode ? {
              backgroundColor: `${darkModeColors.accent}20`,
              borderColor: darkModeColors.accent,
              color: darkModeColors.accent
            } : {
              backgroundColor: `${team.colors.primary}15`,
              borderColor: team.colors.primary,
              color: team.colors.primary
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 flex-1 min-w-0">
                <span className="font-semibold text-sm md:text-base">What If Mode Active</span>
                <span className="text-xs md:text-sm opacity-80"><span className="hidden md:inline">- </span>Simulate pending games in the next 3 sets</span>
              </div>
              <button
                onClick={() => {
                  setHypotheticalResults(new Map());
                }}
                className={`px-3 py-1 rounded text-sm font-semibold transition-all whitespace-nowrap text-white`}
                style={isGoatMode ? {
                  backgroundColor: darkModeColors.accent,
                } : {
                  backgroundColor: team.colors.primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Set Grid */}
        <div className={`mb-4 ${whatIfMode ? '' : 'mt-4'}`}>
          <div className="flex justify-between items-center mb-3 gap-2">
            <h2
              className={`text-lg md:text-2xl font-bold ${isGoatMode && !isNordiquesMode ? 'text-white' : ''}`}
              style={useClassicStyling ? { color: effectiveTeamColors.secondary } : undefined}
            >
              Game Sets
            </h2>
            <div className="flex items-center gap-1.5 md:gap-3">
              {/* What If Toggle */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <span
                  className={`text-xs md:text-sm font-semibold ${
                    whatIfMode
                      ? ''
                      : isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                  }`}
                  style={whatIfMode ? (isGoatMode ? { color: darkModeColors.accent } : { color: team.colors.primary }) : undefined}
                >
                  What If
                </span>
                <button
                  onClick={() => {
                    setWhatIfMode(!whatIfMode);
                    if (whatIfMode) {
                      setHypotheticalResults(new Map());
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    whatIfMode
                      ? ''
                      : isGoatMode
                        ? 'bg-zinc-700'
                        : 'bg-gray-400'
                  }`}
                  style={whatIfMode ? (isGoatMode ? {
                    backgroundColor: darkModeColors.accent,
                    boxShadow: `0 0 0 2px ${darkModeColors.accent}`
                  } : {
                    backgroundColor: team.colors.primary,
                    boxShadow: `0 0 0 2px ${team.colors.primary}`
                  }) : undefined}
                  role="switch"
                  aria-checked={whatIfMode}
                  title={whatIfMode ? 'Turn off What If Mode' : 'Turn on What If Mode'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                      whatIfMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Hide Completed Button */}
              <button
                onClick={() => setHideCompleted(!hideCompleted)}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                  hideCompleted
                    ? ''
                    : isGoatMode
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                style={hideCompleted ? (isGoatMode ? {
                  backgroundColor: darkModeColors.accent,
                  color: darkModeColors.accent === '#FFFFFF' ? '#002868' : '#FFFFFF'
                } : {
                  backgroundColor: team.colors.primary,
                  color: '#FFFFFF'
                }) : undefined}
              >
                <span className="hidden sm:inline">{hideCompleted ? 'Show All Sets' : 'Hide Completed Sets'}</span>
                <span className="sm:hidden">{hideCompleted ? 'Show All' : 'Hide Done'}</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {chunks
              .filter(chunk => !hideCompleted || !shouldHideCompletedSet(chunk))
              .map((chunk) => {
                // Find the previous chunk (by chunk number, not filtered index)
                const previousChunk = chunks.find(c => c.chunkNumber === chunk.chunkNumber - 1);
                const previousChunkStats = previousChunk
                  ? chunkStatsCache.get(previousChunk.chunkNumber)
                  : undefined;

                const whatIfSets = getWhatIfSets();
                const isWhatIfSet = whatIfSets.some(set => set.chunkNumber === chunk.chunkNumber);

                return (
                  <ChunkCard
                    key={chunk.chunkNumber}
                    chunk={chunk}
                    isGoatMode={!useClassicStyling}
                    previousChunkStats={previousChunkStats}
                    onStatsCalculated={handleStatsCalculated}
                    whatIfMode={whatIfMode && isWhatIfSet}
                    onGameClick={handleGameClick}
                    hypotheticalResults={hypotheticalResults}
                    teamId={team.nhlId}
                    teamColors={effectiveTeamColors}
                    darkModeColors={darkModeColors}
                  />
                );
              })}
          </div>
        </div>

        {/* Footer */}
        <footer className={`text-center text-sm mt-8 pb-8 ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}>
          <p className="text-xs mb-2">
            Data provided by NHL API | Updates automatically every 5 minutes
          </p>
          <p className="text-xs">
            © {new Date().getFullYear()} JRR Apps. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
