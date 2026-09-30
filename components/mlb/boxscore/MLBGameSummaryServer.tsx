import Link from 'next/link';
import { MLB_TEAMS } from '@/lib/teamConfig';

// Server-rendered, plain-language summary of a game built from the schedule
// payload. The interactive box score is client-rendered, so without this the
// initial HTML has almost no content for crawlers or AI engines.

interface LineTotals {
  runs?: number;
  hits?: number;
  errors?: number;
}

interface SummaryTeam {
  score?: number;
  team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
}

export interface MLBSummaryGame {
  gameDate?: string;
  officialDate?: string;
  gameType?: string;
  seriesDescription?: string;
  seriesGameNumber?: number;
  status?: { abstractGameState?: string; detailedState?: string };
  venue?: { name?: string };
  teams?: { away?: SummaryTeam; home?: SummaryTeam };
  linescore?: {
    currentInningOrdinal?: string;
    inningState?: string;
    innings?: Array<{ num: number; home?: LineTotals; away?: LineTotals }>;
    teams?: { home?: LineTotals; away?: LineTotals };
  };
  decisions?: {
    winner?: { fullName?: string };
    loser?: { fullName?: string };
    save?: { fullName?: string };
  };
}

const ET = 'America/New_York';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function teamFor(id: number | undefined) {
  return Object.values(MLB_TEAMS).find((t) => t.mlbId === id);
}

export default function MLBGameSummaryServer({ game }: { game: MLBSummaryGame }) {
  const awayT = game.teams?.away;
  const homeT = game.teams?.home;
  const away = awayT?.team?.name;
  const home = homeT?.team?.name;
  if (!away || !home) return null;

  const awayTeam = teamFor(awayT?.team?.id);
  const homeTeam = teamFor(homeT?.team?.id);
  const awayAbbrev = awayT?.team?.abbreviation ?? awayTeam?.abbreviation ?? 'Away';
  const homeAbbrev = homeT?.team?.abbreviation ?? homeTeam?.abbreviation ?? 'Home';
  const state = game.status?.abstractGameState;
  const isFinal = state === 'Final' && awayT?.score != null && homeT?.score != null;
  const isFuture = state === 'Preview';
  const postseason = !!game.gameType && !['R', 'S', 'E', 'A'].includes(game.gameType);
  const seriesText = postseason && game.seriesDescription
    ? `${game.seriesDescription}${game.seriesGameNumber ? ` Game ${game.seriesGameNumber}` : ''}`
    : game.gameType === 'S' ? 'spring training' : '';

  const start = game.gameDate ? new Date(game.gameDate) : null;
  const dateText = start
    ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: ET })
    : '';
  const timeText = start
    ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET })
    : '';
  const on = dateText ? ` on ${dateText}` : '';
  const venue = game.venue?.name ? ` at ${game.venue.name}` : '';
  const innings = game.linescore?.innings ?? [];
  const totals = game.linescore?.teams;
  const d = game.decisions;

  let lead: string;
  if (isFinal) {
    const homeWon = (homeT?.score ?? 0) > (awayT?.score ?? 0);
    const score = `${Math.max(homeT?.score ?? 0, awayT?.score ?? 0)}-${Math.min(homeT?.score ?? 0, awayT?.score ?? 0)}`;
    const extras = innings.length > 9 ? ` in ${innings.length} innings` : '';
    lead = `The ${homeWon ? home : away} beat the ${homeWon ? away : home} ${score}${extras}${on}${venue}${seriesText ? ` (${seriesText})` : ''}.`;
    if (totals?.away?.hits != null && totals?.home?.hits != null) {
      lead += ` The ${awayT?.team?.teamName ?? away} had ${plural(totals.away.hits, 'hit')} and ${plural(totals.away.errors ?? 0, 'error')}; the ${homeT?.team?.teamName ?? home} had ${plural(totals.home.hits, 'hit')} and ${plural(totals.home.errors ?? 0, 'error')}.`;
    }
  } else if (isFuture) {
    lead = `The ${away} visit the ${home}${on}${timeText ? ` at ${timeText} ET` : ''}${venue}${seriesText ? ` (${seriesText})` : ''}. This page becomes the live box score at first pitch, with the line score, batting and pitching stats, scoring plays, and what the result means for each team's playoff odds.`;
  } else {
    const inning = game.linescore?.currentInningOrdinal
      ? ` in the ${(game.linescore.inningState ?? '').toLowerCase()} ${game.linescore.currentInningOrdinal}`.replace('  ', ' ')
      : '';
    lead = `The ${away} and ${home} are playing${on}${venue}. The score is ${awayAbbrev} ${awayT?.score ?? 0}, ${homeAbbrev} ${homeT?.score ?? 0}${inning}. This page updates live.`;
  }

  const decisions = isFinal && d?.winner?.fullName
    ? [`Win: ${d.winner.fullName}`, d.loser?.fullName ? `Loss: ${d.loser.fullName}` : '', d.save?.fullName ? `Save: ${d.save.fullName}` : ''].filter(Boolean).join('. ') + '.'
    : '';

  const linkClass = 'font-semibold text-blue-700 hover:underline';
  const cell = 'px-2 py-1 text-center';

  return (
    <section className="max-w-5xl mx-auto px-4 pb-6">
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl sm:p-6">
        <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-2xl">
          {isFuture ? 'Game Preview' : 'Game Summary'}: {awayT?.team?.teamName ?? away} at {homeT?.team?.teamName ?? home}
        </h2>
        <p className="text-sm leading-relaxed text-gray-700">{lead}</p>

        {!isFuture && innings.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm text-gray-700">
              <caption className="mb-1 text-left text-sm font-bold text-gray-900">Line Score</caption>
              <thead>
                <tr className="text-xs text-gray-500">
                  <th scope="col" className="px-2 py-1 text-left">Team</th>
                  {innings.map((inn) => <th key={inn.num} scope="col" className={cell}>{inn.num}</th>)}
                  <th scope="col" className={`${cell} font-bold text-gray-900`}>R</th>
                  <th scope="col" className={cell}>H</th>
                  <th scope="col" className={cell}>E</th>
                </tr>
              </thead>
              <tbody>
                {([['away', awayAbbrev], ['home', homeAbbrev]] as const).map(([side, abbrev]) => (
                  <tr key={side} className="border-t border-gray-100">
                    <th scope="row" className="px-2 py-1 text-left font-semibold text-gray-900">{abbrev}</th>
                    {innings.map((inn) => <td key={inn.num} className={cell}>{inn[side]?.runs ?? (isFinal ? 'X' : '')}</td>)}
                    <td className={`${cell} font-bold text-gray-900`}>{totals?.[side]?.runs ?? ''}</td>
                    <td className={cell}>{totals?.[side]?.hits ?? ''}</td>
                    <td className={cell}>{totals?.[side]?.errors ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {decisions && <p className="mt-3 text-sm text-gray-700">{decisions}</p>}

        <p className="mt-4 text-xs text-gray-500">
          More:{' '}
          {awayTeam && <><Link href={`/mlb/${awayTeam.id}`} className={linkClass}>{awayTeam.name} playoff odds and schedule</Link>{' · '}</>}
          {homeTeam && <><Link href={`/mlb/${homeTeam.id}`} className={linkClass}>{homeTeam.name} playoff odds and schedule</Link>{' · '}</>}
          {postseason && <><Link href="/mlb/watch" className={linkClass}>How to watch the MLB playoffs</Link>{' · '}</>}
          <Link href="/mlb/playoff-odds" className={linkClass}>MLB playoff odds for all 30 teams</Link>
          {' · '}<Link href="/mlb/scores" className={linkClass}>MLB scores</Link>
        </p>
      </div>
    </section>
  );
}
