import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { MLB_TEAMS } from '@/lib/teamConfig';
import { fetchMLBScores, fetchMLBStandings } from '@/lib/services/mlbApi';
import { getMLBPlayoffProbability } from '@/lib/utils/mlbStandingsCalc';
import { getVerifiedSubscribersForTeam, sendMLBGameRecap, renderMLBGameRecapEmail, type MLBGameRecapEmailData } from '@/lib/email';
import type { MLBScoreGame, MLBStandingsTeam } from '@/lib/types/mlb';

// Off by default — real sends to subscribers only once this flag is set true.
const ENABLED_KEY = 'blog:settings:mlb-recap-enabled';

const ABBREV_TO_CFG = Object.fromEntries(Object.values(MLB_TEAMS).map((t) => [t.abbreviation, t]));

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildData(game: MLBScoreGame, side: 'home' | 'away', standings: MLBStandingsTeam[]): MLBGameRecapEmailData | null {
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  const opp = side === 'home' ? game.awayTeam : game.homeTeam;
  const cfg = ABBREV_TO_CFG[team.abbrev];
  const standing = standings.find((t) => t.teamAbbrev === team.abbrev);
  if (!cfg || !standing) return null;
  const odds = getMLBPlayoffProbability(standing, standings);
  return {
    teamSlug: cfg.slug,
    teamCity: cfg.city,
    teamName: cfg.name,
    primaryColor: cfg.colors.primary,
    won: team.score > opp.score,
    teamScore: team.score,
    oppScore: opp.score,
    oppName: `${opp.name}`,
    isHome: side === 'home',
    gameId: game.gameId,
    probability: odds.probability,
    projectedWins: odds.projectedWins,
    wins: standing.wins,
    losses: standing.losses,
  };
}

const SAMPLE: MLBGameRecapEmailData = {
  teamSlug: 'yankees', teamCity: 'New York', teamName: 'Yankees', primaryColor: '#003087',
  won: true, teamScore: 6, oppScore: 3, oppName: 'Red Sox', isHome: true, gameId: 0,
  probability: 78, projectedWins: 92, wins: 50, losses: 34,
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

  // Preview: render a recap (most recent completed game, else a sample), no send.
  if (params.get('preview') === '1') {
    let data = SAMPLE;
    try {
      const games = await completedGames();
      if (games.length) {
        const standings = await fetchMLBStandings();
        data = buildData(games[0], 'home', standings) ?? SAMPLE;
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
      data = buildData(games[0], 'home', standings) ?? SAMPLE;
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
      const data = buildData(game, side, standings);
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
