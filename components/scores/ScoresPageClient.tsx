'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import MLBTeamNav from '@/components/mlb/MLBTeamNav';
import type { NHLGame } from '@/lib/types';
import type { StandingsTeam } from '@/lib/types/boxscore';
import { fetchScoresByDate, pollLiveGames, isRateLimitError } from '@/lib/services/nhlApi';
import { fetchStandingsForDate } from '@/lib/services/boxscoreApi';
import ScoreCard from '@/components/scores/ScoreCard';
import DateNavigation from '@/components/scores/DateNavigation';
import { TEAMS } from '@/lib/teamConfig';

// Get today's date in YYYY-MM-DD format (Eastern Time)
const getTodayString = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

// Whole calendar days from today (Eastern) until a YYYY-MM-DD date.
const daysUntil = (dateStr: string): number => {
  const todayEastern = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const today = Date.parse(`${todayEastern}T00:00:00Z`);
  const target = Date.parse(`${dateStr}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
};

// Render a calendar date without timezone drift by pinning to noon UTC.
const formatOpenerDate = (dateStr: string): string =>
  new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

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

interface ScoresPageClientProps {
  seasonComplete?: boolean;
  championName?: string;
  seasonLabel?: string;
  preseason?: boolean;
  upcomingSeasonLabel?: string;
  openingDate?: string;
  preseasonStartDate?: string;
}

export default function ScoresPageClient({
  seasonComplete = false,
  championName,
  seasonLabel,
  preseason = false,
  upcomingSeasonLabel,
  openingDate,
  preseasonStartDate,
}: ScoresPageClientProps) {
  // During the summer, open on Opening Night's slate instead of an empty date —
  // but once exhibition games are underway, today's slate has real games.
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = getTodayString();
    if (!preseason || !openingDate) return today;
    if (preseasonStartDate && today >= preseasonStartDate) return today;
    return openingDate;
  });
  const [games, setGames] = useState<NHLGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteTeamAbbrev, setFavoriteTeamAbbrev] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsTeam[]>([]);

  // Read localStorage on mount to avoid hydration mismatch
  useEffect(() => {
    const slug = getFavoriteTeamSlug();
    if (slug) {
      setFavoriteTeamAbbrev(getFavoriteTeamAbbrev(slug));
    }
  }, []);

  // Fetch standings once on mount for playoff stakes display
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    fetchStandingsForDate(today).then(data => {
      setStandings(data);
    });
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
      if (isRateLimitError(err)) {
        // Transient NHL rate-limit — don't surface a scary error banner; next poll will recover
        console.warn('NHL rate-limited scores fetch — will retry on next poll');
      } else {
        console.error('Failed to fetch games:', err);
        setError('Failed to load games. Please try again.');
      }
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

  const daysToOpen = preseason && openingDate ? daysUntil(openingDate) : null;
  const countdownLabel =
    daysToOpen === null
      ? ''
      : daysToOpen <= 0
        ? 'season under way'
        : daysToOpen === 1
          ? '1 day to puck drop'
          : `${daysToOpen} days to puck drop`;

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
          {/* Nav hamburger */}
          <div className="mb-6">
            <MLBTeamNav
              currentTeamId=""
              teamColors={{ primary: '#003087', secondary: '#FFB81C', accent: '#FFFFFF' }}
              defaultTab="nhl"
            />
          </div>

          {/* Header Content */}
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1
                className="text-5xl md:text-7xl font-bold text-white mb-2 hover:text-white/90 transition-colors"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Lindy&apos;s Five
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-2 mb-8">
              <img
                src="https://assets.nhle.com/logos/nhl/svg/NHL_light.svg"
                alt="NHL"
                className="w-6 h-6"
              />
              <p className="text-xl text-white/80">
                NHL Scores
              </p>
            </div>
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
        {/* Preseason banner — new season's schedule is out */}
        {preseason && openingDate ? (
          <div className="mb-6 rounded-xl border-2 px-4 py-4 text-center" style={{ backgroundColor: '#FBF5E6', borderColor: '#D4AF37' }}>
            <p className="text-sm md:text-base font-semibold" style={{ color: '#8a6d1b' }}>
              🏒 The {upcomingSeasonLabel ?? ''} NHL season opens {formatOpenerDate(openingDate)}
              {countdownLabel ? ` — ${countdownLabel}` : ''}.
            </p>
            <p className="mt-1 text-xs md:text-sm" style={{ color: '#9A7B1F' }}>
              {preseasonStartDate
                ? <>Preseason games start {formatOpenerDate(preseasonStartDate)} — the full schedule is out, browse any date below. </>
                : <>The full schedule is out — browse any date below. </>}
              Meanwhile, see the{' '}
              <Link href="/nhl-playoff-odds" className="underline">way-too-early playoff odds</Link> and{' '}
              <Link href="/nhl" className="underline">team trackers</Link>.
            </p>
          </div>
        ) : seasonComplete ? (
          /* Offseason banner — season over, next schedule not yet published */
          <div className="mb-6 rounded-xl border-2 px-4 py-4 text-center" style={{ backgroundColor: '#FBF5E6', borderColor: '#D4AF37' }}>
            <p className="text-sm md:text-base font-semibold" style={{ color: '#8a6d1b' }}>
              🏒 The {seasonLabel ?? ''} NHL season is complete{championName ? ` — the ${championName} won the Stanley Cup` : ''}.
            </p>
            <p className="mt-1 text-xs md:text-sm" style={{ color: '#9A7B1F' }}>
              Regular-season games return in October. Use the date picker to browse past results, or see the{' '}
              <Link href="/nhl-playoff-odds" className="underline">final standings</Link>.
            </p>
          </div>
        ) : null}

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
            <p className="text-lg font-semibold">
              {seasonComplete && !preseason ? 'No games — the NHL season is complete' : 'No games scheduled for this date'}
            </p>
            {preseason && openingDate && selectedDate !== openingDate ? (
              <button
                onClick={() => handleDateChange(openingDate)}
                className="inline-block mt-4 text-blue-600 hover:text-blue-500 underline text-sm"
              >
                Jump to Opening Night ({formatOpenerDate(openingDate)}) →
              </button>
            ) : (
              <Link
                href="/nhl-playoff-odds"
                className="inline-block mt-4 text-blue-600 hover:text-blue-500 underline text-sm"
              >
                {seasonComplete || preseason ? 'View playoff odds' : 'View standings'}
              </Link>
            )}
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
