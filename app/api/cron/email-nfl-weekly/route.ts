// Heavy route (batch email sends) — allow up to 5 minutes
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { NFL_TEAMS, type NFLTeamConfig } from '@/lib/teamConfig';
import { fetchNFLSchedule, nflSeasonYear } from '@/lib/services/nflApi';
import { generateStubHubLink } from '@/lib/utils/affiliateLinks';
import { computeNFLOdds } from '@/lib/services/nflLeague';
import { getVerifiedSubscribersForTeam, sendNFLWeekly, renderNFLWeeklyEmail, type NFLWeeklyEmailData } from '@/lib/email';
import type { NFLGameResult } from '@/lib/types/nfl';

// Off by default — real sends to subscribers only once this flag is set true.
const ENABLED_KEY = 'blog:settings:nfl-weekly-enabled';

// A game this recent counts as "this week's" game (Thursday through Monday
// night, sent Tuesday). Older than that means a bye, and the team is skipped.
const LAST_GAME_MAX_DAYS = 6;

const daysAgo = (isoDate: string) =>
  (Date.now() - new Date(`${isoDate}T12:00:00-05:00`).getTime()) / (24 * 60 * 60 * 1000);

/** "October 11 2026" from YYYY-MM-DD, for the StubHub search query. */
function searchDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).replace(',', '');
}

function gameLabel(g: NFLGameResult): string {
  return `${g.isHome ? 'vs' : '@'} ${g.opponentName}`;
}

function buildNFLWeeklyData(team: NFLTeamConfig, games: NFLGameResult[]): NFLWeeklyEmailData {
  const finals = games.filter((g) => g.gameState === 'STATUS_FINAL');
  const last = finals[finals.length - 1];
  const upcoming = games.filter((g) => g.outcome === 'PENDING' && !g.isLive);
  const next = upcoming[0];
  const nextHome = upcoming.find((g) => g.isHome);

  const wins = finals.filter((g) => g.teamScore > g.opponentScore).length;
  const ties = finals.filter((g) => g.teamScore === g.opponentScore).length;
  const losses = finals.length - wins - ties;

  const fullName = `${team.city} ${team.name}`;
  return {
    teamSlug: team.id,
    teamCity: team.city,
    teamName: team.name,
    teamAbbrev: team.abbreviation,
    pickSlug: team.pickSlug,
    primaryColor: team.colors.primary,
    week: last?.week ?? next?.week ?? 0,
    last: last
      ? { oppAbbrev: last.opponent, oppName: last.opponentName, isHome: last.isHome, teamScore: last.teamScore, oppScore: last.opponentScore }
      : null,
    record: ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`,
    gamesLeft: upcoming.length,
    next: next ? { label: gameLabel(next), date: `${next.date} · ${next.startTime} ET`, tv: next.tv?.length ? next.tv.join(', ') : undefined } : null,
    homeTickets: nextHome
      ? {
          label: gameLabel(nextHome),
          date: nextHome.date,
          link: generateStubHubLink({
            stubhubId: 0,
            trackingRef: `nfl-${team.id}_email-nfl`,
            destination: `https://www.stubhub.com/secure/search?q=${encodeURIComponent(`${nextHome.opponentName} at ${fullName} ${searchDate(nextHome.isoDate)}`)}`,
          }),
        }
      : null,
  };
}

async function dataFor(slug: string): Promise<{ data: NFLWeeklyEmailData; lastIso: string | null } | null> {
  const team = NFL_TEAMS[slug];
  if (!team) return null;
  const [{ games }, table] = await Promise.all([fetchNFLSchedule(team.abbreviation, nflSeasonYear()), computeNFLOdds(nflSeasonYear())]);
  const data = buildNFLWeeklyData(team, games);
  const row = table?.teams.find((t) => t.abbr === team.abbreviation);
  if (row) data.playoffOdds = Math.round(row.playoff);
  const finals = games.filter((g) => g.gameState === 'STATUS_FINAL');
  return { data, lastIso: finals[finals.length - 1]?.isoDate ?? null };
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const previewTeam = params.get('team') || 'bills';

  // Preview: render one team's email (?preview=1&team=packers), no send.
  if (params.get('preview') === '1') {
    const built = await dataFor(previewTeam);
    if (!built) return NextResponse.json({ error: `unknown NFL team ${previewTeam}` }, { status: 400 });
    return new NextResponse(renderNFLWeeklyEmail(built.data, '#'), { headers: { 'Content-Type': 'text/html' } });
  }

  // Test: one email to the given address (?test=email&team=packers).
  const testEmail = params.get('test');
  if (testEmail) {
    const built = await dataFor(previewTeam);
    if (!built) return NextResponse.json({ error: `unknown NFL team ${previewTeam}` }, { status: 400 });
    const { sent } = await sendNFLWeekly([], built.data, { testEmail });
    return NextResponse.json({ test: true, to: testEmail, team: previewTeam, sent });
  }

  // Real send — gated.
  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) return NextResponse.json({ skipped: 'nfl-weekly disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });

  const season = nflSeasonYear();
  const results: { team: string; status: string; sent?: number }[] = [];
  for (const slug of Object.keys(NFL_TEAMS)) {
    const subscribers = await getVerifiedSubscribersForTeam(slug, 'gameRecaps');
    if (subscribers.length === 0) continue;
    try {
      const built = await dataFor(slug);
      if (!built?.lastIso || daysAgo(built.lastIso) > LAST_GAME_MAX_DAYS) {
        results.push({ team: slug, status: 'no-game-this-week' });
        continue;
      }
      const claimKey = `email:nfl-weekly-sent:${slug}:${season}:${built.data.week}`;
      const claimed = await kv.set(claimKey, true, { nx: true });
      if (!claimed) {
        results.push({ team: slug, status: 'already-sent' });
        continue;
      }
      try {
        const { sent } = await sendNFLWeekly(subscribers, built.data);
        results.push({ team: slug, status: 'sent', sent });
      } catch (err) {
        await kv.del(claimKey);
        throw err;
      }
    } catch (err) {
      console.error(`NFL weekly email failed for ${slug}:`, err);
      results.push({ team: slug, status: 'error' });
    }
  }
  return NextResponse.json({ results });
}
