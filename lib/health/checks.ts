/**
 * Daily site health checks. Read-only: they load pages and ask services
 * whether they work, and never send, post or write anything (the runner
 * stores only its own results). Each returns ok / warn / fail / skip.
 */

import { kv } from '@vercel/kv';
import { google } from 'googleapis';
import { NHL_TEAMS } from '@/lib/teamConfig';
import { fetchStandingsServer } from '@/lib/services/nhlTeamPageData';
import { getPlayoffProbability } from '@/lib/utils/standingsCalc';
import { STUBHUB_EVENT_IDS } from '@/lib/affiliate/stubhubEvents';
import { generateFanaticsTeamLink, FANATICS_ENABLED } from '@/lib/utils/affiliateLinks';
import { fetchImpactSummary, fetchPartnerizeSummary, hasImpactCredentials, hasPartnerizeCredentials } from '@/lib/services/affiliateNetworks';
import { fetchOverview, hasGA4Credentials } from '@/lib/ga4';
import { resolveAnalyticsWindow } from '@/lib/analyticsRange';
import { getScheduleWindow } from '@/lib/perfectseason/server/datasets';
import { cronRunKey, type CronRun } from './cronRuns';

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';
export type CheckArea = 'Money' | 'Odds' | 'Pages' | 'Search' | 'Emails' | 'Jobs' | 'Accounts & games' | 'Services';

export interface CheckResult {
  id: string;
  area: CheckArea;
  label: string;
  status: CheckStatus;
  detail: string;
}

const SITE = 'https://www.lindysfive.com';
const UA = 'LindysFiveHealthCheck/1.0';
const CANADIAN_NHL = new Set(['TOR', 'MTL', 'OTT', 'WPG', 'CGY', 'EDM', 'VAN']);

const easternDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

async function get(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
}

/** Visible text of an HTML page (scripts and styles removed). */
const textOf = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

type Check = () => Promise<Omit<CheckResult, 'id' | 'area' | 'label'>>;
const ok = (detail: string) => ({ status: 'ok' as const, detail });
const warn = (detail: string) => ({ status: 'warn' as const, detail });
const fail = (detail: string) => ({ status: 'fail' as const, detail });
const skip = (detail: string) => ({ status: 'skip' as const, detail });

// ---------------------------------------------------------------------------
// Shared data (fetched once per run)
// ---------------------------------------------------------------------------

interface NhlGame { id: number; gameDate: string; gameState: string; homeTeam: { abbrev: string }; awayTeam: { abbrev: string } }

let standingsCache: Awaited<ReturnType<typeof fetchStandingsServer>> | null = null;
const standings = async () => (standingsCache ??= await fetchStandingsServer(easternDate()));

let weekCache: NhlGame[] | null = null;
/** NHL games from yesterday through the next 7 days. */
async function nhlWeek(): Promise<NhlGame[]> {
  if (weekCache) return weekCache;
  const res = await get(`https://api-web.nhle.com/v1/schedule/${easternDate(-1)}`);
  const data = await res.json();
  weekCache = (data.gameWeek || []).flatMap((d: { date: string; games: NhlGame[] }) => d.games.map((g) => ({ ...g, gameDate: d.date })));
  return weekCache!;
}

const nhlInSeason = async () => {
  const s = await standings();
  return s.length > 0 && s.some((t) => t.gamesPlayed > 0) && s.some((t) => t.gamesPlayed < 82);
};

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const stubhubAffiliate: Check = async () => {
  const camref = process.env.NEXT_PUBLIC_STUBHUB_CAMREF || '1110lpjky';
  const res = await get(`https://stubhub.prf.hn/click/camref:${camref}/pubref:healthcheck/destination:${encodeURIComponent('https://www.stubhub.com/')}`, { redirect: 'manual' });
  const works = res.status >= 300 && res.status < 400;
  if (process.env.NEXT_PUBLIC_STUBHUB_AFFILIATE !== 'on') {
    return works
      ? warn('Partnerize links work again, but ticket links still skip the affiliate wrapper (no commission). Set NEXT_PUBLIC_STUBHUB_AFFILIATE=on in Vercel and redeploy.')
      : warn(`Ticket links go straight to StubHub (no commission) because Partnerize rejects camref ${camref} (HTTP ${res.status}). Fix the campaign in Partnerize.`);
  }
  return works ? ok('Partnerize ticket link redirects to StubHub') : fail(`Partnerize answered HTTP ${res.status} for camref ${camref}: every ticket button lands on an error page`);
};

const stubhubCoverage: Check = async () => {
  const games = (await nhlWeek()).filter((g) => g.gameDate >= easternDate() && !CANADIAN_NHL.has(g.homeTeam.abbrev));
  if (games.length === 0) return skip('No US-hosted NHL games in the next 7 days');
  const missing = games.filter((g) => !STUBHUB_EVENT_IDS[`nhl:${g.homeTeam.abbrev}:${g.awayTeam.abbrev}:${g.gameDate}`]);
  if (missing.length === 0) return ok(`All ${games.length} US-hosted NHL games in the next 7 days have exact StubHub event links`);
  const list = missing.slice(0, 6).map((g) => `${g.awayTeam.abbrev}@${g.homeTeam.abbrev} ${g.gameDate}`).join(', ');
  return warn(`${missing.length} of ${games.length} upcoming games fall back to StubHub search (re-harvest): ${list}${missing.length > 6 ? ', …' : ''}`);
};

const mlbCoverage: Check = async () => {
  const from = easternDate(), to = easternDate(7);
  const res = await get(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${from}&endDate=${to}&hydrate=team`);
  const data = await res.json();
  const games = (data.dates || []).flatMap((d: { date: string; games: { gameType: string; teams: { home: { team: { abbreviation: string; name: string } }; away: { team: { abbreviation: string } } }; status: { detailedState: string } }[] }) =>
    d.games.filter((g) => ['R', 'F', 'D', 'L', 'W'].includes(g.gameType) && g.status.detailedState !== 'Postponed').map((g) => ({ date: d.date, home: g.teams.home.team.abbreviation, away: g.teams.away.team.abbreviation, matchupTbd: false })));
  // Undecided playoff matchups ("CLE/CWS") can't be harvested yet.
  const us = games.filter((g: { home: string; away: string }) => g.home !== 'TOR' && !g.home.includes('/') && !g.away.includes('/'));
  if (us.length === 0) return skip('No MLB games in the next 7 days');
  const alias: Record<string, string> = { AZ: 'ARI', ATH: 'OAK', CHW: 'CWS', KCR: 'KC', SDP: 'SD', SFG: 'SF', TBR: 'TB', WAS: 'WSH', WSN: 'WSH' };
  const a = (x: string) => alias[x] || x;
  const missing = us.filter((g: { home: string; away: string; date: string }) => !STUBHUB_EVENT_IDS[`mlb:${a(g.home)}:${a(g.away)}:${g.date}`]);
  if (missing.length === 0) return ok(`All ${us.length} MLB games in the next 7 days have exact StubHub event links`);
  return warn(`${missing.length} of ${us.length} MLB games in the next 7 days fall back to search (re-harvest): ${missing.slice(0, 5).map((g: { away: string; home: string; date: string }) => `${g.away}@${g.home} ${g.date}`).join(', ')}`);
};

const fanatics: Check = async () => {
  if (!FANATICS_ENABLED) return warn('NEXT_PUBLIC_FANATICS_DEEPLINK not set: gear buttons fall back to Amazon');
  const res = await get(generateFanaticsTeamLink('nhl', 'sabres', 'healthcheck'), { redirect: 'manual' });
  return res.status >= 300 && res.status < 400 ? ok('Fanatics link redirects') : fail(`Fanatics (Impact) link answered HTTP ${res.status}`);
};

const affiliateConfig: Check = async () => {
  const missing = [
    !process.env.NEXT_PUBLIC_AMAZON_TAG && 'NEXT_PUBLIC_AMAZON_TAG',
    !process.env.NEXT_PUBLIC_WATCH_PRIME_URL && 'NEXT_PUBLIC_WATCH_PRIME_URL',
    process.env.NEXT_PUBLIC_KOFI_URL && !process.env.KOFI_VERIFICATION_TOKEN && 'KOFI_VERIFICATION_TOKEN',
  ].filter(Boolean);
  return missing.length ? warn(`Not set: ${missing.join(', ')}`) : ok('Amazon tag, Prime Video link and Ko-fi webhook token are set');
};

// ---------------------------------------------------------------------------
// Odds
// ---------------------------------------------------------------------------

const nhlOdds: Check = async () => {
  const s = await standings();
  if (s.length !== 32) return fail(`NHL standings returned ${s.length} teams (expected 32)`);
  const probs = s.map((t) => ({ abbrev: t.teamAbbrev.default, p: getPlayoffProbability(t, s) }));
  const bad = probs.filter((x) => !Number.isFinite(x.p) || x.p < 0 || x.p > 100);
  if (bad.length) return fail(`Invalid playoff odds for ${bad.map((b) => `${b.abbrev}=${b.p}`).join(', ')}`);
  const sum = probs.reduce((a, x) => a + x.p, 0) / 100;
  if (sum < 10 || sum > 22) return warn(`League odds add up to ${sum.toFixed(1)} playoff teams (expected about 14 to 17)`);
  return ok(`All 32 teams have valid odds; they add up to ${sum.toFixed(1)} of 16 playoff spots`);
};

const oddsConsistency: Check = async () => {
  if (!(await nhlInSeason())) return skip('NHL regular season not in progress');
  const s = await standings();
  const buf = s.find((t) => t.teamAbbrev.default === 'BUF');
  if (!buf) return fail('Sabres missing from standings');
  const model = Math.round(getPlayoffProbability(buf, s));
  const card = await (await get(`${SITE}/api/home/team/sabres`)).json();
  const diff = Math.abs((card.odds ?? -100) - model);
  return diff <= 1 ? ok(`Home card and model agree on the Sabres (${model}%)`) : fail(`Sabres odds disagree: home card ${card.odds}%, model ${model}%`);
};

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const PAGES: { path: string; mustContain: string }[] = [
  { path: '/', mustContain: 'Will your team make the playoffs' },
  { path: '/nhl', mustContain: 'Buffalo Sabres' },
  { path: '/mlb', mustContain: 'New York Yankees' },
  { path: '/nhl/scores', mustContain: 'NHL Scores' },
  { path: '/82-0', mustContain: '82-0' },
  { path: '/162-0', mustContain: '162-0' },
  { path: '/account', mustContain: "Lindy's Five" },
  { path: '/blog', mustContain: 'Blog' },
];

const keyPages: Check = async () => {
  const problems: string[] = [];
  await Promise.all(PAGES.map(async ({ path, mustContain }) => {
    try {
      const res = await get(`${SITE}${path}`);
      if (res.status !== 200) return problems.push(`${path} HTTP ${res.status}`);
      const text = textOf(await res.text());
      if (!text.includes(mustContain)) problems.push(`${path} missing "${mustContain}"`);
      if (/\bNaN\b|undefined%/.test(text)) problems.push(`${path} shows NaN/undefined`);
    } catch (e) {
      problems.push(`${path} ${(e as Error).message}`);
    }
  }));
  return problems.length ? fail(problems.join('; ')) : ok(`${PAGES.length} key pages load with their expected content`);
};

const oddsPage: Check = async () => {
  const res = await get(`${SITE}/nhl-playoff-odds`);
  if (res.status !== 200) return fail(`/nhl-playoff-odds HTTP ${res.status}`);
  const html = await res.text();
  const rows = (html.match(/<tr[\s>]/g) || []).length;
  const text = textOf(html);
  if (/\bNaN\b/.test(text)) return fail('/nhl-playoff-odds shows NaN');
  return rows >= 33 ? ok('Odds page lists every team') : fail(`Odds page has only ${rows} table rows (expected 32 teams plus a header)`);
};

const teamPage: Check = async () => {
  const s = await standings();
  const buf = s.find((t) => t.teamAbbrev.default === 'BUF');
  const res = await get(`${SITE}/nhl/sabres`);
  if (res.status !== 200) return fail(`/nhl/sabres HTTP ${res.status}`);
  const text = textOf(await res.text());
  if (!(await nhlInSeason())) return text.includes('Buffalo Sabres') ? ok('/nhl/sabres loads (offseason)') : fail('/nhl/sabres missing team name');
  const m = text.match(/Games Played (\d+)/);
  if (!m) return fail('/nhl/sabres has no Games Played in its HTML (the season card is not server-rendered)');
  const gp = Number(m[1]);
  return buf && Math.abs(gp - buf.gamesPlayed) <= 1
    ? ok(`/nhl/sabres shows ${gp} games played (standings: ${buf.gamesPlayed})`)
    : fail(`/nhl/sabres shows ${gp} games played but the NHL says ${buf?.gamesPlayed}`);
};

const boxScore: Check = async () => {
  const final = (await nhlWeek()).find((g) => g.gameDate === easternDate(-1) && (g.gameState === 'OFF' || g.gameState === 'FINAL'));
  if (!final) return skip('No NHL game finished yesterday');
  const res = await get(`${SITE}/nhl/scores/${final.id}`);
  if (res.status !== 200) return fail(`Box score ${final.id} HTTP ${res.status}`);
  return textOf(await res.text()).includes('Box Score') ? ok(`Yesterday's box score (${final.awayTeam.abbrev}@${final.homeTeam.abbrev}) loads`) : fail(`Box score ${final.id} missing its summary`);
};

const shareImage: Check = async () => {
  const res = await get(`${SITE}/api/og?type=sport-hub&sport=nhl&title=Health%20check`);
  const type = res.headers.get('content-type') || '';
  return res.status === 200 && type.startsWith('image/') ? ok('Share images render') : fail(`Share image endpoint: HTTP ${res.status} ${type}`);
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const robotsAndSitemap: Check = async () => {
  const problems: string[] = [];
  const robots = await (await get(`${SITE}/robots.txt`)).text();
  if (/^Disallow:\s*\/\s*$/m.test(robots)) problems.push('robots.txt blocks the whole site');
  if (!/Sitemap:\s*https:\/\/www\.lindysfive\.com\/sitemap\.xml/.test(robots)) problems.push('robots.txt lost its Sitemap line');
  const sitemap = await get(`${SITE}/sitemap.xml`);
  const xml = await sitemap.text();
  for (const p of ['/nhl/sabres', '/nhl-playoff-odds', '/mlb/yankees', '/82-0']) if (!xml.includes(`${SITE}${p}<`)) problems.push(`sitemap missing ${p}`);
  return problems.length ? fail(problems.join('; ')) : ok('robots.txt allows crawling and the sitemap lists the key pages');
};

const indexable: Check = async () => {
  const flagged: string[] = [];
  await Promise.all(['/', '/nhl/sabres', '/nhl-playoff-odds', '/82-0', '/mlb/yankees'].map(async (p) => {
    const html = await (await get(`${SITE}${p}`)).text();
    if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) flagged.push(p);
  }));
  return flagged.length ? fail(`Marked noindex (hidden from Google): ${flagged.join(', ')}`) : ok('Key pages are indexable');
};

const canonicalHost: Check = async () => {
  const res = await get('https://lindysfive.com/', { redirect: 'manual' });
  const loc = res.headers.get('location') || '';
  return res.status >= 300 && res.status < 400 && loc.startsWith('https://www.lindysfive.com')
    ? ok('lindysfive.com redirects to www')
    : fail(`lindysfive.com answered HTTP ${res.status} ${loc}`);
};

const searchConsole: Check = async () => {
  if (!process.env.GSC_CLIENT_EMAIL || !process.env.GSC_PRIVATE_KEY) return warn('Search Console keys not set');
  const auth = new google.auth.JWT({ email: process.env.GSC_CLIENT_EMAIL, key: process.env.GSC_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  const sites = await google.searchconsole({ version: 'v1', auth }).sites.list();
  return (sites.data.siteEntry || []).length > 0 ? ok('Search Console API works') : warn('Search Console API returned no sites for the service account');
};

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

const emailService: Check = async () => {
  if (!process.env.RESEND_API_KEY) return fail('RESEND_API_KEY not set: no emails can be sent');
  const res = await get('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
  if (res.status === 401 || res.status === 403) {
    // A send-only key may not list domains; Resend says so by name, and that key still sends fine.
    const body = await res.json().catch(() => null);
    if (body?.name === 'restricted_api_key') return ok('Resend key is valid (send-only key, so domain status is not visible)');
    return fail(`Resend rejected the API key (HTTP ${res.status}${body?.message ? `: ${body.message}` : ''})`);
  }
  if (!res.ok) return warn(`Resend domains check: HTTP ${res.status}`);
  const domains = ((await res.json()).data || []) as { name: string; status: string }[];
  const d = domains.find((x) => x.name === 'lindysfive.com');
  if (!d) return fail('lindysfive.com is not a sending domain in Resend');
  return d.status === 'verified' ? ok('Resend key works and lindysfive.com is verified') : fail(`lindysfive.com sending domain status: ${d.status}`);
};

interface SendRecord { sentAt: string; team?: string; subject?: string; recipientCount?: number; delivered?: number; bounced?: number; complained?: number }

async function recentSends(days: number): Promise<SendRecord[]> {
  const ids = (await kv.zrange<string[]>('email:sends', Date.now() - days * 86_400_000, Date.now(), { byScore: true })) ?? [];
  if (!ids.length) return [];
  return ((await kv.mget<(SendRecord | null)[]>(...ids.map((id) => `email:send:${id}`))) || []).filter((r): r is SendRecord => !!r);
}

const sabresRecap: Check = async () => {
  const played = (await nhlWeek()).find((g) => g.gameDate === easternDate(-1) && (g.homeTeam.abbrev === 'BUF' || g.awayTeam.abbrev === 'BUF') && (g.gameState === 'OFF' || g.gameState === 'FINAL'));
  if (!played) return skip('The Sabres did not play yesterday');
  const sends = await recentSends(1.5);
  const recap = sends.find((s) => s.team === 'sabres' && !/welcome/i.test(s.subject || ''));
  const posted = await kv.sismember('blog:gamerecap:processed', String(played.id));
  if (!recap) return fail(`The Sabres played yesterday but no recap email went out${posted ? '' : ', and no recap post was written'}`);
  return posted ? ok(`Recap post and email ("${recap.subject}") went out`) : warn(`Recap email went out ("${recap.subject}") but no recap post was recorded`);
};

const deliverability: Check = async () => {
  const sends = await recentSends(7);
  const delivered = sends.reduce((a, s) => a + (s.delivered || 0), 0);
  const bounced = sends.reduce((a, s) => a + (s.bounced || 0), 0);
  const complained = sends.reduce((a, s) => a + (s.complained || 0), 0);
  const total = delivered + bounced;
  if (total < 10) return skip(`Too few emails this week to judge (${total})`);
  const bounceRate = bounced / total, complaintRate = complained / Math.max(delivered, 1);
  if (bounceRate > 0.05 || complaintRate > 0.003) return warn(`Last 7 days: ${(bounceRate * 100).toFixed(1)}% bounced, ${(complaintRate * 100).toFixed(2)}% spam complaints (${total} emails)`);
  return ok(`Last 7 days: ${total} emails, ${(bounceRate * 100).toFixed(1)}% bounced, ${complained} complaints`);
};

// ---------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------

/** Longest gap allowed between runs, in hours (schedule plus slack). */
const JOB_MAX_AGE_H: Record<string, number> = {
  'game-recap': 26, 'playoff-game-recap': 26, 'series-recap': 26, 'analytics-cleanup': 26,
  'email-game-recap': 26, 'email-set-recap': 26, 'email-mlb-game-recap': 26, 'email-mlb-set-recap': 26, 'email-clinch': 26,
  'set-recap': 170, 'weekly-roundup': 170, 'bills-weekly-roundup': 170, 'bills-game-recap': 170,
  'weekly-digest': 170, 'email-nfl-weekly': 170, 'affiliate-summary': 170,
  'news-scan': 98, 'bills-news-scan': 98,
};

const scheduledJobs: Check = async () => {
  const names = Object.keys(JOB_MAX_AGE_H);
  const runs = await kv.mget<(CronRun | null)[]>(...names.map(cronRunKey));
  const failed: string[] = [], partial: string[] = [], late: string[] = [], unseen: string[] = [];
  names.forEach((name, i) => {
    const r = runs[i];
    if (!r) return void unseen.push(name);
    const ageH = (Date.now() - Date.parse(r.at)) / 3_600_000;
    if (r.status === 'failed') failed.push(`${name} (${r.note || 'error'})`);
    else if (r.status === 'partial') partial.push(`${name} (${r.note})`);
    if (ageH > JOB_MAX_AGE_H[name]) late.push(`${name} (last ran ${Math.round(ageH)}h ago)`);
  });
  if (failed.length) return fail(`Failed: ${failed.join('; ')}${late.length ? `. Late: ${late.join(', ')}` : ''}`);
  if (late.length) return fail(`Not running on schedule: ${late.join(', ')}`);
  if (partial.length) return warn(`Partly failed: ${partial.join('; ')}`);
  const seen = names.length - unseen.length;
  if (seen === 0) return skip('Run tracking just started; no job runs recorded yet');
  return unseen.length
    ? ok(`${seen} jobs ran fine; ${unseen.length} haven't run since tracking started (${unseen.join(', ')})`)
    : ok(`All ${names.length} scheduled jobs ran on time`);
};

const xPosting: Check = async () => {
  const ids = (await kv.zrange<string[]>('blog:posts', Date.now() - 7 * 86_400_000, Date.now(), { byScore: true })) ?? [];
  if (!ids.length) return skip('No posts published this week');
  const posts = ((await kv.mget<({ title: string; status?: string; xPost?: { tweetId?: string; error?: string } } | null)[]>(...ids.map((id) => `blog:post:${id}`))) || []).filter(Boolean);
  const failedPosts = posts.filter((p) => p!.xPost?.error && !p!.xPost?.tweetId);
  return failedPosts.length
    ? warn(`${failedPosts.length} of ${posts.length} posts this week failed to post to X (often out of X credits): ${failedPosts[0]!.xPost!.error!.slice(0, 120)}`)
    : ok(`${posts.length} posts this week, none failed to reach X`);
};

// ---------------------------------------------------------------------------
// Accounts & games
// ---------------------------------------------------------------------------

const accounts: Check = async () => {
  // Signed out, the account API answers 401 with JSON; anything else means it's broken.
  const me = await get(`${SITE}/api/account/me`);
  if (me.status !== 200 && me.status !== 401) return fail(`/api/account/me HTTP ${me.status}`);
  if (!(me.headers.get('content-type') || '').includes('application/json')) return fail('/api/account/me did not answer with JSON');
  if (process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === '1') {
    const g = await get(`${SITE}/api/auth/google`, { redirect: 'manual' });
    if (!(g.headers.get('location') || '').startsWith('https://accounts.google.com')) return fail(`Sign in with Google doesn't reach Google (HTTP ${g.status})`);
  }
  return ok(`Account API responds${process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === '1' ? ' and Sign in with Google hands off to Google' : ''}`);
};

const dailyPuzzles: Check = async () => {
  const problems: string[] = [];
  for (const sport of ['nhl', 'mlb'] as const) {
    const days = Object.keys(getScheduleWindow(sport).days);
    for (const d of [easternDate(), easternDate(1)]) if (!days.includes(d)) problems.push(`${sport === 'nhl' ? '82-0' : '162-0'} has no puzzle for ${d}`);
    const res = await get(`${SITE}/api/perfectseason/data/${sport}`);
    if (res.status !== 200) problems.push(`${sport} player data HTTP ${res.status}`);
  }
  return problems.length ? fail(problems.join('; ')) : ok("Today's and tomorrow's 82-0 and 162-0 puzzles and their player data are there");
};

// ---------------------------------------------------------------------------
// Services & settings
// ---------------------------------------------------------------------------

const dataFeeds: Check = async () => {
  const [nhl, mlb] = await Promise.all([
    get('https://api-web.nhle.com/v1/standings/now', { redirect: 'follow' }),
    get('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104'),
  ]);
  const bad = [nhl.ok ? null : `NHL HTTP ${nhl.status}`, mlb.ok ? null : `MLB HTTP ${mlb.status}`].filter(Boolean);
  return bad.length ? fail(`Data feed down: ${bad.join(', ')}`) : ok('NHL and MLB data feeds respond');
};

const analyticsKeys: Check = async () => {
  if (!hasGA4Credentials()) return fail('Google Analytics keys missing: every admin traffic panel shows zeros');
  const w = resolveAnalyticsWindow(new URLSearchParams('range=7d'));
  if ('error' in w) return fail(w.error);
  const o = await fetchOverview(w);
  return o.totalViews > 0 ? ok(`Google Analytics works (${o.totalViews.toLocaleString()} views in 7 days)`) : warn('Google Analytics returned 0 views for 7 days');
};

const affiliateReporting: Check = async () => {
  const from = new Date(Date.now() - 2 * 86_400_000), to = new Date();
  const problems: string[] = [];
  if (hasImpactCredentials()) { const s = await fetchImpactSummary(from, to); if (s.error) problems.push(`Impact: ${s.error}`); } else problems.push('Impact keys not set');
  if (hasPartnerizeCredentials()) { const s = await fetchPartnerizeSummary(from, to); if (s.error) problems.push(`Partnerize: ${s.error}`); } else problems.push('Partnerize keys not set');
  return problems.length ? warn(`Earnings reporting: ${problems.join('; ')}`) : ok('Impact and Partnerize reporting work');
};

const REQUIRED_ENV = [
  'RESEND_API_KEY', 'CRON_SECRET', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'USER_SESSION_SECRET',
  'ANTHROPIC_API_KEY', 'GA4_PROPERTY_ID', 'GSC_CLIENT_EMAIL', 'GSC_PRIVATE_KEY', 'BLOB_READ_WRITE_TOKEN',
  'KV_REST_API_URL', 'KV_REST_API_TOKEN',
];

const settings: Check = async () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === '1') for (const k of ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET']) if (!process.env[k]) missing.push(k);
  return missing.length ? fail(`Missing settings in Vercel: ${missing.join(', ')}`) : ok(`All ${REQUIRED_ENV.length} critical settings are present`);
};

const database: Check = async () => {
  const keys = await kv.dbsize();
  return ok(`Database responds (${keys.toLocaleString()} keys)`);
};

// ---------------------------------------------------------------------------

export const CHECKS: { id: string; area: CheckArea; label: string; run: Check }[] = [
  { id: 'stubhub-affiliate', area: 'Money', label: 'StubHub ticket links (Partnerize)', run: stubhubAffiliate },
  { id: 'stubhub-coverage', area: 'Money', label: 'Exact-game ticket links, NHL next 7 days', run: stubhubCoverage },
  { id: 'stubhub-mlb', area: 'Money', label: 'Exact-game ticket links, MLB next 7 days', run: mlbCoverage },
  { id: 'fanatics', area: 'Money', label: 'Fanatics gear links', run: fanatics },
  { id: 'affiliate-config', area: 'Money', label: 'Amazon, Prime Video and Ko-fi settings', run: affiliateConfig },
  { id: 'nhl-odds', area: 'Odds', label: 'NHL playoff odds model', run: nhlOdds },
  { id: 'odds-consistency', area: 'Odds', label: 'Odds match across pages', run: oddsConsistency },
  { id: 'key-pages', area: 'Pages', label: 'Key pages load', run: keyPages },
  { id: 'odds-page', area: 'Pages', label: 'Odds page shows every team', run: oddsPage },
  { id: 'team-page', area: 'Pages', label: 'Team page numbers are current', run: teamPage },
  { id: 'box-score', area: 'Pages', label: "Yesterday's box score", run: boxScore },
  { id: 'share-image', area: 'Pages', label: 'Share images', run: shareImage },
  { id: 'robots-sitemap', area: 'Search', label: 'robots.txt and sitemap', run: robotsAndSitemap },
  { id: 'indexable', area: 'Search', label: 'Key pages indexable', run: indexable },
  { id: 'canonical-host', area: 'Search', label: 'lindysfive.com redirects to www', run: canonicalHost },
  { id: 'search-console', area: 'Search', label: 'Search Console API', run: searchConsole },
  { id: 'email-service', area: 'Emails', label: 'Email service (Resend)', run: emailService },
  { id: 'sabres-recap', area: 'Emails', label: 'Recap after the last Sabres game', run: sabresRecap },
  { id: 'deliverability', area: 'Emails', label: 'Bounces and spam complaints', run: deliverability },
  { id: 'jobs', area: 'Jobs', label: 'Scheduled jobs', run: scheduledJobs },
  { id: 'x-posting', area: 'Jobs', label: 'Posting to X', run: xPosting },
  { id: 'accounts', area: 'Accounts & games', label: 'Accounts and Google sign-in', run: accounts },
  { id: 'daily-puzzles', area: 'Accounts & games', label: '82-0 and 162-0 puzzles', run: dailyPuzzles },
  { id: 'data-feeds', area: 'Services', label: 'NHL and MLB data feeds', run: dataFeeds },
  { id: 'analytics-keys', area: 'Services', label: 'Google Analytics', run: analyticsKeys },
  { id: 'affiliate-reporting', area: 'Services', label: 'Earnings reporting (Impact, Partnerize)', run: affiliateReporting },
  { id: 'settings', area: 'Services', label: 'Critical settings present', run: settings },
  { id: 'database', area: 'Services', label: 'Database', run: database },
];

/** Run every check (each capped at 30s); a check that throws counts as failed. */
export async function runHealthChecks(): Promise<CheckResult[]> {
  standingsCache = null;
  weekCache = null;
  return Promise.all(CHECKS.map(async ({ id, area, label, run }) => {
    try {
      const r = await Promise.race([run(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timed out after 30s')), 30_000))]);
      return { id, area, label, ...r };
    } catch (e) {
      return { id, area, label, status: 'fail' as const, detail: `Check errored: ${(e as Error).message}` };
    }
  }));
}
