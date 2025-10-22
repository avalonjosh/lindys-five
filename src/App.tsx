import { useEffect, useState } from 'react';
import type { GameChunk, SeasonStats, ChunkStats } from './types';
import { fetchSabresSchedule } from './services/nhlApi';
import { calculateChunks, calculateSeasonStats, calculateChunkStats } from './utils/chunkCalculator';
import ChunkCard from './components/ChunkCard';
import ProgressBar from './components/ProgressBar';

function App() {
  const [chunks, setChunks] = useState<GameChunk[]>([]);
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [chunkStatsCache, setChunkStatsCache] = useState<Map<number, ChunkStats>>(new Map());
  const [isGoatMode, setIsGoatMode] = useState(() => {
    const saved = localStorage.getItem('sabres-theme');
    return saved === 'goat';
  });

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
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
              Lindy's Five
            </h1>
            <h2 className={`text-sm md:text-2xl font-semibold mb-1 px-2 leading-tight ${
              isGoatMode ? 'text-red-500' : 'text-sabres-gold'
            }`}>
              Buffalo Sabres Road to the Playoffs 2025-2026
            </h2>
            <p className="text-white text-xs md:text-base opacity-90 px-2 leading-tight">
              5-Game Chunk Analysis<br className="md:hidden" /> Target: 6+ points per chunk
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        {stats && <ProgressBar stats={stats} isGoatMode={isGoatMode} />}

        {/* Chunk Grid */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className={`text-2xl font-bold ${
              isGoatMode ? 'text-white' : 'text-sabres-navy'
            }`}>Game Chunks</h2>
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                hideCompleted
                  ? isGoatMode
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-sabres-blue text-white shadow-md'
                  : isGoatMode
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {hideCompleted ? 'Show All Chunks' : 'Hide Completed Chunks'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {chunks
              .filter(chunk => !hideCompleted || !chunk.isComplete)
              .map((chunk, index, filteredChunks) => {
                // Find the previous chunk (by chunk number, not filtered index)
                const previousChunk = chunks.find(c => c.chunkNumber === chunk.chunkNumber - 1);
                const previousChunkStats = previousChunk
                  ? chunkStatsCache.get(previousChunk.chunkNumber)
                  : undefined;

                return (
                  <ChunkCard
                    key={chunk.chunkNumber}
                    chunk={chunk}
                    isGoatMode={isGoatMode}
                    previousChunkStats={previousChunkStats}
                    onStatsCalculated={handleStatsCalculated}
                  />
                );
              })}
          </div>
        </div>

        {/* Footer */}
        <footer className={`text-center text-sm mt-8 pb-8 ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}>
          <p className="mb-2">
            <strong className={isGoatMode ? 'text-red-500' : 'text-sabres-navy'}>Coach's Strategy:</strong> The team focuses on 5-game chunks, aiming for at least 6 out of 10 points per chunk.
          </p>
          <p className="text-xs">
            Data provided by NHL API | Updates automatically every 5 minutes
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
