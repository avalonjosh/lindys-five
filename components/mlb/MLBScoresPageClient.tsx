'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { MLBScoreGame } from '@/lib/types/mlb';
import { fetchMLBScores } from '@/lib/services/mlbApi';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';
import DateNavigation from '@/components/scores/DateNavigation';

const getTodayString = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

const getFavoriteMLBSlug = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('favorite-teams');
    if (saved) {
      const favorites = JSON.parse(saved);
      if (Array.isArray(favorites)) return favorites.find((id: string) => MLB_TEAMS[id]) || null;
    }
  } catch { /* ignore */ }
  return null;
};

function findSlugByAbbrev(abbrev: string): string | null {
  const team = Object.values(MLB_TEAMS).find(t => t.abbreviation === abbrev);
  return team?.id || null;
}

export default function MLBScoresPageClient() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [games, setGames] = useState<MLBScoreGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteAbbrev, setFavoriteAbbrev] = useState<string | null>(null);
  const [backLink, setBackLink] = useState({ path: '/mlb', label: 'Back to MLB' });

  useEffect(() => {
    const slug = getFavoriteMLBSlug();
    if (slug) {
      const team = MLB_TEAMS[slug];
      if (team) {
        setFavoriteAbbrev(team.abbreviation);
        setBackLink({ path: `/mlb/${slug}`, label: 'Back to Tracker' });
      }
    }
  }, []);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const aIsFav = favoriteAbbrev && (a.awayTeam.abbrev === favoriteAbbrev || a.homeTeam.abbrev === favoriteAbbrev);
      const bIsFav = favoriteAbbrev && (b.awayTeam.abbrev === favoriteAbbrev || b.homeTeam.abbrev === favoriteAbbrev);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      const aIsLive = a.gameState === 'In Progress';
      const bIsLive = b.gameState === 'In Progress';
      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;
      return 0;
    });
  }, [games, favoriteAbbrev]);

  const fetchGames = useCallback(async () => {
    try {
      const data = await fetchMLBScores(selectedDate);
      setGames(data);
      setError(null);
    } catch {
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { setLoading(true); fetchGames(); }, [selectedDate, fetchGames]);

  useEffect(() => {
    const hasLive = games.some(g => g.gameState === 'In Progress');
    if (!hasLive || games.length === 0) return;
    const interval = setInterval(() => fetchGames(), 30000);
    return () => clearInterval(interval);
  }, [games.length, fetchGames]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="shadow-xl border-b-4" style={{ background: '#002D72', borderBottomColor: '#041E42' }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href={backLink.path} className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{backLink.label}</span>
          </Link>
          <div className="text-center">
            <Link href="/">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 hover:text-white/90 transition-colors" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                Lindy&apos;s Five
              </h1>
            </Link>
            <p className="text-xl text-white/80 mb-8">MLB Scores</p>
            <div className="flex justify-center">
              <DateNavigation selectedDate={selectedDate} onDateChange={(d) => { setSelectedDate(d); setLoading(true); }} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-blue-500" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12 rounded-xl bg-red-50 text-red-600">
            <p className="text-lg font-semibold mb-4">{error}</p>
            <button onClick={fetchGames} className="px-4 py-2 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600">Try Again</button>
          </div>
        )}

        {!loading && !error && sortedGames.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No games scheduled for this date.</p>
          </div>
        )}

        {!loading && !error && sortedGames.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedGames.map((game) => (
              <MLBScoreCard key={game.gameId} game={game} favoriteAbbrev={favoriteAbbrev} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MLBScoreCard({ game, favoriteAbbrev }: { game: MLBScoreGame; favoriteAbbrev: string | null }) {
  const router = useRouter();
  const isComplete = game.gameState === 'Final' || game.gameState === 'Completed Early';
  const isLive = game.gameState === 'In Progress';
  const isUpcoming = !isComplete && !isLive;
  const isFavoriteGame = favoriteAbbrev && (game.awayTeam.abbrev === favoriteAbbrev || game.homeTeam.abbrev === favoriteAbbrev);

  const winner = isComplete
    ? game.awayTeam.score > game.homeTeam.score ? 'away' : game.homeTeam.score > game.awayTeam.score ? 'home' : null
    : null;

  const awaySlug = Object.values(MLB_TEAMS).find(t => t.abbreviation === game.awayTeam.abbrev)?.id;
  const homeSlug = Object.values(MLB_TEAMS).find(t => t.abbreviation === game.homeTeam.abbrev)?.id;
  const homeTeamConfig = Object.values(MLB_TEAMS).find(t => t.abbreviation === game.homeTeam.abbrev);
  const ticketLink = isUpcoming && homeTeamConfig
    ? generateGameTicketLink(homeTeamConfig.slug, homeTeamConfig.city, homeTeamConfig.stubhubId, game.homeTeam.abbrev, game.awayTeam.abbrev)
    : null;

  const handleCardClick = () => {
    if (game.gameId) router.push(`/mlb/scores/${game.gameId}`);
  };

  const renderStatusBadge = () => {
    if (isLive) {
      return (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">
            {game.inningHalf === 'Top' ? 'T' : game.inningHalf === 'Bot' ? 'B' : ''}{game.inning ? ordinalInning(game.inning) : 'LIVE'}
          </span>
        </div>
      );
    }
    if (isComplete) {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-700">Final</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{game.startTime || 'TBD'}</span>;
  };

  const TeamRow = ({ team, slug, isWinner }: {
    team: MLBScoreGame['awayTeam'];
    slug?: string;
    isWinner: boolean;
  }) => (
    <div className="flex items-center gap-3 py-2">
      <button
        className="flex-shrink-0 hover:scale-110 transition-transform"
        onClick={(e) => { e.stopPropagation(); if (slug) router.push(`/mlb/${slug}`); }}
      >
        <img src={team.logo} alt={team.abbrev} className="w-10 h-10 object-contain" />
      </button>
      <div className="flex-1">
        <span className={`text-sm font-semibold ${isWinner ? 'text-gray-900' : 'text-gray-600'}`}>
          {team.abbrev}
        </span>
        {team.wins !== undefined && (
          <span className="ml-2 text-xs text-gray-400 tabular-nums">
            {team.wins}-{team.losses}
          </span>
        )}
      </div>
      {!isUpcoming && (
        <span className={`text-2xl tabular-nums ${isWinner ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>
          {team.score}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`rounded-xl p-4 bg-white border-gray-200 ${
        isFavoriteGame ? 'border-2 shadow-lg' : 'border shadow-md'
      } cursor-pointer hover:shadow-lg hover:border-blue-300 transition-shadow`}
      style={isFavoriteGame ? { borderColor: '#FFB81C' } : undefined}
      onClick={handleCardClick}
    >
      {/* Status badge + TV + Tickets */}
      <div className="flex items-center justify-between mb-3">
        {renderStatusBadge()}
        <div className="flex items-center gap-3">
          {!isComplete && game.tvNetworks && (
            <span className="text-xs text-gray-400">{game.tvNetworks}</span>
          )}
          {ticketLink && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(ticketLink, '_blank', 'noopener,noreferrer');
              }}
              className="px-2 py-0.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Tickets
            </button>
          )}
        </div>
      </div>

      {/* Away Team */}
      <TeamRow team={game.awayTeam} slug={awaySlug} isWinner={winner === 'away'} />

      {/* Divider */}
      <div className="border-t border-gray-100 my-1" />

      {/* Home Team */}
      <TeamRow team={game.homeTeam} slug={homeSlug} isWinner={winner === 'home'} />
    </div>
  );
}

function ordinalInning(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}
