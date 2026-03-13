import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { TEAMS } from '@/lib/teamConfig';
import { sendBoxscoreRecapForTeam, getVerifiedSubscribersForTeam } from '@/lib/email';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

const NHL_API = 'https://api-web.nhle.com/v1';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: { team: string; status: string; subscribers?: number }[] = [];

  try {
    // Find all games that finished in the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toISOString().split('T')[0];

    const schedule = await fetchJsonWithRetry(`${NHL_API}/schedule/${dateStr}`);

    // Collect all team abbreviations that had a completed game
    const teamsWithGames = new Set<string>();
    for (const gameWeek of schedule.gameWeek || []) {
      for (const game of gameWeek.games || []) {
        if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
          teamsWithGames.add(game.homeTeam.abbrev);
          teamsWithGames.add(game.awayTeam.abbrev);
        }
      }
    }

    // Also check today's date for early morning games that finished
    const todayStr = now.toISOString().split('T')[0];
    if (todayStr !== dateStr) {
      const todaySchedule = await fetchJsonWithRetry(`${NHL_API}/schedule/${todayStr}`);
      for (const gameWeek of todaySchedule.gameWeek || []) {
        for (const game of gameWeek.games || []) {
          if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
            teamsWithGames.add(game.homeTeam.abbrev);
            teamsWithGames.add(game.awayTeam.abbrev);
          }
        }
      }
    }

    // For each team with a completed game, check if they have subscribers and if we haven't already sent
    for (const abbrev of teamsWithGames) {
      const teamConfig = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
      if (!teamConfig) continue;

      const teamSlug = teamConfig.slug;

      // Skip if we already sent a game recap email for this team today
      const sentKey = `email:game-recap-sent:${teamSlug}:${todayStr}`;
      const alreadySent = await kv.get(sentKey);
      if (alreadySent) {
        results.push({ team: teamSlug, status: 'already-sent' });
        continue;
      }

      // Check if this team has subscribers
      const subscribers = await getVerifiedSubscribersForTeam(teamSlug);
      if (subscribers.length === 0) {
        results.push({ team: teamSlug, status: 'no-subscribers' });
        continue;
      }

      try {
        await sendBoxscoreRecapForTeam(teamSlug, subscribers);
        // Mark as sent (expires after 48 hours)
        await kv.set(sentKey, true, { ex: 48 * 60 * 60 });
        results.push({ team: teamSlug, status: 'sent', subscribers: subscribers.length });
      } catch (error) {
        console.error(`Failed to send game recap for ${teamSlug}:`, error);
        results.push({ team: teamSlug, status: 'error' });
      }
    }

    return NextResponse.json({
      success: true,
      teamsWithGames: teamsWithGames.size,
      results,
    });
  } catch (error) {
    console.error('Email game recap cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
