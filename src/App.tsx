import { useEffect, useState } from 'react';
import type { GameChunk, SeasonStats } from './types';
import { fetchSabresSchedule } from './services/nhlApi';
import { calculateChunks, calculateSeasonStats } from './utils/chunkCalculator';
import ChunkCard from './components/ChunkCard';
import ProgressBar from './components/ProgressBar';

function App() {
  const [chunks, setChunks] = useState<GameChunk[]>([]);
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-gradient-to-b from-sabres-navy to-sabres-blue flex items-center justify-center">
        <div className="text-white text-2xl">Loading Sabres data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-sabres-blue to-sabres-navy shadow-xl border-b-4 border-sabres-gold">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center text-center">
            <img
              src="https://assets.nhle.com/logos/nhl/svg/BUF_light.svg"
              alt="Buffalo Sabres Logo"
              className="w-24 h-24 mb-4"
            />
            <h1 className="text-5xl font-bold text-white mb-2">
              Lindy's Five
            </h1>
            <h2 className="text-2xl font-semibold text-sabres-gold mb-1">
              Buffalo Sabres Road to the Playoffs 2025-2026
            </h2>
            <p className="text-white text-base opacity-90">
              5-Game Chunk Analysis - Target: 6+ points per chunk
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        {stats && <ProgressBar stats={stats} />}

        {/* Chunk Grid */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-sabres-navy mb-4">Game Chunks</h2>
          <div className="grid grid-cols-1 gap-6">
            {chunks.map((chunk) => (
              <ChunkCard key={chunk.chunkNumber} chunk={chunk} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm mt-8 pb-8">
          <p className="mb-2">
            <strong className="text-sabres-navy">Coach's Strategy:</strong> The team focuses on 5-game chunks, aiming for at least 6 out of 10 points per chunk.
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
