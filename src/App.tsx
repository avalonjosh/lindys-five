import { useEffect, useState } from 'react';
import type { GameChunk, SeasonStats, ChunkStats, GameResult } from './types';
import { fetchSabresSchedule, fetchLastSeasonComparison } from './services/nhlApi';
import { calculateChunks, calculateSeasonStats, calculateChunkStats } from './utils/chunkCalculator';
import ChunkCard from './components/ChunkCard';
import ProgressBar from './components/ProgressBar';

// Force rebuild - clean deploy
function App() {
  const [chunks, setChunks] = useState<GameChunk[]>([]);
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [chunkStatsCache, setChunkStatsCache] = useState<Map<number, ChunkStats>>(new Map());
  const [isGoatMode, setIsGoatMode] = useState(() => {
    const saved = localStorage.getItem('sabres-theme');
    return saved === 'goat';
  });
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [hypotheticalResults, setHypotheticalResults] = useState<Map<number, GameResult>>(new Map());
  const [yearOverYearMode, setYearOverYearMode] = useState(false);
  const [lastSeasonData, setLastSeasonData] = useState<{ pointsLastYear: number; recordLastYear: string } | null>(null);

  const toggleTheme = () => {
    setIsGoatMode(prev => {
      const newMode = !prev;
      localStorage.setItem('sabres-theme', newMode ? 'goat' : 'classic');
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
      const schedule = await fetchSabresSchedule('20252026');

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
  }, []);

  // Fetch last season comparison data when Year-over-Year mode is enabled
  useEffect(() => {
    const fetchLastSeasonData = async () => {
      if (yearOverYearMode && stats && stats.gamesPlayed > 0) {
        const comparison = await fetchLastSeasonComparison(stats.gamesPlayed);
        setLastSeasonData(comparison);
      }
    };
    fetchLastSeasonData();
  }, [yearOverYearMode, stats?.gamesPlayed]);

  // Pre-calculate stats for all completed chunks so comparisons work even when chunks are hidden
  useEffect(() => {
    const calculateAllCompletedStats = async () => {
      for (const chunk of chunks) {
        if (chunk.isComplete && !chunkStatsCache.has(chunk.chunkNumber)) {
          const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');
          if (hasPlayed) {
            try {
              const stats = await calculateChunkStats(chunk);
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
          ? 'bg-gradient-to-b from-black to-zinc-900'
          : 'bg-gradient-to-b from-sabres-navy to-sabres-blue'
      }`}>
        <div className="text-white text-2xl">Loading Sabres data...</div>
      </div>
    );
  }

  const logoUrl = isGoatMode
    ? '/goat-logo.png'
    : 'https://assets.nhle.com/logos/nhl/svg/BUF_light.svg';

  return (
    <div className={`min-h-screen ${
      isGoatMode
        ? 'bg-gradient-to-br from-black to-zinc-900'
        : 'bg-gradient-to-br from-slate-50 to-blue-50'
    }`}>
      {/* Header */}
      <header className={`shadow-xl border-b-4 ${
        isGoatMode
          ? 'bg-black border-red-600'
          : 'bg-gradient-to-r from-sabres-blue to-sabres-navy border-sabres-gold'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col items-center text-center relative">
            {/* Theme Toggle Switch */}
            <div className="absolute right-0 top-0">
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 md:h-7 md:w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isGoatMode
                    ? 'bg-red-600 focus:ring-red-500'
                    : 'bg-sabres-gold focus:ring-sabres-gold'
                }`}
                role="switch"
                aria-checked={isGoatMode}
                title={isGoatMode ? 'Switch to Classic Mode (Blue & Gold)' : 'Switch to GOAT Mode (Black & Red)'}
              >
                <span
                  className={`inline-block h-4 w-4 md:h-5 md:w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                    isGoatMode ? 'translate-x-6 md:translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <img
              src={logoUrl}
              alt="Buffalo Sabres Logo"
              className="w-16 h-16 md:w-24 md:h-24 mb-2 md:mb-3"
            />
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy's Five
            </h1>
            <h2 className={`text-sm md:text-2xl font-semibold mb-1 px-2 leading-tight ${
              isGoatMode ? 'text-red-500' : 'text-sabres-gold'
            }`}>
              Buffalo Sabres Road to the Playoffs 2025-2026
            </h2>
            <p className="text-white text-xs md:text-base opacity-90 px-2 leading-tight">
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
            isGoatMode={isGoatMode}
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
          />
        )}

        {/* What If Mode Banner */}
        {whatIfMode && (
          <div className={`mt-4 mb-4 p-3 rounded-lg border-2 ${
            isGoatMode
              ? 'bg-red-900/30 border-red-500 text-red-300'
              : 'bg-blue-100 border-blue-400 text-blue-800'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 flex-1 min-w-0">
                <span className="font-semibold text-sm md:text-base">What If Mode Active</span>
                <span className="text-xs md:text-sm opacity-80"><span className="hidden md:inline">- </span>Simulate pending games in the next 3 sets</span>
              </div>
              <button
                onClick={() => {
                  setHypotheticalResults(new Map());
                }}
                className={`px-3 py-1 rounded text-sm font-semibold transition-all whitespace-nowrap ${
                  isGoatMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Set Grid */}
        <div className={`mb-4 ${whatIfMode ? '' : 'mt-4'}`}>
          <div className="flex justify-between items-center mb-3 gap-2">
            <h2 className={`text-lg md:text-2xl font-bold ${
              isGoatMode ? 'text-white' : 'text-sabres-navy'
            }`}>Game Sets</h2>
            <div className="flex items-center gap-1.5 md:gap-3">
              {/* What If Toggle */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className={`text-xs md:text-sm font-semibold ${
                  whatIfMode
                    ? isGoatMode ? 'text-red-400' : 'text-sabres-blue'
                    : isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
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
                      ? isGoatMode
                        ? 'bg-red-600 focus:ring-red-500'
                        : 'bg-sabres-blue focus:ring-sabres-blue'
                      : isGoatMode
                        ? 'bg-zinc-700 focus:ring-zinc-500'
                        : 'bg-gray-400 focus:ring-gray-400'
                  }`}
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
                    ? isGoatMode
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-sabres-blue text-white shadow-md'
                    : isGoatMode
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
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
                    isGoatMode={isGoatMode}
                    previousChunkStats={previousChunkStats}
                    onStatsCalculated={handleStatsCalculated}
                    whatIfMode={whatIfMode && isWhatIfSet}
                    onGameClick={handleGameClick}
                    hypotheticalResults={hypotheticalResults}
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
