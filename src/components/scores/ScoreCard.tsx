import { Link } from 'react-router-dom';
import type { NHLGame } from '../../types';
import { TEAMS } from '../../teamConfig';
import { generateGameTicketLink } from '../../utils/affiliateLinks';

interface ScoreCardProps {
  game: NHLGame;
  favoriteTeamAbbrev?: string;
}

// Find team slug by abbreviation for linking
const getTeamSlug = (abbrev: string): string | null => {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.slug || null;
};

// Get full team config by abbreviation for ticket links
const getTeamConfig = (abbrev: string) => {
  return Object.values(TEAMS).find(t => t.abbreviation === abbrev);
};

// Format start time in Eastern timezone
const formatStartTime = (utcTime: string): string => {
  const date = new Date(utcTime);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Get status display text
const getStatusText = (game: NHLGame): string => {
  if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
    const periodType = game.gameOutcome?.lastPeriodType;
    if (periodType === 'OT') return 'Final/OT';
    if (periodType === 'SO') return 'Final/SO';
    return 'Final';
  }
  if (game.gameState === 'LIVE' || game.gameState === 'CRIT') {
    return 'LIVE';
  }
  if (game.gameState === 'PRE') {
    return 'Pregame';
  }
  // FUT - upcoming game
  if (game.startTimeUTC) {
    return formatStartTime(game.startTimeUTC);
  }
  return 'TBD';
};

// Get period display text for live games
const getPeriodText = (game: NHLGame): string | null => {
  if (game.gameState !== 'LIVE' && game.gameState !== 'CRIT') return null;

  const period = game.periodDescriptor?.number || game.period;
  if (!period) return null;

  const periodType = game.periodDescriptor?.periodType;
  if (periodType === 'OT') return 'OT';
  if (periodType === 'SO') return 'SO';

  if (period === 1) return '1st';
  if (period === 2) return '2nd';
  if (period === 3) return '3rd';
  return `${period}th`;
};

// Format team record (W-L-OTL)
const formatRecord = (team: { wins?: number; losses?: number; otLosses?: number }): string | null => {
  if (team.wins === undefined || team.losses === undefined) return null;
  const otl = team.otLosses ?? 0;
  return `${team.wins}-${team.losses}-${otl}`;
};

// Get primary broadcast network (US National first, then Home team's network)
const getPrimaryBroadcast = (game: NHLGame): string | null => {
  if (!game.tvBroadcasts || game.tvBroadcasts.length === 0) return null;

  // First look for US National broadcast
  const usNational = game.tvBroadcasts.find(
    b => b.countryCode === 'US' && b.market === 'N'
  );
  if (usNational) return usNational.network;

  // Fall back to Home team's US regional network
  const homeRegional = game.tvBroadcasts.find(
    b => b.countryCode === 'US' && b.market === 'H'
  );
  if (homeRegional) return homeRegional.network;

  // Last resort: any US network
  const anyUS = game.tvBroadcasts.find(b => b.countryCode === 'US');
  return anyUS?.network || null;
};

export default function ScoreCard({ game, favoriteTeamAbbrev }: ScoreCardProps) {
  const isFavoriteGame = favoriteTeamAbbrev && (
    game.homeTeam.abbrev === favoriteTeamAbbrev || game.awayTeam.abbrev === favoriteTeamAbbrev
  );
  const isLive = game.gameState === 'LIVE' || game.gameState === 'CRIT';
  const isFinished = game.gameState === 'FINAL' || game.gameState === 'OFF';
  const isUpcoming = !isLive && !isFinished;

  // Get team slugs for logo links
  const homeTeamSlug = getTeamSlug(game.homeTeam.abbrev);
  const awayTeamSlug = getTeamSlug(game.awayTeam.abbrev);
  const homeLinkPath = homeTeamSlug ? `/${homeTeamSlug}` : '/';
  const awayLinkPath = awayTeamSlug ? `/${awayTeamSlug}` : '/';

  // Generate ticket link for upcoming games
  const homeTeamConfig = getTeamConfig(game.homeTeam.abbrev);
  const ticketLink = isUpcoming && homeTeamConfig
    ? generateGameTicketLink(
        homeTeamConfig.slug,
        homeTeamConfig.city,
        homeTeamConfig.stubhubId,
        game.homeTeam.abbrev,
        game.awayTeam.abbrev,
        game.gameDate
      )
    : null;

  const statusText = getStatusText(game);
  const periodText = getPeriodText(game);
  const broadcastNetwork = getPrimaryBroadcast(game);

  return (
    <div
      className={`rounded-xl p-4 bg-white border-gray-200 ${
        isFavoriteGame
          ? 'border-2 shadow-lg'
          : 'border shadow-md'
      }`}
      style={isFavoriteGame ? { borderColor: '#FFB81C' } : undefined}
    >
      {/* Status Badge */}
      <div className="flex justify-center mb-3">
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            isLive
              ? 'bg-red-500 text-white animate-pulse'
              : isFinished
                ? 'bg-gray-200 text-gray-700'
                : 'bg-blue-100 text-blue-700'
          }`}
        >
          {statusText}
        </span>
      </div>

      {/* TV Broadcast for upcoming/live games */}
      {!isFinished && broadcastNetwork && (
        <div className="text-center mb-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
            </svg>
            {broadcastNetwork}
          </span>
        </div>
      )}

      {/* Teams and Scores */}
      <div className="flex items-center justify-between gap-2">
        {/* Away Team */}
        <div className="flex-1 text-center">
          <Link
            to={awayLinkPath}
            className="rounded-lg p-2 mb-2 inline-block bg-gray-50 shadow-sm border border-gray-200 cursor-pointer transition-all hover:shadow-md hover:scale-105"
          >
            <img
              src={game.awayTeam.logo}
              alt={game.awayTeam.abbrev}
              className="w-12 h-12 object-contain"
            />
          </Link>
          <div className="text-sm font-bold text-gray-900">
            {game.awayTeam.abbrev}
          </div>
          {formatRecord(game.awayTeam) && (
            <div className="text-xs text-gray-500">
              {formatRecord(game.awayTeam)}
            </div>
          )}
          {!isUpcoming && (
            <div className="text-2xl font-bold mt-1 text-gray-900">
              {game.awayTeam.score}
            </div>
          )}
        </div>

        {/* VS / @ divider */}
        <div className="px-2 text-gray-400">
          <span className="text-lg font-light">@</span>
        </div>

        {/* Home Team */}
        <div className="flex-1 text-center">
          <Link
            to={homeLinkPath}
            className="rounded-lg p-2 mb-2 inline-block bg-gray-50 shadow-sm border border-gray-200 cursor-pointer transition-all hover:shadow-md hover:scale-105"
          >
            <img
              src={game.homeTeam.logo}
              alt={game.homeTeam.abbrev}
              className="w-12 h-12 object-contain"
            />
          </Link>
          <div className="text-sm font-bold text-gray-900">
            {game.homeTeam.abbrev}
          </div>
          {formatRecord(game.homeTeam) && (
            <div className="text-xs text-gray-500">
              {formatRecord(game.homeTeam)}
            </div>
          )}
          {!isUpcoming && (
            <div className="text-2xl font-bold mt-1 text-gray-900">
              {game.homeTeam.score}
            </div>
          )}
        </div>
      </div>

      {/* Get Tickets for upcoming games */}
      {isUpcoming && ticketLink && (
        <div className="mt-3 text-center">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(ticketLink, '_blank', 'noopener,noreferrer');
            }}
            className="inline-block px-3 py-1.5 text-xs font-bold rounded transition-all shadow-sm hover:shadow-md bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white cursor-pointer"
          >
            Get Tickets
          </button>
        </div>
      )}

      {/* Period and Time for live games */}
      {isLive && (
        <div className="mt-3 text-center text-sm text-gray-500">
          {periodText && <span className="font-semibold">{periodText}</span>}
          {game.clock?.timeRemaining && (
            <span className="ml-2">{game.clock.timeRemaining}</span>
          )}
          {game.clock?.inIntermission && (
            <span className="ml-2 italic">Intermission</span>
          )}
        </div>
      )}
    </div>
  );
}
