import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { MLB_TEAMS } from '@/lib/teamConfig';
import { fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { calculateMLBChunks, isMLBTargetMet } from '@/lib/utils/mlbChunkCalculator';
import { getMLBPlayoffProbability } from '@/lib/utils/mlbStandingsCalc';
import { generateTeamTicketsLink } from '@/lib/utils/affiliateLinks';
import {
  getVerifiedSubscribersForTeam,
  sendMLBSetRecap,
  renderMLBSetRecapEmail,
  type MLBSetRecapEmailData,
} from '@/lib/email';
import type { MLBGameChunk, MLBGameResult, MLBStandingsTeam } from '@/lib/types/mlb';
import type { MLBTeamConfig } from '@/lib/teamConfig';

// Off by default — real sends only once this flag is set true.
const ENABLED_KEY = 'blog:settings:mlb-set-recap-enabled';

async function teamSet(team: MLBTeamConfig, season: number): Promise<{ chunk: MLBGameChunk; schedule: MLBGameResult[] } | null> {
  const schedule = await fetchMLBSchedule(team.mlbId, season);
  const completed = calculateMLBChunks(schedule).filter((c) => c.isComplete);
  return completed.length ? { chunk: completed[completed.length - 1], schedule } : null;
}

function buildData(team: MLBTeamConfig, chunk: MLBGameChunk, standings: MLBStandingsTeam[], schedule: MLBGameResult[]): MLBSetRecapEmailData | null {
  const standing = standings.find((t) => t.teamId === team.mlbId);
  if (!standing) return null;
  const odds = getMLBPlayoffProbability(standing, standings);
  const games = chunk.games.map((g) => ({
    date: g.date,
    opponent: g.opponent,
    isHome: g.isHome,
    teamScore: g.teamScore,
    opponentScore: g.opponentScore,
    outcome: g.outcome,
  }));
  const runDiff = games.reduce((sum, g) => sum + (g.teamScore - g.opponentScore), 0);
  const up = schedule.find((g) => g.outcome === 'PENDING');
  const nextGame = up
    ? {
        opponent: `${up.isHome ? 'vs' : '@'} ${up.opponent}`,
        date: up.startTime ? `${up.date} · ${up.startTime} ET` : up.date,
        ticketLink: generateTeamTicketsLink(team.slug, team.city, team.stubhubId),
      }
    : null;

  return {
    teamSlug: team.slug,
    teamCity: team.city,
    teamName: team.name,
    teamAbbrev: team.abbreviation,
    primaryColor: team.colors.primary,
    setNumber: chunk.chunkNumber,
    dateRange: games.length ? `${games[0].date} – ${games[games.length - 1].date}` : '',
    wins: chunk.wins,
    losses: chunk.losses,
    totalGames: chunk.totalGames,
    runDiff,
    targetWins: Math.round(chunk.totalGames * 0.556),
    targetMet: isMLBTargetMet(chunk),
    games,
    probAfter: odds.probability,
    record: `${standing.wins}-${standing.losses}`,
    winPct: standing.winPct.toFixed(3).replace(/^0/, ''),
    projWins: odds.projectedWins,
    gamesBack: standing.gamesBack === 0 ? '—' : `${standing.gamesBack}`,
    nextGame,
  };
}

const SAMPLE: MLBSetRecapEmailData = {
  teamSlug: 'yankees', teamCity: 'New York', teamName: 'Yankees', teamAbbrev: 'NYY', primaryColor: '#003087',
  setNumber: 12, dateRange: 'Jun 2 – Jun 6', wins: 4, losses: 1, totalGames: 5, runDiff: 9, targetWins: 3, targetMet: true,
  games: [
    { date: 'Jun 2', opponent: 'BOS', isHome: true, teamScore: 6, opponentScore: 3, outcome: 'W' },
    { date: 'Jun 3', opponent: 'BOS', isHome: true, teamScore: 2, opponentScore: 5, outcome: 'L' },
    { date: 'Jun 4', opponent: 'TB', isHome: false, teamScore: 7, opponentScore: 1, outcome: 'W' },
    { date: 'Jun 5', opponent: 'TB', isHome: false, teamScore: 4, opponentScore: 2, outcome: 'W' },
    { date: 'Jun 6', opponent: 'TB', isHome: false, teamScore: 3, opponentScore: 2, outcome: 'W' },
  ],
  probAfter: 82, record: '38-22', winPct: '.633', projWins: 95, gamesBack: '—',
  nextGame: { opponent: '@ TB', date: 'Jun 9 · 7:05 PM ET', ticketLink: 'https://www.stubhub.com' },
};

/** First MLB team that currently has a completed set — used for preview/test. */
async function sampleData(season: number): Promise<MLBSetRecapEmailData> {
  try {
    const standings = await fetchMLBStandings();
    for (const team of Object.values(MLB_TEAMS)) {
      const set = await teamSet(team, season);
      if (set) {
        const data = buildData(team, set.chunk, standings, set.schedule);
        if (data) return data;
      }
    }
  } catch {
    /* offseason / no data */
  }
  return SAMPLE;
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const season = new Date().getFullYear();

  if (params.get('preview') === '1') {
    return new NextResponse(renderMLBSetRecapEmail(await sampleData(season), '#'), { headers: { 'Content-Type': 'text/html' } });
  }

  const testEmail = params.get('test');
  if (testEmail) {
    const { sent } = await sendMLBSetRecap([], await sampleData(season), { testEmail });
    return NextResponse.json({ test: true, to: testEmail, sent });
  }

  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) return NextResponse.json({ skipped: 'mlb-set-recap disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });

  const standings = await fetchMLBStandings();
  const results: { team: string; status: string; set?: number; subscribers?: number }[] = [];

  for (const team of Object.values(MLB_TEAMS)) {
    const subscribers = await getVerifiedSubscribersForTeam(team.slug);
    if (subscribers.length === 0) continue;
    try {
      const set = await teamSet(team, season);
      if (!set) {
        results.push({ team: team.slug, status: 'no-completed-set' });
        continue;
      }
      const sentKey = `email:mlb-set-recap-sent:${team.slug}:${set.chunk.chunkNumber}`;
      if (await kv.get(sentKey)) {
        results.push({ team: team.slug, status: 'already-sent', set: set.chunk.chunkNumber });
        continue;
      }
      const data = buildData(team, set.chunk, standings, set.schedule);
      if (!data) {
        results.push({ team: team.slug, status: 'no-standing' });
        continue;
      }
      const { sent } = await sendMLBSetRecap(subscribers, data);
      await kv.set(sentKey, true);
      results.push({ team: team.slug, status: 'sent', set: set.chunk.chunkNumber, subscribers: sent });
    } catch (err) {
      console.error(`Failed MLB set recap for ${team.slug}:`, err);
      results.push({ team: team.slug, status: 'error' });
    }
  }
  return NextResponse.json({ results });
}
