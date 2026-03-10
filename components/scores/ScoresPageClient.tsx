'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { NHLGame } from '@/lib/types';
import type { StandingsTeam } from '@/lib/types/boxscore';
import { fetchScoresByDate, pollLiveGames } from '@/lib/services/nhlApi';
import ScoreCard from '@/components/scores/ScoreCard';
import DateNavigation from '@/components/scores/DateNavigation';
import { TEAMS } from '@/lib/teamConfig';

// Get today's date in YYYY-MM-DD format (Eastern Time)
const getTodayString = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

// Get favorite team slug from localStorage
const getFavoriteTeamSlug = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('favorite-teams');
    if (saved) {
      const favorites = JSON.parse(saved);
      if (Array.isArray(favorites) && favorites.length > 0) {
        return favorites[0];
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

// Get favorite team abbreviation from slug
const getFavoriteTeamAbbrev = (slug: string | null): string | null => {
  if (!slug) return null;
  const team = TEAMS[slug];
  return team?.abbreviation || null;
};

// Get favorite team path for back button
const getFavoriteTeamPath = (): { path: string; label: string } => {
  const slug = getFavoriteTeamSlug();
  if (slug) {
    return { path: `/${slug}`, label: 'Back to Tracker' };
  }
  return { path: '/', label: 'Back to Home' };
};

export default function ScoresPageClient() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [games, setGames] = useState<NHLGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backLink, setBackLink] = useState<{ path: string; label: string }>({ path: '/', label: 'Back to Home' });
  const [favoriteTeamAbbrev, setFavoriteTeamAbbrev] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsTeam[]>([]);

  // Read localStorage on mount to avoid hydration mismatch
  useEffect(() => {
    const slug = getFavoriteTeamSlug();
    if (slug) {
      setBackLink({ path: `/${slug}`, label: 'Back to Tracker' });
      setFavoriteTeamAbbrev(getFavoriteTeamAbbrev(slug));
    }
  }, []);

  // Fetch standings once on mount for playoff stakes display
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetch(`https://api-web.nhle.com/v1/standings/${today}`)
      .then(res => res.json())
      .then(data => {
        if (data.standings) setStandings(data.standings);
      })
      .catch(err => console.error('Failed to fetch standings:', err));
  }, []);

  // Sort games: favorite team first, then live games, then by start time
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      // Favorite team games first
      const aIsFavorite = favoriteTeamAbbrev && (
        a.homeTeam.abbrev === favoriteTeamAbbrev || a.awayTeam.abbrev === favoriteTeamAbbrev
      );
      const bIsFavorite = favoriteTeamAbbrev && (
        b.homeTeam.abbrev === favoriteTeamAbbrev || b.awayTeam.abbrev === favoriteTeamAbbrev
      );
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;

      // Then live games
      const aIsLive = a.gameState === 'LIVE' || a.gameState === 'CRIT';
      const bIsLive = b.gameState === 'LIVE' || b.gameState === 'CRIT';
      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;

      // Then by start time
      const aTime = a.startTimeUTC || '';
      const bTime = b.startTimeUTC || '';
      return aTime.localeCompare(bTime);
    });
  }, [games, favoriteTeamAbbrev]);

  // Fetch games for selected date
  const fetchGames = useCallback(async () => {
    try {
      const data = await fetchScoresByDate(selectedDate);
      setGames(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Lightweight poll for live game updates only
  const pollGames = useCallback(async () => {
    try {
      const updated = await pollLiveGames(games);
      setGames(updated);
    } catch (err) {
      console.error('Failed to poll live games:', err);
    }
  }, [games]);

  // Initial fetch on date change
  useEffect(() => {
    setLoading(true);
    fetchGames();
  }, [selectedDate, fetchGames]);

  // Polling: lightweight for live games, full refresh less often
  useEffect(() => {
    const hasLiveOrPending = games.some(
      g => g.gameState === 'LIVE' || g.gameState === 'CRIT' || g.gameState === 'FUT' || g.gameState === 'PRE'
    );

    if (!hasLiveOrPending || games.length === 0) return;

    const hasLiveGames = games.some(
      g => g.gameState === 'LIVE' || g.gameState === 'CRIT'
    );

    // Live games: lightweight poll every 15s, full refresh every 5 min
    // Pending games only: check every 60s for game starts
    const pollInterval = hasLiveGames ? 15000 : 60000;
    let pollCount = 0;

    const interval = setInterval(() => {
      pollCount++;
      // Full refresh every 20 polls (5 min for live, 20 min for pending)
      if (pollCount % 20 === 0) {
        fetchGames();
      } else {
        pollGames();
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [games.length, fetchGames, pollGames]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setLoading(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Blue Header Section */}
      <header
        className="shadow-xl border-b-4"
        style={{
          background: '#003087',
          borderBottomColor: '#0A1128',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Back link */}
          <Link
            href={backLink.path}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{backLink.label}</span>
          </Link>

          {/* Header Content */}
          <div className="text-center">
            <h1
              className="text-5xl md:text-7xl font-bold text-white mb-2"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </h1>
            <p className="text-xl text-white/80 mb-8">
              Scores
            </p>
            <div className="flex justify-center">
              <DateNavigation
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-blue-500" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12 rounded-xl bg-red-50 text-red-600">
            <p className="text-lg font-semibold mb-4">{error}</p>
            <button
              onClick={fetchGames}
              className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-500 text-white hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        )}

        {/* No Games State */}
        {!loading && !error && sortedGames.length === 0 && (
          <div className="text-center py-12 rounded-xl bg-gray-100 text-gray-600">
            <p className="text-lg font-semibold">No games scheduled for this date</p>
          </div>
        )}

        {/* Games Grid */}
        {!loading && !error && sortedGames.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedGames.map(game => (
              <ScoreCard
                key={game.id}
                game={game}
                favoriteTeamAbbrev={favoriteTeamAbbrev || undefined}
                standings={standings}
              />
            ))}
          </div>
        )}

        {/* Live indicator */}
        {!loading && games.some(g => g.gameState === 'LIVE' || g.gameState === 'CRIT') && (
          <div className="mt-6 text-center text-sm text-gray-500">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Live games update every 15 seconds
            </span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-gray-500">
        <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
