import { LIVE_TV, type NHLWatchInfo, type WatchNetwork, type WatchServiceId } from './nhlWatch';

/**
 * "Where to watch" for MLB games from the Stats API's `broadcasts` hydration.
 * National broadcasts come as combined names ("TBS/HBO MAX", "FOX / FS1"),
 * so each is split into its outlets to find the streaming services.
 */

export interface MLBBroadcast {
  name: string;
  type?: string;
  homeAway?: string | null;
  isNational?: boolean;
  language?: string;
}

const OUTLETS: Record<string, { name: string; services: WatchServiceId[] }> = {
  NBC: { name: 'NBC', services: ['peacock', ...LIVE_TV] },
  PEACOCK: { name: 'Peacock', services: ['peacock'] },
  NBCSN: { name: 'NBCSN', services: [] },
  TBS: { name: 'TBS', services: ['max', 'directv', 'sling', 'youtubetv'] },
  'HBO MAX': { name: 'HBO Max', services: ['max'] },
  TRUTV: { name: 'truTV', services: ['max', 'directv', 'sling', 'youtubetv'] },
  FOX: { name: 'FOX', services: ['foxone', ...LIVE_TV] },
  FS1: { name: 'FS1', services: ['foxone', ...LIVE_TV] },
  'FOX ONE': { name: 'FOX One', services: ['foxone'] },
  ESPN: { name: 'ESPN', services: ['espn', ...LIVE_TV] },
  'MLB NETWORK': { name: 'MLB Network', services: LIVE_TV },
  MLBN: { name: 'MLB Network', services: LIVE_TV },
  NETFLIX: { name: 'Netflix', services: ['netflix'] },
  'PRIME VIDEO': { name: 'Prime Video', services: ['prime'] },
};

function parseNational(name: string): WatchNetwork {
  const parts = name.split('/').map((p) => p.trim()).filter(Boolean);
  const services: WatchServiceId[] = [];
  const names: string[] = [];
  for (const part of parts) {
    const def = OUTLETS[part.toUpperCase()];
    names.push(def?.name ?? part);
    for (const s of def?.services ?? []) if (!services.includes(s)) services.push(s);
  }
  return { code: name, name: names.join(' / '), services };
}

export interface MLBWatchResult {
  info: NHLWatchInfo;
  /** Spanish-language national broadcasts, e.g. "Univision / TUDN". */
  spanish: string[];
}

export function mlbWatchInfo(broadcasts: MLBBroadcast[] | undefined): MLBWatchResult {
  const info: NHLWatchInfo = { national: [], home: [], away: [], canada: [], outOfMarketStream: false, nationalExclusive: false };
  const spanish: string[] = [];
  const add = (list: WatchNetwork[], net: WatchNetwork) => {
    if (!list.some((n) => n.code === net.code)) list.push(net);
  };
  for (const b of broadcasts || []) {
    if (b.type && b.type !== 'TV') continue;
    const name = (b.name || '').trim();
    if (!name) continue;
    if (b.language && b.language !== 'en') {
      const clean = name.split('/').map((p) => p.trim()).join(' / ');
      if (b.isNational && !spanish.includes(clean)) spanish.push(clean);
      continue;
    }
    if (b.isNational) add(info.national, parseNational(name));
    else if (b.homeAway === 'home') add(info.home, { code: name, name, services: [] });
    else if (b.homeAway === 'away') add(info.away, { code: name, name, services: [] });
  }
  info.nationalExclusive = info.national.length > 0;
  return { info, spanish };
}
