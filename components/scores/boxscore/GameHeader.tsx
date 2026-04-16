'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TEAMS } from '@/lib/teamConfig';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';
import { trackClick } from '@/lib/analytics';
import type { BoxscoreResponse, LandingResponse, Linescore, ScoringPeriod } from '@/lib/types/boxscore';

interface GameHeaderProps {
  boxscore: BoxscoreResponse;
  landing: LandingResponse;
}

// Find team slug by abbreviation for linking
const getTeamSlug = (abbrev: string): string | null => {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.slug || null;
};

// Format game date/time in Eastern timezone
const formatGameDateTime = (utcTime: string, timeTbd = false): string => {
  const date = new Date(utcTime);
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  const datePart = date.toLocaleString('en-US', dateOptions);
  if (timeTbd) return `${datePart}, TBD`;
  const timePart = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart} ET`;
};

// Get TV networks string (US only, limit to 2)
const getTvNetworks = (broadcasts?: BoxscoreResponse['tvBroadcasts']): string | null => {
  if (!broadcasts || broadcasts.length === 0) return null;

  const usNetworks = broadcasts
    .filter(b => b.countryCode === 'US')
    .map(b => b.network)
    .slice(0, 2);

  return usNetworks.length > 0 ? usNetworks.join(', ') : null;
};

// Get period column header label
const getPeriodLabel = (periodNumber: number, periodType: string): string => {
  if (periodType === 'OT') return 'OT';
  if (periodType === 'SO') return 'SO';
  if (periodNumber <= 3) return String(periodNumber);
  return `OT${periodNumber - 3}`;
};

// Get period display text for live games
const getLivePeriodText = (boxscore: BoxscoreResponse): string => {
  const period = boxscore.periodDescriptor?.number;
  const periodType = boxscore.periodDescriptor?.periodType;

  if (periodType === 'OT') return 'OT';
  if (periodType === 'SO') return 'SO';

  if (period === 1) return '1st';
  if (period === 2) return '2nd';
  if (period === 3) return '3rd';
  if (period && period > 3) return `${period - 3}OT`;

  return '';
};

// Build linescore from scoring summary since the API doesn't provide it directly
function buildLinescore(scoring: ScoringPeriod[], homeAbbrev: string, awayAbbrev: string): Linescore {
  const byPeriod: Linescore['byPeriod'] = [];
  let totalHome = 0;
  let totalAway = 0;

  for (const period of scoring) {
    let periodHome = 0;
    let periodAway = 0;
    for (const goal of period.goals) {
      if (goal.teamAbbrev.default === homeAbbrev) {
        periodHome++;
      } else {
        periodAway++;
      }
    }
    totalHome += periodHome;
    totalAway += periodAway;
    byPeriod.push({
      periodDescriptor: period.periodDescriptor,
      home: periodHome,
      away: periodAway,
    });
  }

  // Ensure at least 3 periods are shown even if no goals in later periods
  for (let i = byPeriod.length; i < 3; i++) {
    byPeriod.push({
      periodDescriptor: { number: i + 1, periodType: 'REG' },
      home: 0,
      away: 0,
    });
  }

  return { byPeriod, totals: { home: totalHome, away: totalAway } };
}

export default function GameHeader({ boxscore, landing }: GameHeaderProps) {
  const { homeTeam, awayTeam } = boxscore;
  const linescore = buildLinescore(
    landing.summary?.scoring || [],
    homeTeam.abbrev,
    awayTeam.abbrev,
  );
  // Use actual scores from boxscore as authoritative totals
  linescore.totals = { home: homeTeam.score, away: awayTeam.score };

  const isLive = boxscore.gameState === 'LIVE' || boxscore.gameState === 'CRIT';
  const isFinished = boxscore.gameState === 'FINAL' || boxscore.gameState === 'OFF';
  const isFuture = boxscore.gameState === 'FUT' || boxscore.gameState === 'PRE';

  const awaySlug = getTeamSlug(awayTeam.abbrev);
  const homeSlug = getTeamSlug(homeTeam.abbrev);
  const awayLink = awaySlug ? `/${awaySlug}` : '/';
  const homeLink = homeSlug ? `/${homeSlug}` : '/';

  const tvNetworks = getTvNetworks(boxscore.tvBroadcasts);
  const venue = boxscore.venue?.default;
  const dateTimeStr = boxscore.startTimeUTC
    ? formatGameDateTime(boxscore.startTimeUTC, boxscore.gameScheduleState === 'TBD')
    : '';

  // Ticket link for future games
  const venueTeamConfig = Object.values(TEAMS).find(t => t.abbreviation === homeTeam.abbrev);
  const ticketLink = isFuture && venueTeamConfig
    ? generateGameTicketLink(
        venueTeamConfig.slug,
        venueTeamConfig.city,
        venueTeamConfig.stubhubId,
        homeTeam.abbrev,
        awayTeam.abbrev,
        boxscore.gameDate,
      )
    : null;

  // Status badge
  const renderStatusBadge = () => {
    if (isLive) {
      const periodText = getLivePeriodText(boxscore);
      const clockText = boxscore.clock?.inIntermission
        ? 'INT'
        : boxscore.clock?.timeRemaining || '';

      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <span className="text-white font-bold text-sm">
            {periodText}
          </span>
          {clockText && (
            <span className="text-white/70 text-sm font-semibold">
              {clockText}
            </span>
          )}
        </div>
      );
    }

    if (isFinished) {
      const periodType = boxscore.gameOutcome?.lastPeriodType;
      const suffix = periodType === 'OT' ? '/OT' : periodType === 'SO' ? '/SO' : '';

      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
          Final{suffix}
        </span>
      );
    }

    // Upcoming / pregame
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
        Pregame
      </span>
    );
  };

  return (
    <div className="border-b" style={{ backgroundColor: '#003087', borderBottomColor: '#0A1128' }}>
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Back link */}
        <Link
          href="/nhl/scores"
          className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scores
        </Link>

        {/* Main score display */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
          {/* Away team */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href={awayLink}
              className="flex-shrink-0 hover:scale-110 transition-transform"
            >
              <img
                src={awayTeam.logo}
                alt={awayTeam.abbrev}
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              />
            </Link>
            <div className="text-center">
              <div className="text-white/70 text-xs font-semibold tracking-wide uppercase mb-1">
                {awayTeam.abbrev}
              </div>
              {!isFuture && (
                <div className="text-white text-3xl sm:text-5xl font-bold tabular-nums">
                  {awayTeam.score}
                </div>
              )}
            </div>
          </div>

          {/* Center: status badge + ticket CTA for future games */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            {renderStatusBadge()}
            {ticketLink && (
              <a
                href={ticketLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick('ticket-boxscore', `${homeTeam.abbrev}-vs-${awayTeam.abbrev}`)}
                className="px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all shadow-md hover:shadow-lg bg-white text-[#003087] hover:bg-white/90"
              >
                Get Tickets
              </a>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-white/70 text-xs font-semibold tracking-wide uppercase mb-1">
                {homeTeam.abbrev}
              </div>
              {!isFuture && (
                <div className="text-white text-3xl sm:text-5xl font-bold tabular-nums">
                  {homeTeam.score}
                </div>
              )}
            </div>
            <Link
              href={homeLink}
              className="flex-shrink-0 hover:scale-110 transition-transform"
            >
              <img
                src={homeTeam.logo}
                alt={homeTeam.abbrev}
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              />
            </Link>
          </div>
        </div>

        {/* Period linescore table */}
        {!isFuture && linescore.byPeriod.length > 0 && (
          <div className="flex justify-center mt-2 mb-3 overflow-x-auto">
            <table className="text-xs text-white/80">
              <thead>
                <tr className="text-white/50">
                  <th className="px-1.5 sm:px-3 py-1 text-left font-medium w-10 sm:w-12" />
                  {linescore.byPeriod.map((period) => (
                    <th
                      key={period.periodDescriptor.number}
                      className="px-1 sm:px-2 py-1 text-center font-medium min-w-[24px] sm:min-w-[28px]"
                    >
                      {getPeriodLabel(period.periodDescriptor.number, period.periodDescriptor.periodType)}
                    </th>
                  ))}
                  <th className="px-1 sm:px-2 py-1 text-center font-bold min-w-[24px] sm:min-w-[28px]">T</th>
                </tr>
              </thead>
              <tbody>
                {/* Away row */}
                <tr>
                  <td className="px-1.5 sm:px-3 py-1 text-left font-semibold text-white">
                    {awayTeam.abbrev}
                  </td>
                  {linescore.byPeriod.map((period) => (
                    <td
                      key={period.periodDescriptor.number}
                      className="px-1 sm:px-2 py-1 text-center tabular-nums"
                    >
                      {period.away}
                    </td>
                  ))}
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">
                    {linescore.totals.away}
                  </td>
                </tr>
                {/* Home row */}
                <tr>
                  <td className="px-1.5 sm:px-3 py-1 text-left font-semibold text-white">
                    {homeTeam.abbrev}
                  </td>
                  {linescore.byPeriod.map((period) => (
                    <td
                      key={period.periodDescriptor.number}
                      className="px-1 sm:px-2 py-1 text-center tabular-nums"
                    >
                      {period.home}
                    </td>
                  ))}
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">
                    {linescore.totals.home}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom info: venue, date/time, TV */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/60 pb-1">
          {venue && <span>{venue}</span>}
          {venue && dateTimeStr && <span>{'|'}</span>}
          {dateTimeStr && <span>{dateTimeStr}</span>}
          {tvNetworks && (
            <>
              <span>{'|'}</span>
              <span>{tvNetworks}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
