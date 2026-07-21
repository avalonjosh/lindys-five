import type { NFLGameResult, NFLScheduleData } from '../types/nfl';

// ESPN's public site API. CORS-open, so the client fetches it directly
// (verified: access-control-allow-origin: *). Same host the Bills crons use.
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// Simple in-memory cache (mirrors mlbApi.ts)
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60_000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw new Error(`ESPN API error: ${res.status}`);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('ESPN API: max retries exceeded');
}

const FINAL_STATUSES = new Set(['STATUS_FINAL']);
const LIVE_STATUSES = new Set(['STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_END_PERIOD']);

/**
 * A team's regular-season schedule (17 games + bye week number), normalized for
 * the Pick the {Team} pages and account-page grading. `teamAbbrev` is the ESPN
 * abbreviation (e.g. "BUF"); `season` is the calendar start year (e.g. 2026).
 */
export async function fetchNFLSchedule(teamAbbrev: string, season: number): Promise<NFLScheduleData> {
  const cacheKey = `nfl-schedule-${teamAbbrev}-${season}`;
  const cached = getCached<NFLScheduleData>(cacheKey);
  if (cached) return cached;

  const url = `${ESPN_API_BASE}/teams/${teamAbbrev.toLowerCase()}/schedule?season=${season}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const games: NFLGameResult[] = [];

  for (const event of data.events || []) {
    // Regular season only
    if (event.seasonType?.type !== 2) continue;
    const comp = event.competitions?.[0];
    if (!comp) continue;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const competitors: any[] = comp.competitors || [];
    const mine = competitors.find((c: any) => c.team?.abbreviation === teamAbbrev);
    const opp = competitors.find((c: any) => c.team?.abbreviation !== teamAbbrev);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!mine || !opp) continue;

    const statusName: string = comp.status?.type?.name || 'STATUS_SCHEDULED';
    const isFinal = FINAL_STATUSES.has(statusName);
    const teamScore = Number(mine.score?.value ?? 0);
    const opponentScore = Number(opp.score?.value ?? 0);

    let outcome: NFLGameResult['outcome'] = 'PENDING';
    if (isFinal) {
      // `winner` handles ties correctly (both false on a tie -> count as L for picks)
      outcome = mine.winner === true ? 'W' : 'L';
    }

    const gameDate = new Date(event.date);
    games.push({
      gameId: Number(event.id),
      week: event.week?.number ?? 0,
      date: gameDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }),
      isoDate: gameDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      startTime: gameDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
      opponent: opp.team?.abbreviation || '???',
      opponentName: opp.team?.displayName || opp.team?.abbreviation || '',
      opponentLogo: opp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nfl/500/${(opp.team?.abbreviation || '').toLowerCase()}.png`,
      isHome: mine.homeAway === 'home',
      teamScore,
      opponentScore,
      outcome,
      isLive: LIVE_STATUSES.has(statusName),
      gameState: statusName,
    });
  }

  games.sort((a, b) => a.week - b.week);

  const result: NFLScheduleData = {
    games,
    // Caution: ESPN's byeWeek can disagree with the game list (2026 Bills:
    // byeWeek said 5, the gameless week was 7). Derive byes from `games`
    // for anything user-facing; this is informational only.
    byeWeek: typeof data.byeWeek === 'number' ? data.byeWeek : null,
  };
  setCache(cacheKey, result);
  return result;
}
