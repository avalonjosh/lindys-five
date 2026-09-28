import { LIVE_TV, type NHLWatchInfo, type WatchServiceId } from './nhlWatch';

/**
 * "Where to watch" for NFL games from ESPN's per-game broadcast names. Every
 * NFL game is on a national outlet, but Sunday afternoon CBS and FOX games are
 * regional: out of market, they stream on NFL Sunday Ticket.
 */

const NETWORKS: Record<string, { name: string; services: WatchServiceId[] }> = {
  CBS: { name: 'CBS', services: ['paramount', 'directv', 'fubo', 'youtubetv'] },
  FOX: { name: 'FOX', services: ['foxone', 'directv', 'fubo', 'sling', 'youtubetv'] },
  NBC: { name: 'NBC', services: ['peacock', 'directv', 'fubo', 'sling', 'youtubetv'] },
  ESPN: { name: 'ESPN', services: ['espn', ...LIVE_TV] },
  ABC: { name: 'ABC', services: ['espn', 'directv', 'fubo', 'youtubetv'] },
  'ESPN2': { name: 'ESPN2', services: ['espn', ...LIVE_TV] },
  NFLN: { name: 'NFL Network', services: LIVE_TV },
  'NFL Net': { name: 'NFL Network', services: LIVE_TV },
  'Prime Video': { name: 'Prime Video', services: ['prime'] },
  Netflix: { name: 'Netflix', services: ['netflix'] },
  YouTube: { name: 'YouTube', services: [] },
};

/** True for a Sunday game starting before 7pm Eastern (the regional window). */
function isSundayAfternoon(startIso: string): boolean {
  const d = new Date(startIso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(d);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return weekday === 'Sun' && hour < 19;
}

export interface NFLWatchResult {
  info: NHLWatchInfo;
  /** Sunday afternoon CBS/FOX: coverage is regional. */
  regional: boolean;
}

export function nflWatchInfo(tv: string[] | undefined, startIso: string): NFLWatchResult {
  const national = (tv || [])
    .filter((n, i, a) => a.indexOf(n) === i)
    .map((code) => ({ code, name: NETWORKS[code]?.name ?? code, services: [...(NETWORKS[code]?.services ?? [])] }));
  const regional = national.some((n) => n.code === 'CBS' || n.code === 'FOX') && isSundayAfternoon(startIso);
  if (regional) {
    for (const n of national) {
      if (n.code === 'CBS' || n.code === 'FOX') n.name = `${n.name} (regional)`;
      if (!n.services.includes('sundayticket')) n.services.push('sundayticket');
    }
  }
  return {
    info: { national, home: [], away: [], canada: [], outOfMarketStream: false, nationalExclusive: national.length > 0 },
    regional,
  };
}

export const NFL_REGIONAL_NOTE = 'Sunday afternoon CBS and FOX games are regional. Out of market, stream on NFL Sunday Ticket.';
