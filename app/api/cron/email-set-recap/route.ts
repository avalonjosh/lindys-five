import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { TEAMS } from '@/lib/teamConfig';
import { sendSetRecapForTeam, getVerifiedSubscribersForTeam } from '@/lib/email';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import type { GameResult } from '@/lib/types';

const NHL_API = 'https://api-web.nhle.com/v1';
const GAMES_PER_SET = 5;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: { team: string; status: string; set?: number; subscribers?: number }[] = [];

  try {
    // Check every team that has subscribers
    for (const [slug, teamConfig] of Object.entries(TEAMS)) {
      const subscribers = await getVerifiedSubscribersForTeam(slug);
      if (subscribers.length === 0) continue;

      try {
        // Fetch schedule and determine the latest completed set
        const latestCompletedSet = await getLatestCompletedSetNumber(teamConfig.abbreviation, teamConfig.nhlId);
        if (!latestCompletedSet) {
          results.push({ team: slug, status: 'no-completed-set' });
          continue;
        }

        // Check if we already sent for this set
        const sentKey = `email:set-recap-sent:${slug}:${latestCompletedSet}`;
        const alreadySent = await kv.get(sentKey);
        if (alreadySent) {
          results.push({ team: slug, status: 'already-sent', set: latestCompletedSet });
          continue;
        }

        await sendSetRecapForTeam(slug, subscribers);
        // Mark as sent (no expiry — a set number is unique per season)
        await kv.set(sentKey, true);
        results.push({ team: slug, status: 'sent', set: latestCompletedSet, subscribers: subscribers.length });
      } catch (error) {
        console.error(`Failed to send set recap for ${slug}:`, error);
        results.push({ team: slug, status: 'error' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Email set recap cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

async function getLatestCompletedSetNumber(teamAbbrev: string, teamId: number): Promise<number | null> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const season = month < 8 ? `${year - 1}${year}` : `${year}${year + 1}`;

  const data = await fetchJsonWithRetry(
    `${NHL_API}/club-schedule-season/${teamAbbrev}/${season}`
  );

  const games = (data.games || []) as Array<{
    id: number;
    gameDate: string;
    gameState: string;
    gameType: number;
    homeTeam: { id: number; score: number };
    awayTeam: { id: number; score: number };
    gameOutcome?: { lastPeriodType: string };
  }>;

  // Filter to regular season
  const regularSeason = games.filter((g) => g.gameType === 2);

  // Build game results and compute sets
  const gameResults: GameResult[] = regularSeason.map((game) => {
    const isHome = game.homeTeam.id === teamId;
    const myScore = isHome ? game.homeTeam.score : game.awayTeam.score;
    const oppScore = isHome ? game.awayTeam.score : game.homeTeam.score;
    const isFinished = game.gameState === 'FINAL' || game.gameState === 'OFF';

    let outcome: 'W' | 'OTL' | 'L' | 'PENDING' = 'PENDING';
    let points = 0;
    if (isFinished) {
      const won = myScore > oppScore;
      const isOT = game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO';
      if (won) { outcome = 'W'; points = 2; }
      else if (isOT) { outcome = 'OTL'; points = 1; }
      else { outcome = 'L'; points = 0; }
    }

    return {
      date: game.gameDate,
      opponent: '',
      opponentLogo: '',
      isHome,
      sabresScore: myScore || 0,
      opponentScore: oppScore || 0,
      outcome,
      points,
      gameState: game.gameState,
      gameId: game.id,
    };
  });

  // Find the latest completed set
  const totalSets = Math.ceil(82 / GAMES_PER_SET);
  let latestCompleted: number | null = null;

  for (let i = 0; i < totalSets; i++) {
    const start = i * GAMES_PER_SET;
    const end = Math.min(start + GAMES_PER_SET, 82);
    const setGames = gameResults.slice(start, end);
    const isComplete = setGames.length === (end - start) && setGames.every((g) => g.outcome !== 'PENDING');
    if (isComplete) {
      latestCompleted = i + 1;
    }
  }

  return latestCompleted;
}
