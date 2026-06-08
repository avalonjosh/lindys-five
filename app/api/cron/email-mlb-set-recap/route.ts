import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { MLB_TEAMS } from '@/lib/teamConfig';
import { fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { calculateMLBChunks, isMLBTargetMet } from '@/lib/utils/mlbChunkCalculator';
import { getMLBPlayoffProbability } from '@/lib/utils/mlbStandingsCalc';
import {
  getVerifiedSubscribersForTeam,
  sendMLBSetRecap,
  renderMLBSetRecapEmail,
  type MLBSetRecapEmailData,
} from '@/lib/email';
import type { MLBGameChunk, MLBStandingsTeam } from '@/lib/types/mlb';
import type { MLBTeamConfig } from '@/lib/teamConfig';

// Off by default — real sends only once this flag is set true.
const ENABLED_KEY = 'blog:settings:mlb-set-recap-enabled';

async function latestCompletedSet(team: MLBTeamConfig, season: number): Promise<MLBGameChunk | null> {
  const schedule = await fetchMLBSchedule(team.mlbId, season);
  const completed = calculateMLBChunks(schedule).filter((c) => c.isComplete);
  return completed.length ? completed[completed.length - 1] : null;
}

function buildData(team: MLBTeamConfig, chunk: MLBGameChunk, standings: MLBStandingsTeam[]): MLBSetRecapEmailData | null {
  const standing = standings.find((t) => t.teamId === team.mlbId);
  if (!standing) return null;
  const odds = getMLBPlayoffProbability(standing, standings);
  return {
    teamSlug: team.slug,
    teamCity: team.city,
    teamName: team.name,
    primaryColor: team.colors.primary,
    setNumber: chunk.chunkNumber,
    wins: chunk.wins,
    losses: chunk.losses,
    targetMet: isMLBTargetMet(chunk),
    games: chunk.games.map((g) => ({
      date: g.date,
      opponent: g.opponent,
      isHome: g.isHome,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      outcome: g.outcome,
    })),
    seasonWins: standing.wins,
    seasonLosses: standing.losses,
    probability: odds.probability,
    projectedWins: odds.projectedWins,
  };
}

const SAMPLE: MLBSetRecapEmailData = {
  teamSlug: 'yankees', teamCity: 'New York', teamName: 'Yankees', primaryColor: '#003087',
  setNumber: 12, wins: 4, losses: 1, targetMet: true,
  games: [
    { date: '2026-06-02', opponent: 'BOS', isHome: true, teamScore: 6, opponentScore: 3, outcome: 'W' },
    { date: '2026-06-03', opponent: 'BOS', isHome: true, teamScore: 2, opponentScore: 5, outcome: 'L' },
    { date: '2026-06-04', opponent: 'TBR', isHome: false, teamScore: 7, opponentScore: 1, outcome: 'W' },
    { date: '2026-06-05', opponent: 'TBR', isHome: false, teamScore: 4, opponentScore: 2, outcome: 'W' },
    { date: '2026-06-06', opponent: 'TBR', isHome: false, teamScore: 3, opponentScore: 2, outcome: 'W' },
  ],
  seasonWins: 38, seasonLosses: 22, probability: 82, projectedWins: 95,
};

/** First MLB team that currently has a completed set — used for preview/test. */
async function sampleData(season: number): Promise<MLBSetRecapEmailData> {
  try {
    const standings = await fetchMLBStandings();
    for (const team of Object.values(MLB_TEAMS)) {
      const chunk = await latestCompletedSet(team, season);
      if (chunk) {
        const data = buildData(team, chunk, standings);
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
      const chunk = await latestCompletedSet(team, season);
      if (!chunk) {
        results.push({ team: team.slug, status: 'no-completed-set' });
        continue;
      }
      const sentKey = `email:mlb-set-recap-sent:${team.slug}:${chunk.chunkNumber}`;
      if (await kv.get(sentKey)) {
        results.push({ team: team.slug, status: 'already-sent', set: chunk.chunkNumber });
        continue;
      }
      const data = buildData(team, chunk, standings);
      if (!data) {
        results.push({ team: team.slug, status: 'no-standing' });
        continue;
      }
      const { sent } = await sendMLBSetRecap(subscribers, data);
      await kv.set(sentKey, true);
      results.push({ team: team.slug, status: 'sent', set: chunk.chunkNumber, subscribers: sent });
    } catch (err) {
      console.error(`Failed MLB set recap for ${team.slug}:`, err);
      results.push({ team: team.slug, status: 'error' });
    }
  }
  return NextResponse.json({ results });
}
