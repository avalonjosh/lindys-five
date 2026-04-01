'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { MLBBoxScoreData } from '@/lib/types/mlb';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';

// Teams whose logo blends into the dark header background
const MLB_BG_TEAM_IDS = new Set(['orioles', 'reds', 'cardinals', 'angels', 'phillies', 'nationals', 'rays', 'tigers', 'royals', 'twins', 'dodgers', 'giants', 'rockies', 'padres']);

function needsWhiteCircle(abbreviation: string): boolean {
  const team = Object.values(MLB_TEAMS).find(t => t.abbreviation === abbreviation);
  return team ? MLB_BG_TEAM_IDS.has(team.id) : false;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getInningText(data: MLBBoxScoreData): string {
  const inning = data.currentInning;
  if (!inning) return 'Live';
  const half = data.inningHalf === 'top' ? 'Top' : data.inningHalf === 'bottom' ? 'Bot' : '';
  return `${half} ${ordinal(inning)}`;
}

export default function MLBGameHeader({ data }: { data: MLBBoxScoreData }) {
  const isLive = data.status === 'In Progress' || data.status === 'Warming Up';
  const isComplete = data.status === 'Final' || data.status === 'Completed Early';
  const isFuture = !isLive && !isComplete;

  const awaySlug = Object.values(MLB_TEAMS).find(t => t.abbreviation === data.awayTeam.abbreviation)?.id;
  const homeSlug = Object.values(MLB_TEAMS).find(t => t.abbreviation === data.homeTeam.abbreviation)?.id;
  const awayLink = awaySlug ? `/mlb/${awaySlug}` : '/mlb';
  const homeLink = homeSlug ? `/mlb/${homeSlug}` : '/mlb';

  const gameDate = data.dateTime ? new Date(data.dateTime) : null;
  const dateTimeStr = gameDate
    ? `${gameDate.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} ET`
    : '';

  // Ticket link for future games
  const homeTeamConfig = Object.values(MLB_TEAMS).find(t => t.abbreviation === data.homeTeam.abbreviation);
  const ticketLink = isFuture && homeTeamConfig
    ? generateGameTicketLink(
        homeTeamConfig.slug,
        homeTeamConfig.city,
        homeTeamConfig.stubhubId,
        data.homeTeam.abbreviation,
        data.awayTeam.abbreviation,
        data.dateTime,
      )
    : null;

  // Status badge
  const renderStatusBadge = () => {
    if (isLive) {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <span className="text-white font-bold text-sm">
            {getInningText(data)}
          </span>
        </div>
      );
    }

    if (isComplete) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
          Final
        </span>
      );
    }

    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
        Pregame
      </span>
    );
  };

  return (
    <div className="border-b" style={{ backgroundColor: '#002D72', borderBottomColor: '#041E42' }}>
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Back link */}
        <Link
          href="/mlb/scores"
          className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scores
        </Link>

        {/* Main score display */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
          {/* Away team */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href={awayLink} className="flex-shrink-0 hover:scale-110 transition-transform">
              {needsWhiteCircle(data.awayTeam.abbreviation) ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center p-1.5 sm:p-2">
                  <img src={data.awayTeam.logo} alt={data.awayTeam.abbreviation} className="w-full h-full object-contain" />
                </div>
              ) : (
                <img src={data.awayTeam.logo} alt={data.awayTeam.abbreviation} className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
              )}
            </Link>
            <div className="text-center">
              <div className="text-white/70 text-xs font-semibold tracking-wide uppercase mb-1">
                {data.awayTeam.abbreviation}
              </div>
              {!isFuture && (
                <div className="text-white text-3xl sm:text-5xl font-bold tabular-nums">
                  {data.linescore.away.runs}
                </div>
              )}
            </div>
          </div>

          {/* Center: status badge + ticket CTA */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            {renderStatusBadge()}
            {ticketLink && (
              <a
                href={ticketLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all shadow-md hover:shadow-lg bg-white text-[#002D72] hover:bg-white/90"
              >
                Get Tickets
              </a>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-white/70 text-xs font-semibold tracking-wide uppercase mb-1">
                {data.homeTeam.abbreviation}
              </div>
              {!isFuture && (
                <div className="text-white text-3xl sm:text-5xl font-bold tabular-nums">
                  {data.linescore.home.runs}
                </div>
              )}
            </div>
            <Link href={homeLink} className="flex-shrink-0 hover:scale-110 transition-transform">
              {needsWhiteCircle(data.homeTeam.abbreviation) ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center p-1.5 sm:p-2">
                  <img src={data.homeTeam.logo} alt={data.homeTeam.abbreviation} className="w-full h-full object-contain" />
                </div>
              ) : (
                <img src={data.homeTeam.logo} alt={data.homeTeam.abbreviation} className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
              )}
            </Link>
          </div>
        </div>

        {/* Inning linescore table */}
        {!isFuture && data.linescore.innings.length > 0 && (
          <div className="flex justify-center mt-2 mb-3 overflow-x-auto">
            <table className="text-xs text-white/80">
              <thead>
                <tr className="text-white/50">
                  <th className="px-1.5 sm:px-3 py-1 text-left font-medium w-10 sm:w-12" />
                  {data.linescore.innings.map(inn => (
                    <th key={inn.num} className="px-1 sm:px-2 py-1 text-center font-medium min-w-[24px] sm:min-w-[28px]">
                      {inn.num}
                    </th>
                  ))}
                  <th className="px-1 sm:px-2 py-1 text-center font-bold min-w-[24px] sm:min-w-[28px]">R</th>
                  <th className="px-1 sm:px-2 py-1 text-center font-bold min-w-[24px] sm:min-w-[28px]">H</th>
                  <th className="px-1 sm:px-2 py-1 text-center font-bold min-w-[24px] sm:min-w-[28px]">E</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1.5 sm:px-3 py-1 text-left font-semibold text-white">{data.awayTeam.abbreviation}</td>
                  {data.linescore.innings.map(inn => (
                    <td key={inn.num} className="px-1 sm:px-2 py-1 text-center tabular-nums">{inn.away.runs}</td>
                  ))}
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">{data.linescore.away.runs}</td>
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">{data.linescore.away.hits}</td>
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">{data.linescore.away.errors}</td>
                </tr>
                <tr>
                  <td className="px-1.5 sm:px-3 py-1 text-left font-semibold text-white">{data.homeTeam.abbreviation}</td>
                  {data.linescore.innings.map(inn => (
                    <td key={inn.num} className="px-1 sm:px-2 py-1 text-center tabular-nums">{inn.home.runs}</td>
                  ))}
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">{data.linescore.home.runs}</td>
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">{data.linescore.home.hits}</td>
                  <td className="px-1 sm:px-2 py-1 text-center font-bold text-white tabular-nums">{data.linescore.home.errors}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom info: venue, date/time */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/60 pb-1">
          {data.venue && <span>{data.venue}</span>}
          {data.venue && dateTimeStr && <span>|</span>}
          {dateTimeStr && <span>{dateTimeStr}</span>}
        </div>
      </div>
    </div>
  );
}
