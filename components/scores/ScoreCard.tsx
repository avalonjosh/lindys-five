'use client';

import Link from 'next/link';
import type { NHLGame } from '@/lib/types';
import { TEAMS } from '@/lib/teamConfig';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';

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

// Get period display text
const getPeriodText = (game: NHLGame): string => {
  const period = game.periodDescriptor?.number || game.period;
  const periodType = game.periodDescriptor?.periodType;

  if (periodType === 'OT') return 'OT';
  if (periodType === 'SO') return 'SO';

  if (period === 1) return '1ST';
  if (period === 2) return '2ND';
  if (period === 3) return '3RD';
  if (period && period > 3) return `${period}OT`;

  return '';
};

// Get TV networks string (US only, limit to 2)
const getTvNetworks = (game: NHLGame): string | null => {
  if (!game.tvBroadcasts || game.tvBroadcasts.length === 0) return null;

  const usNetworks = game.tvBroadcasts
    .filter(b => b.countryCode === 'US')
    .map(b => b.network)
    .slice(0, 2);

  return usNetworks.length > 0 ? usNetworks.join(', ') : null;
};

// Determine winner for finished games
const getWinner = (game: NHLGame): 'home' | 'away' | null => {
  if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') return null;

  const homeScore = game.homeTeam.score ?? 0;
  const awayScore = game.awayTeam.score ?? 0;

  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return null;
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

  const tvNetworks = getTvNetworks(game);
  const winner = getWinner(game);

  // Status badge content
  const renderStatusBadge = () => {
    if (isLive) {
      const periodText = getPeriodText(game);
      const timeText = game.clock?.inIntermission
        ? 'INT'
        : game.clock?.timeRemaining || '';

      return (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">
            {periodText}
          </span>
          {timeText && (
            <span className="text-xs font-semibold text-gray-600">
              {timeText}
            </span>
          )}
        </div>
      );
    }

    if (isFinished) {
      const periodType = game.gameOutcome?.lastPeriodType;
      const suffix = periodType === 'OT' ? '/OT' : periodType === 'SO' ? '/SO' : '';

      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-700">
          Final{suffix}
        </span>
      );
    }

    // Upcoming
    const timeStr = game.startTimeUTC ? formatStartTime(game.startTimeUTC) : 'TBD';
    return (
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
        {timeStr}
      </span>
    );
  };

  // Team row component
  const TeamRow = ({
    team,
    linkPath,
    isWinner
  }: {
    team: typeof game.homeTeam;
    linkPath: string;
    isWinner: boolean;
  }) => (
    <div className="flex items-center gap-3 py-2">
      <Link
        href={linkPath}
        className="flex-shrink-0 hover:scale-110 transition-transform"
      >
        <img
          src={team.logo}
          alt={team.abbrev}
          className="w-10 h-10 object-contain"
        />
      </Link>
      <div className="flex-1">
        <span className={`text-sm font-semibold ${
          isWinner ? 'text-gray-900' : 'text-gray-600'
        }`}>
          {team.abbrev}
        </span>
        {team.wins !== undefined && (
          <span className="ml-2 text-xs text-gray-400 tabular-nums">
            {team.wins}-{team.losses}-{team.otLosses}
          </span>
        )}
      </div>
      {!isUpcoming && (
        <div className="flex flex-col items-end">
          <span className={`text-2xl tabular-nums ${
            isWinner ? 'font-bold text-gray-900' : 'font-medium text-gray-500'
          }`}>
            {team.score}
          </span>
          {team.sog !== undefined && team.sog !== null && (
            <span className="text-xs text-gray-400 tabular-nums">
              {team.sog} SOG
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`rounded-xl p-4 bg-white border-gray-200 ${
        isFavoriteGame
          ? 'border-2 shadow-lg'
          : 'border shadow-md'
      }`}
      style={isFavoriteGame ? { borderColor: '#FFB81C' } : undefined}
    >
      {/* Top bar: Status + TV Networks + Tickets */}
      <div className="flex items-center justify-between mb-3">
        {renderStatusBadge()}
        <div className="flex items-center gap-3">
          {!isFinished && tvNetworks && (
            <span className="text-xs text-gray-400">
              {tvNetworks}
            </span>
          )}
          {isUpcoming && ticketLink && (
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

      {/* Away Team Row */}
      <TeamRow
        team={game.awayTeam}
        linkPath={awayLinkPath}
        isWinner={winner === 'away'}
      />

      {/* Divider */}
      <div className="border-t border-gray-100 my-1" />

      {/* Home Team Row */}
      <TeamRow
        team={game.homeTeam}
        linkPath={homeLinkPath}
        isWinner={winner === 'home'}
      />

    </div>
  );
}
