/**
 * Daily seed, deterministic RNG, date rollover, and the day-number epoch.
 * Spec Section 7.1. Everyone on Earth gets the same spins each day because the
 * seed is a pure hash of the sport plus the Eastern-time date string.
 */

/**
 * Launch date for the day counter. The displayed day number is days since this
 * epoch plus one ("Daily #47"). Defined once and never changed, since it is
 * baked into every shared grid. Placeholder until the public launch date locks.
 */
export const DAILY_EPOCH = '2026-06-01';

/** xmur3-style string hash. Stable across runs and machines. */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's date as YYYY-MM-DD in America/New_York (midnight Eastern rollover). */
export function easternDateString(at?: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(at ?? new Date());
}

/** Whole days between two YYYY-MM-DD strings (b minus a), UTC-noon anchored. */
function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T12:00:00Z`);
  const db = Date.parse(`${b}T12:00:00Z`);
  return Math.round((db - da) / 86400000);
}

/** Displayed day number for a date: days since DAILY_EPOCH plus one. */
export function dayNumber(dateString: string): number {
  return daysBetween(DAILY_EPOCH, dateString) + 1;
}

/** Deterministic RNG for a given sport and date. */
export function dailyRng(sport: string, dateString: string): () => number {
  return mulberry32(hashString(`L5-${sport}-${dateString}`));
}
