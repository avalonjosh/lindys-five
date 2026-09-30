import Link from 'next/link';
import type { LandingResponse, ScoringGoal } from '@/lib/types/boxscore';
import { NHL_TEAMS } from '@/lib/teamConfig';
import { nhlWatchInfo, watchSummary } from '@/lib/watch/nhlWatch';

// Server-rendered, plain-language summary of a game built from the landing
// payload. The interactive box score is client-rendered, so without this the
// initial HTML has almost no content for crawlers or AI engines.

const ET = 'America/New_York';

function teamFor(abbrev: string) {
  return Object.values(NHL_TEAMS).find((t) => t.abbreviation === abbrev);
}

function fullName(t: LandingResponse['homeTeam']) {
  return `${t.placeName.default} ${t.commonName.default}`.trim();
}

function periodLabel(p: { number: number; periodType: string }) {
  if (p.periodType === 'SO') return 'Shootout';
  if (p.periodType === 'OT') return p.number > 4 ? `${p.number - 3}OT` : 'Overtime';
  return ['1st Period', '2nd Period', '3rd Period'][p.number - 1] ?? `Period ${p.number}`;
}

function finishText(type: string | undefined) {
  if (type === 'OT') return ' in overtime';
  if (type === 'SO') return ' in a shootout';
  return '';
}

const STRENGTH: Record<string, string> = { pp: 'power play', sh: 'shorthanded', en: 'empty net' };

function goalText(g: ScoringGoal) {
  const scorer = `${g.firstName.default} ${g.lastName.default}`;
  const tag = STRENGTH[g.strength] ? `, ${STRENGTH[g.strength]}` : '';
  const assists = g.assists.length > 0
    ? `assisted by ${g.assists.map((a) => `${a.firstName.default} ${a.lastName.default}`).join(' and ')}`
    : 'unassisted';
  return `${g.timeInPeriod} ${g.teamAbbrev.default}: ${scorer} (${g.goalsToDate})${tag}, ${assists}. ${g.awayScore}-${g.homeScore}`;
}

export default function GameSummaryServer({ game }: { game: LandingResponse }) {
  const away = fullName(game.awayTeam);
  const home = fullName(game.homeTeam);
  const awayTeam = teamFor(game.awayTeam.abbrev);
  const homeTeam = teamFor(game.homeTeam.abbrev);
  const isFinal = ['FINAL', 'OFF'].includes(game.gameState);
  const isFuture = ['FUT', 'PRE'].includes(game.gameState);
  const kind = game.gameType === 1 ? 'preseason game' : game.gameType === 3 ? 'playoff game' : 'game';

  const dateText = new Date(`${game.gameDate}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const timeText = game.startTimeUTC
    ? new Date(game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET })
    : '';
  const venue = game.venue?.default ? ` at ${game.venue.default}` : '';
  const periods = (game.summary?.scoring ?? []).filter((p) => p.goals.length > 0 || p.periodDescriptor.periodType === 'REG');
  const stars = [...(game.summary?.threeStars ?? [])].sort((a, b) => a.star - b.star);
  const hasShots = game.awayTeam.sog != null && game.homeTeam.sog != null;
  const tv = watchSummary(nhlWatchInfo(game.tvBroadcasts));

  let lead: string;
  if (isFuture) {
    lead = `The ${away} visit the ${home} on ${dateText}${timeText ? ` at ${timeText} ET` : ''}${venue}.${tv ? ` TV: ${tv.replace(/ · /g, ', ')}.` : ''} This page becomes the live box score at puck drop, with scoring, player and goalie stats, and what the result means for each team's playoff odds.`;
  } else if (isFinal) {
    const homeWon = game.homeTeam.score > game.awayTeam.score;
    const winner = homeWon ? home : away;
    const loser = homeWon ? away : home;
    const score = `${Math.max(game.homeTeam.score, game.awayTeam.score)}-${Math.min(game.homeTeam.score, game.awayTeam.score)}`;
    const finish = finishText(game.gameOutcome?.lastPeriodType ?? game.periodDescriptor?.periodType);
    lead = `The ${winner} beat the ${loser} ${score}${finish} on ${dateText}${venue}${kind === 'game' ? '' : `, a ${kind}`}.${hasShots ? ` Shots on goal were ${game.awayTeam.sog}-${game.homeTeam.sog} (${game.awayTeam.abbrev}-${game.homeTeam.abbrev}).` : ''}`;
  } else {
    lead = `The ${away} and ${home} are playing on ${dateText}${venue}. The score is ${game.awayTeam.abbrev} ${game.awayTeam.score}, ${game.homeTeam.abbrev} ${game.homeTeam.score}${game.periodDescriptor ? ` in the ${periodLabel(game.periodDescriptor).toLowerCase()}` : ''}. This page updates live.`;
  }

  const linkClass = 'font-semibold text-blue-700 hover:underline';

  return (
    <section className="max-w-6xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6">
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl sm:p-6">
        <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-2xl">
          {isFuture ? 'Game Preview' : 'Game Summary'}: {game.awayTeam.commonName.default} at {game.homeTeam.commonName.default}
        </h2>
        <p className="text-sm leading-relaxed text-gray-700">{lead}</p>

        {!isFuture && periods.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-bold text-gray-900">Scoring Summary</h3>
            {periods.map((p) => (
              <div key={`${p.periodDescriptor.periodType}-${p.periodDescriptor.number}`} className="mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{periodLabel(p.periodDescriptor)}</p>
                {p.goals.length === 0 ? (
                  <p className="text-sm text-gray-700">No scoring.</p>
                ) : (
                  <ul className="text-sm text-gray-700">
                    {p.goals.map((g, i) => (
                      <li key={`${g.playerId}-${g.timeInPeriod}-${i}`}>{goalText(g)}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}

        {isFinal && stars.length > 0 && (
          <p className="mt-4 text-sm text-gray-700">
            <span className="font-bold text-gray-900">Three Stars:</span>{' '}
            {stars.map((s) => {
              const abbrev = typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev.default;
              return `${s.star}. ${s.name.default} (${abbrev})`;
            }).join(', ')}
          </p>
        )}

        <p className="mt-4 text-xs text-gray-500">
          More:{' '}
          {awayTeam && <><Link href={`/nhl/${awayTeam.id}`} className={linkClass}>{awayTeam.name} playoff odds and schedule</Link>{' · '}</>}
          {homeTeam && <><Link href={`/nhl/${homeTeam.id}`} className={linkClass}>{homeTeam.name} playoff odds and schedule</Link>{' · '}</>}
          {isFuture && homeTeam && <><Link href={`/nhl/${homeTeam.id}/watch`} className={linkClass}>How to watch the {homeTeam.name}</Link>{' · '}</>}
          {isFuture && awayTeam && <><Link href={`/nhl/${awayTeam.id}/watch`} className={linkClass}>How to watch the {awayTeam.name}</Link>{' · '}</>}
          <Link href="/nhl-playoff-odds" className={linkClass}>NHL playoff odds for all 32 teams</Link>
          {' · '}<Link href="/nhl/scores" className={linkClass}>NHL scores</Link>
        </p>
      </div>
    </section>
  );
}
