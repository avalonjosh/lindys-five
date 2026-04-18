/**
 * Shared NHL standings fetcher with post-regular-season fallback.
 *
 * THE PROBLEM THIS SOLVES:
 * NHL's `/standings/{date}` endpoint returns an empty array for dates past the end of the
 * regular season (playoffs, offseason, preseason). This isn't a clear error — it's a valid
 * 200 response with `{standings: []}`. Naive consumers that just parse the response get an
 * empty array and silently fail to show anything.
 *
 * THE FIX:
 * When the dated request returns zero rows, retry `/standings/now` which reliably returns
 * the most recent non-empty standings snapshot (during playoffs/offseason, that's the final
 * regular-season standings — which is exactly what downstream features like playoff seeding,
 * current-series odds, and cut-line logic want).
 *
 * USE THESE HELPERS instead of calling the endpoint directly so we don't rediscover this
 * the next time the regular season ends.
 */

// NHL direct base URL — use the server-side helper for server components / API routes
const NHL_API = 'https://api-web.nhle.com/v1';
// Client-side proxy — use the client helper from 'use client' components
const CLIENT_API_BASE = '/api/v1';

// Intentionally permissive. Different consumers read different subsets of NHL standings fields;
// a strict type here would require every caller to update on schema changes. Callers type-cast
// or narrow as needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NhlStandingRow = Record<string, any>;

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Server-side fetch (server components, route handlers).
 * Hits NHL's `api-web.nhle.com` directly. Returns an array of standings rows.
 *
 * @param date  YYYY-MM-DD in Eastern Time. Defaults to today.
 * @param revalidate  Next.js revalidate seconds. Defaults to 300 (5 min).
 */
export async function fetchNhlStandingsServer(
  date?: string,
  revalidate = 300
): Promise<NhlStandingRow[]> {
  const targetDate = date || todayET();
  try {
    const res = await fetch(`${NHL_API}/standings/${targetDate}`, { next: { revalidate } });
    if (!res.ok) return fallbackServer(revalidate);
    const data = await res.json();
    const standings: NhlStandingRow[] = Array.isArray(data?.standings) ? data.standings : [];
    if (standings.length === 0) return fallbackServer(revalidate);
    return standings;
  } catch {
    return fallbackServer(revalidate);
  }
}

async function fallbackServer(revalidate: number): Promise<NhlStandingRow[]> {
  try {
    const res = await fetch(`${NHL_API}/standings/now`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.standings) ? data.standings : [];
  } catch {
    return [];
  }
}

/**
 * Client-side fetch ('use client' components).
 * Hits our own proxy at `/api/v1/standings/...`. Returns an array of standings rows.
 *
 * @param date  YYYY-MM-DD. Defaults to today in Eastern Time.
 */
export async function fetchNhlStandingsClient(date?: string): Promise<NhlStandingRow[]> {
  const targetDate = date || todayET();
  try {
    const res = await fetch(`${CLIENT_API_BASE}/standings/${targetDate}`);
    if (!res.ok) return fallbackClient();
    const data = await res.json();
    const standings: NhlStandingRow[] = Array.isArray(data?.standings) ? data.standings : [];
    if (standings.length === 0) return fallbackClient();
    return standings;
  } catch {
    return fallbackClient();
  }
}

async function fallbackClient(): Promise<NhlStandingRow[]> {
  try {
    const res = await fetch(`${CLIENT_API_BASE}/standings/now`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.standings) ? data.standings : [];
  } catch {
    return [];
  }
}
