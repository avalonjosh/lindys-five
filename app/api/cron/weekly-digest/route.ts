import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getAllSubscribers, sendWeeklyDigest, renderWeeklyDigestEmail, type WeeklyDigestContent, type DigestRace } from '@/lib/email';
import { getPublishedPosts } from '@/lib/kv';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import { fetchNhlStandingsServer } from '@/lib/services/standingsFetch';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';
// Off by default — the weekly blast only goes out once this KV flag is set true.
const ENABLED_KEY = 'blog:settings:weekly-digest-enabled';

const digestUtm = (path: string, content: string) =>
  `${SITE_URL}${path}?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest&utm_content=${content}`;

// Tightest MLB division race — only meaningful during the season (Apr–Sep)
async function buildMLBRace(): Promise<DigestRace | null> {
  const month = new Date().getMonth();
  if (month < 3 || month > 8) return null;
  const standings = await fetchMLBStandings();
  if (!standings.length) return null;

  const divisions = new Map<string, typeof standings>();
  for (const t of standings) {
    if (!divisions.has(t.division)) divisions.set(t.division, []);
    divisions.get(t.division)!.push(t);
  }

  let best: { division: string; gap: number; teams: typeof standings } | null = null;
  for (const [division, teams] of divisions) {
    const sorted = [...teams].sort((a, b) => a.divisionRank - b.divisionRank);
    const gap = sorted[1]?.gamesBack ?? Infinity;
    if (!best || gap < best.gap) best = { division, gap, teams: sorted };
  }
  if (!best) return null;

  const shortName = best.division.replace('American League', 'AL').replace('National League', 'NL');
  return {
    sport: 'mlb',
    title: `${shortName} Race`,
    note: `The tightest division race in baseball — ${best.gap === 0 ? 'tied at the top' : `separated by ${best.gap} game${best.gap === 1 ? '' : 's'}`}.`,
    rows: best.teams.slice(0, 3).map((t) => ({
      abbrev: t.teamAbbrev,
      name: t.teamName,
      record: `${t.wins}-${t.losses}`,
      trail: t.gamesBack === 0 ? '—' : `${t.gamesBack} GB`,
    })),
    linkLabel: 'Full MLB playoff odds',
    linkUrl: digestUtm('/mlb/playoff-odds', 'mlb-race'),
  };
}

// Tightest NHL division race — mid-season months only (Nov–Mar)
async function buildNHLRace(): Promise<DigestRace | null> {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 9) return null;
  const standings = await fetchNhlStandingsServer();
  if (!standings.length) return null;

  const divisions = new Map<string, typeof standings>();
  for (const t of standings) {
    const div = t.divisionName || '';
    if (!div) continue;
    if (!divisions.has(div)) divisions.set(div, []);
    divisions.get(div)!.push(t);
  }

  let best: { division: string; gap: number; teams: typeof standings } | null = null;
  for (const [division, teams] of divisions) {
    const sorted = [...teams].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    if (sorted.length < 2) continue;
    const gap = (sorted[0].points ?? 0) - (sorted[1].points ?? 0);
    if (!best || gap < best.gap) best = { division, gap, teams: sorted };
  }
  if (!best) return null;

  return {
    sport: 'nhl',
    title: `${best.division} Division Race`,
    note: best.gap === 0 ? 'Tied at the top of the division.' : `Separated by ${best.gap} point${best.gap === 1 ? '' : 's'} at the top.`,
    rows: best.teams.slice(0, 3).map((t) => ({
      abbrev: t.teamAbbrev?.default ?? '',
      name: t.teamCommonName?.default ?? t.teamName?.default ?? '',
      record: `${t.wins}-${t.losses}-${t.otLosses}`,
      trail: `${t.points} pts`,
    })),
    linkLabel: 'Full NHL playoff odds',
    linkUrl: digestUtm('/nhl-playoff-odds', 'nhl-race'),
  };
}

async function buildContent(): Promise<WeeklyDigestContent> {
  const [posts, mlbRace, nhlRace] = await Promise.all([
    getPublishedPosts().catch(() => []),
    buildMLBRace().catch(() => null),
    buildNHLRace().catch(() => null),
  ]);

  const latestPosts = posts.slice(0, 3).map((p) => ({
    title: p.title,
    url: `${SITE_URL}/blog/${p.team}/${p.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest&utm_content=blog`,
    image: p.ogImage,
    date: p.publishedAt
      ? new Date(p.publishedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
      : undefined,
  }));

  const races = [nhlRace, mlbRace].filter((r): r is DigestRace => r !== null);
  return { latestPosts, races };
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const content = await buildContent();

  // Preview: return the rendered HTML, no send. (?preview=1)
  if (params.get('preview') === '1') {
    return new NextResponse(renderWeeklyDigestEmail(content, '#'), { headers: { 'Content-Type': 'text/html' } });
  }

  // Test: send a single email to the given address only. (?test=you@email.com)
  const testEmail = params.get('test');
  if (testEmail) {
    const { sent } = await sendWeeklyDigest([], content, { testEmail });
    return NextResponse.json({ test: true, to: testEmail, sent });
  }

  // Real broadcast — only when explicitly enabled.
  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) {
    return NextResponse.json({ skipped: 'weekly-digest disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });
  }
  const subscribers = await getAllSubscribers();
  const { sent } = await sendWeeklyDigest(subscribers, content);
  return NextResponse.json({ sent });
}
