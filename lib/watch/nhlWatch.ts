/**
 * "Where to watch" for NHL games, built from the NHL API's per-game
 * `tvBroadcasts` (network code, market N/H/A, country). National networks map
 * to the streaming services that carry them; regional networks only get a
 * readable name (their streaming options vary by market, so we don't guess).
 *
 * Streaming links go direct until an affiliate link is configured for a
 * service (NEXT_PUBLIC_WATCH_{ID}_URL), mirroring the Fanatics fallback.
 */

export type WatchServiceId =
  | 'espn'
  | 'max'
  | 'prime'
  | 'fubo'
  | 'youtubetv'
  | 'sling'
  | 'directv'
  | 'sportsnetplus'
  | 'tsnplus';

interface WatchServiceDef {
  name: string;
  url: string;
  /** Affiliate/tracking URL, when configured. */
  affiliateUrl?: string;
}

// NEXT_PUBLIC_ env reads must be static property accesses so Next inlines them.
export const WATCH_SERVICES: Record<WatchServiceId, WatchServiceDef> = {
  espn: { name: 'ESPN+', url: 'https://plus.espn.com/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_ESPN_URL },
  max: { name: 'HBO Max', url: 'https://www.hbomax.com/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_MAX_URL },
  prime: { name: 'Prime Video', url: 'https://www.amazon.com/primevideo', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_PRIME_URL },
  fubo: { name: 'Fubo', url: 'https://www.fubo.tv/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_FUBO_URL },
  youtubetv: { name: 'YouTube TV', url: 'https://tv.youtube.com/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_YOUTUBETV_URL },
  sling: { name: 'Sling TV', url: 'https://www.sling.com/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_SLING_URL },
  directv: { name: 'DIRECTV', url: 'https://www.directv.com/stream/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_DIRECTV_URL },
  sportsnetplus: { name: 'Sportsnet+', url: 'https://watch.sportsnet.ca/', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_SPORTSNETPLUS_URL },
  tsnplus: { name: 'TSN+', url: 'https://www.tsn.ca/plus', affiliateUrl: process.env.NEXT_PUBLIC_WATCH_TSNPLUS_URL },
};

export function watchServiceUrl(id: WatchServiceId): string {
  const s = WATCH_SERVICES[id];
  return s.affiliateUrl || s.url;
}

export function isWatchAffiliate(id: WatchServiceId): boolean {
  return !!WATCH_SERVICES[id].affiliateUrl;
}

interface NetworkDef {
  name: string;
  services: WatchServiceId[];
}

// Affiliate programs first (DirecTV, Fubo, Sling); YouTube TV has none.
// NHL Network simulcasts alongside the teams' local broadcasts.
const SHARED_NATIONAL = new Set(['NHLN']);

const LIVE_TV: WatchServiceId[] = ['directv', 'fubo', 'sling', 'youtubetv'];

// US national broadcasts (market "N").
const US_NATIONAL: Record<string, NetworkDef> = {
  ESPN: { name: 'ESPN', services: ['espn', ...LIVE_TV] },
  ABC: { name: 'ABC', services: ['espn', 'directv', 'fubo', 'youtubetv'] },
  'ESPN+': { name: 'ESPN+', services: ['espn'] },
  HULU: { name: 'Hulu', services: ['espn'] },
  'Disney+': { name: 'Disney+', services: ['espn'] },
  TNT: { name: 'TNT', services: ['max', 'directv', 'sling', 'youtubetv'] },
  truTV: { name: 'truTV', services: ['max', 'directv', 'sling', 'youtubetv'] },
  'HBO MAX': { name: 'HBO Max', services: ['max'] },
  NHLN: { name: 'NHL Network', services: LIVE_TV },
};

// Canadian broadcasts (all markets).
const CANADA: Record<string, NetworkDef> = {
  SN: { name: 'Sportsnet', services: ['sportsnetplus'] },
  SN1: { name: 'Sportsnet One', services: ['sportsnetplus'] },
  SN360: { name: 'Sportsnet 360', services: ['sportsnetplus'] },
  'SN+': { name: 'Sportsnet+', services: ['sportsnetplus'] },
  SNE: { name: 'Sportsnet East', services: ['sportsnetplus'] },
  SNO: { name: 'Sportsnet Ontario', services: ['sportsnetplus'] },
  SNP: { name: 'Sportsnet Pacific', services: ['sportsnetplus'] },
  SNW: { name: 'Sportsnet West', services: ['sportsnetplus'] },
  TSN2: { name: 'TSN2', services: ['tsnplus'] },
  TSN3: { name: 'TSN3', services: ['tsnplus'] },
  TSN4: { name: 'TSN4', services: ['tsnplus'] },
  TSN5: { name: 'TSN5', services: ['tsnplus'] },
  TVAS: { name: 'TVA Sports', services: [] },
  TVAS2: { name: 'TVA Sports 2', services: [] },
  RDS: { name: 'RDS', services: [] },
  RDS2: { name: 'RDS2', services: [] },
  RDSI: { name: 'RDS Info', services: [] },
  Prime: { name: 'Prime Video', services: [] },
};

// Readable names for US regional networks we're sure of; others show as-is.
const US_REGIONAL_NAMES: Record<string, string> = {
  'MSG-B': 'MSG Buffalo',
  MSG: 'MSG Network',
  'MSG 2': 'MSG 2',
  MSGSN: 'MSG Sportsnet',
  MSGSN2: 'MSG Sportsnet 2',
  NESN: 'NESN',
  NBCSP: 'NBC Sports Philadelphia',
  'NBCSP+': 'NBC Sports Philadelphia+',
  NBCSCA: 'NBC Sports California',
  MNMT: 'Monumental Sports Network',
  MNMT2: 'Monumental Sports Network 2',
  ALT: 'Altitude',
  ALT2: 'Altitude 2',
  CHSN: 'Chicago Sports Network',
  'CHSN+': 'Chicago Sports Network+',
  'SN-PIT': 'SportsNet Pittsburgh',
  'Prime Video': 'Prime Video',
};

// Local games streaming on Prime Video in 2026-27 (Prime is the in-market
// home for CAR, ANA, CBJ, DAL, MIN, STL and SEA; the NHL API labels some of
// these by team feed code).
const PRIME_LOCAL = new Set(['Prime Video', 'CARNHL', 'CBJNHL', 'MINNHL', 'STLNHL']);

export interface WatchNetwork {
  code: string;
  name: string;
  services: WatchServiceId[];
}

export interface NHLWatchInfo {
  /** US national broadcast(s): the game is exclusive to these in the US. */
  national: WatchNetwork[];
  /** US regional broadcasts by side. */
  home: WatchNetwork[];
  away: WatchNetwork[];
  canada: WatchNetwork[];
  /** No US national broadcast: out-of-market US fans stream on ESPN+. */
  outOfMarketStream: boolean;
  /** A national broadcast that replaces the local ones (not NHL Network). */
  nationalExclusive: boolean;
}

export interface TvBroadcast {
  network: string;
  market?: string;
  countryCode?: string;
}

const uniq = (list: WatchNetwork[]) => list.filter((n, i) => list.findIndex((m) => m.name === n.name) === i);

export function nhlWatchInfo(broadcasts: TvBroadcast[] | undefined): NHLWatchInfo {
  const info: NHLWatchInfo = { national: [], home: [], away: [], canada: [], outOfMarketStream: false, nationalExclusive: false };
  for (const b of broadcasts || []) {
    const code = (b.network || '').trim();
    if (!code) continue;
    if (b.countryCode === 'CA') {
      const def = CANADA[code];
      info.canada.push({ code, name: def?.name ?? code, services: def?.services ?? [] });
      continue;
    }
    if (b.market === 'N') {
      const def = US_NATIONAL[code];
      info.national.push({ code, name: def?.name ?? code, services: def?.services ?? [] });
      continue;
    }
    const prime = PRIME_LOCAL.has(code);
    const net = { code, name: prime ? 'Prime Video' : US_REGIONAL_NAMES[code] ?? code, services: prime ? ['prime' as const] : [] };
    if (b.market === 'H') info.home.push(net);
    else if (b.market === 'A') info.away.push(net);
  }
  info.national = uniq(info.national);
  info.home = uniq(info.home);
  info.away = uniq(info.away);
  info.canada = uniq(info.canada);
  info.outOfMarketStream = info.national.length === 0 && (info.home.length > 0 || info.away.length > 0);
  info.nationalExclusive = info.national.some((n) => !SHARED_NATIONAL.has(n.code));
  return info;
}

export interface StreamOption {
  id: WatchServiceId;
  /** Where it works, for regional streams (e.g. the home team's market). */
  area?: 'home' | 'away';
}

/** Streaming options for a US viewer: national first, then regional
 *  (tagged with their market), then ESPN+ for out-of-market games. */
export function usStreamingServices(info: NHLWatchInfo): StreamOption[] {
  const out: StreamOption[] = [];
  const has = (id: WatchServiceId, area?: 'home' | 'away') => out.some((o) => o.id === id && o.area === area);
  for (const n of info.national) for (const id of n.services) if (!has(id)) out.push({ id });
  for (const [area, list] of [['home', info.home], ['away', info.away]] as const) {
    for (const n of list) for (const id of n.services) if (!has(id, area)) out.push({ id, area });
  }
  if (info.outOfMarketStream && !has('espn')) out.push({ id: 'espn' });
  return out;
}

/** One short line for tight spots: "TNT · HBO Max" or "MSG Buffalo · CHSN". */
export function watchSummary(info: NHLWatchInfo): string | null {
  const names = info.nationalExclusive
    ? info.national.map((n) => n.name)
    : [...info.national, ...info.away, ...info.home].map((n) => n.name);
  const unique = names.filter((n, i) => names.indexOf(n) === i);
  return unique.length ? unique.slice(0, 3).join(' · ') : null;
}
