// Heavy route (AI generation and/or batch email sends) — allow up to 5 minutes
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getAllSubscribers, sendWeeklyDigest, renderWeeklyDigestEmail, type WeeklyDigestContent, type DigestRace } from '@/lib/email';
import { getPublishedPosts } from '@/lib/kv';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import { fetchNhlStandingsServer } from '@/lib/services/standingsFetch';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';
import type { BlogPost, NewsletterSubscriber } from '@/lib/types';

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

/** Everything the digest could say this week; each recipient gets the slice for their teams. */
interface DigestPool {
  races: DigestRace[];
  /** Latest posts per team slug (only teams that have a blog). */
  postsByTeam: Map<string, BlogPost[]>;
}

type Sport = 'nhl' | 'mlb' | 'nfl';
function sportOf(slug: string): Sport | null {
  if (NHL_TEAMS[slug]) return 'nhl';
  if (MLB_TEAMS[slug]) return 'mlb';
  return slug ? 'nfl' : null; // NFL slugs (bills, titans...) have no odds/gear pages but do have a blog
}

async function buildPool(teamSlugs: Iterable<string>): Promise<DigestPool> {
  const [mlbRace, nhlRace] = await Promise.all([buildMLBRace().catch(() => null), buildNHLRace().catch(() => null)]);
  const races = [nhlRace, mlbRace].filter((r): r is DigestRace => r !== null);

  const postsByTeam = new Map<string, BlogPost[]>();
  await Promise.all(
    [...new Set(teamSlugs)].map(async (team) => {
      const posts = await getPublishedPosts(team).catch(() => [] as BlogPost[]);
      if (posts.length) postsByTeam.set(team, posts.slice(0, 3));
    })
  );
  return { races, postsByTeam };
}

/**
 * One subscriber's digest: races for the sport(s) they follow, blog posts only
 * for their own teams, and gear/tickets links for their first NHL/MLB team.
 * No teams at all = generic (every race, no blog). Returns null when there is
 * nothing relevant this week, so that recipient is skipped rather than spammed.
 */
function personalize(pool: DigestPool, teams: string[]): WeeklyDigestContent | null {
  const sports = new Set(teams.map(sportOf).filter((s): s is Sport => s !== null));
  const races = teams.length === 0 ? pool.races : pool.races.filter((r) => sports.has(r.sport));

  const latestPosts = teams
    .flatMap((t) => pool.postsByTeam.get(t) ?? [])
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 3)
    .map((p) => ({
      title: p.title,
      url: `${SITE_URL}/blog/${p.team}/${p.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest&utm_content=blog`,
      image: p.ogImage,
      date: p.publishedAt
        ? new Date(p.publishedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
        : undefined,
    }));

  if (races.length === 0 && latestPosts.length === 0) return null;

  const linkSlug = teams.find((t) => NHL_TEAMS[t] || MLB_TEAMS[t]);
  const cfg = linkSlug ? NHL_TEAMS[linkSlug] || MLB_TEAMS[linkSlug] : undefined;
  const team = linkSlug && cfg
    ? { sport: NHL_TEAMS[linkSlug] ? ('nhl' as const) : ('mlb' as const), slug: linkSlug, city: cfg.city, name: cfg.name }
    : undefined;

  return { latestPosts, races, team };
}

const parseTeams = (raw: string | null): string[] =>
  (raw ?? '').split(',').map((t) => t.trim()).filter(Boolean);

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  // Optional ?teams=sabres,yankees to preview/test a specific subscriber profile.
  const paramTeams = parseTeams(params.get('teams'));

  // Preview: return the rendered HTML, no send. (?preview=1[&teams=...])
  if (params.get('preview') === '1') {
    const pool = await buildPool(paramTeams);
    const content = personalize(pool, paramTeams);
    if (!content) return new NextResponse('Nothing relevant this week for those teams (this subscriber would be skipped).', { status: 200 });
    return new NextResponse(renderWeeklyDigestEmail(content, '#'), { headers: { 'Content-Type': 'text/html' } });
  }

  // Test: send a single email to the given address only. (?test=you@email.com[&teams=...])
  // Without ?teams, uses that address's real subscription if it has one.
  const testEmail = params.get('test');
  if (testEmail) {
    const existing = paramTeams.length ? null : (await getAllSubscribers()).find((s) => s.email === testEmail.toLowerCase());
    const testTeams = paramTeams.length ? paramTeams : existing?.teams ?? [];
    const pool = await buildPool(testTeams);
    const result = await sendWeeklyDigest([], (sub) => personalize(pool, sub.teams ?? []), { testEmail, testTeams });
    return NextResponse.json({ test: true, to: testEmail, teams: testTeams, ...result });
  }

  // Real broadcast — only when explicitly enabled.
  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) {
    return NextResponse.json({ skipped: 'weekly-digest disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });
  }
  const subscribers = await getAllSubscribers();
  const active = subscribers.filter((s) => s.verified && !s.unsubscribedAt);
  const pool = await buildPool(active.flatMap((s: NewsletterSubscriber) => s.teams ?? []));
  const result = await sendWeeklyDigest(active, (sub) => personalize(pool, sub.teams ?? []));
  return NextResponse.json(result);
}
