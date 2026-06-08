import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { MLB_TEAMS } from '@/lib/teamConfig';
import { fetchMLBScores, fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { getMLBPlayoffProbability } from '@/lib/utils/mlbStandingsCalc';
import { generateTeamTicketsLink } from '@/lib/utils/affiliateLinks';
import { getVerifiedSubscribersForTeam, sendMLBGameRecap, renderMLBGameRecapEmail, type MLBGameRecapEmailData } from '@/lib/email';
import type { MLBScoreGame, MLBStandingsTeam } from '@/lib/types/mlb';

// Off by default — real sends to subscribers only once this flag is set true.
const ENABLED_KEY = 'blog:settings:mlb-recap-enabled';

const ABBREV_TO_CFG = Object.fromEntries(Object.values(MLB_TEAMS).map((t) => [t.abbreviation, t]));

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Pre-game standings: reverse this game's result for the two teams involved, so
// we can show a before -> after playoff-odds delta (approximate — only the two
// teams' records change, not league-wide cut lines).
function reversedStandings(standings: MLBStandingsTeam[], teamAbbrev: string, teamWon: boolean, oppAbbrev: string): MLBStandingsTeam[] {
  return standings.map((t) => {
    if (t.teamAbbrev === teamAbbrev) return { ...t, wins: teamWon ? t.wins - 1 : t.wins, losses: teamWon ? t.losses : t.losses - 1 };
    if (t.teamAbbrev === oppAbbrev) return { ...t, wins: teamWon ? t.wins : t.wins - 1, losses: teamWon ? t.losses - 1 : t.losses };
    return t;
  });
}

async function buildData(game: MLBScoreGame, side: 'home' | 'away', standings: MLBStandingsTeam[], season: number): Promise<MLBGameRecapEmailData | null> {
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  const opp = side === 'home' ? game.awayTeam : game.homeTeam;
  const cfg = ABBREV_TO_CFG[team.abbrev];
  const standing = standings.find((t) => t.teamAbbrev === team.abbrev);
  if (!cfg || !standing) return null;
  const oppCfg = ABBREV_TO_CFG[opp.abbrev];
  const oppStanding = standings.find((t) => t.teamAbbrev === opp.abbrev);
  const teamWon = team.score > opp.score;

  const after = getMLBPlayoffProbability(standing, standings);
  const oppProbAfter = oppStanding ? getMLBPlayoffProbability(oppStanding, standings).probability : after.probability;

  const pre = reversedStandings(standings, team.abbrev, teamWon, opp.abbrev);
  const preTeam = pre.find((t) => t.teamAbbrev === team.abbrev)!;
  const probBefore = getMLBPlayoffProbability(preTeam, pre).probability;
  const preOpp = pre.find((t) => t.teamAbbrev === opp.abbrev);
  const oppProbBefore = preOpp ? getMLBPlayoffProbability(preOpp, pre).probability : oppProbAfter;

  // Next scheduled game (first not-yet-played).
  let nextGame: MLBGameRecapEmailData['nextGame'] = null;
  try {
    const sched = await fetchMLBSchedule(cfg.mlbId, season);
    const up = sched.find((g) => g.outcome === 'PENDING');
    if (up) {
      nextGame = {
        opponent: `${up.isHome ? 'vs' : '@'} ${up.opponent}`,
        date: up.startTime ? `${up.date} · ${up.startTime} ET` : up.date,
        ticketLink: generateTeamTicketsLink(cfg.slug, cfg.city, cfg.stubhubId),
      };
    }
  } catch {
    /* schedule optional */
  }

  return {
    teamSlug: cfg.slug,
    teamCity: cfg.city,
    teamName: cfg.name,
    teamAbbrev: cfg.abbreviation,
    oppAbbrev: oppCfg?.abbreviation ?? opp.abbrev,
    oppName: opp.name,
    primaryColor: cfg.colors.primary,
    won: teamWon,
    isHome: side === 'home',
    teamScore: team.score,
    oppScore: opp.score,
    gameId: game.gameId,
    probBefore,
    probAfter: after.probability,
    oppProbBefore,
    oppProbAfter,
    record: `${standing.wins}-${standing.losses}`,
    winPct: standing.winPct.toFixed(3).replace(/^0/, ''),
    projWins: after.projectedWins,
    gamesBack: standing.gamesBack === 0 ? '—' : `${standing.gamesBack}`,
    nextGame,
  };
}

const SAMPLE: MLBGameRecapEmailData = {
  teamSlug: 'yankees', teamCity: 'New York', teamName: 'Yankees', teamAbbrev: 'NYY', oppAbbrev: 'BOS', oppName: 'Red Sox',
  primaryColor: '#003087', won: true, isHome: true, teamScore: 6, oppScore: 3, gameId: 0,
  probBefore: 74, probAfter: 78, oppProbBefore: 55, oppProbAfter: 51,
  record: '50-34', winPct: '.595', projWins: 96, gamesBack: '—',
  nextGame: { opponent: '@ TB', date: 'Jun 9 · 7:05 PM ET', ticketLink: 'https://www.stubhub.com' },
};

async function completedGames(): Promise<MLBScoreGame[]> {
  const now = new Date();
  const days = [dateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000)), dateStr(now)];
  const out: MLBScoreGame[] = [];
  for (const day of days) {
    try {
      const games = await fetchMLBScores(day);
      for (const g of games) if (g.gameState === 'Final' || g.gameState === 'Game Over') out.push(g);
    } catch {
      /* offseason / no games */
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const season = new Date().getFullYear();

  // Preview: render a recap (most recent completed game, else a sample), no send.
  if (params.get('preview') === '1') {
    let data = SAMPLE;
    try {
      const games = await completedGames();
      if (games.length) {
        const standings = await fetchMLBStandings();
        data = (await buildData(games[0], 'home', standings, season)) ?? SAMPLE;
      }
    } catch {
      /* fall back to sample */
    }
    return new NextResponse(renderMLBGameRecapEmail(data, '#'), { headers: { 'Content-Type': 'text/html' } });
  }

  // Test: one email to the given address using the latest completed game (or sample).
  const testEmail = params.get('test');
  if (testEmail) {
    let data = SAMPLE;
    const games = await completedGames();
    if (games.length) {
      const standings = await fetchMLBStandings();
      data = (await buildData(games[0], 'home', standings, season)) ?? SAMPLE;
    }
    const { sent } = await sendMLBGameRecap([], data, { testEmail });
    return NextResponse.json({ test: true, to: testEmail, sent, usedSample: data === SAMPLE });
  }

  // Real send — gated.
  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) return NextResponse.json({ skipped: 'mlb-recap disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });

  const games = await completedGames();
  if (games.length === 0) return NextResponse.json({ sent: 0, note: 'no completed MLB games' });
  const standings = await fetchMLBStandings();

  const results: { team: string; status: string; sent?: number }[] = [];
  for (const game of games) {
    for (const side of ['home', 'away'] as const) {
      const data = await buildData(game, side, standings, season);
      if (!data) continue;
      const date = dateStr(new Date());
      const dedupeKey = `email:mlb-game-recap-sent:${data.teamSlug}:${game.gameId}`;
      if (await kv.get(dedupeKey)) {
        results.push({ team: data.teamSlug, status: 'already-sent' });
        continue;
      }
      const subscribers = await getVerifiedSubscribersForTeam(data.teamSlug);
      if (subscribers.length === 0) {
        results.push({ team: data.teamSlug, status: 'no-subscribers' });
        continue;
      }
      const { sent } = await sendMLBGameRecap(subscribers, data);
      await kv.set(dedupeKey, true, { ex: 60 * 60 * 48 });
      results.push({ team: data.teamSlug, status: 'sent', sent });
    }
  }
  return NextResponse.json({ results });
}
