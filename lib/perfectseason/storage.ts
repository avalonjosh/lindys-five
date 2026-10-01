/**
 * localStorage persistence for the Daily: one-attempt lockout, streaks, and
 * personal stats (spec Section 13). SSR-safe. Versioned prefix for migrations.
 */

const VERSION_KEY = 'l5ps.version';
const VERSION = 1;
const ONBOARDED_KEY = 'l5ps.onboarded';

export interface GridCell {
  slot: string;
  decade: string;
  franchise: string;
  skipped: boolean;
  // Optional richer fields for the 82-0.com-style roster cards (NHL result).
  // Older saved records / the MLB share grid simply omit these.
  playerName?: string;
  franchiseId?: string;
  stats?: { label: string; value: string }[];
}

export interface DailyRecord {
  done: true;
  dayNumber: number;
  wins: number;
  losses: number;
  setsWon: number;
  totalSets: number;
  perfectSets: number;
  verdict: string;
  grid: GridCell[];
  skips: { team: boolean; decade: boolean };
  // Roster rating (0-100) + derived letter grade / tier; optional for back-compat.
  rating?: number;
  grade?: string;
  tier?: string;
  // ET date the daily was for, e.g. "2026-06-05"; optional for back-compat.
  date?: string;
}

export interface Streak {
  current: number;
  best: number;
  lastPlayed: string | null;
}

export interface Stats {
  played: number;
  totalWins: number;
  best: number;
  perfectSets: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; ignore
  }
}

const dailyKey = (sport: string, date: string, variant: string) => `l5ps.${sport}.daily.${date}.${variant}`;
const statsKey = (sport: string, variant: string) => `l5ps.${sport}.stats.${variant}`;

function shiftDay(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function getDaily(sport: string, date: string, variant: string): DailyRecord | null {
  return read<DailyRecord | null>(dailyKey(sport, date, variant), null);
}

/**
 * A game's Daily streak: consecutive days you finished that game's Daily,
 * Classic or Blind. Still alive today if you played yesterday. The same rule
 * the account uses for its streak and streak cards (lib/perfectseason/server/cards.ts).
 */
export function getStreak(sport: string): Streak {
  const none: Streak = { current: 0, best: 0, lastPlayed: null };
  if (typeof window === 'undefined') return none;
  const prefix = `l5ps.${sport}.daily.`;
  const dates = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      const date = key?.startsWith(prefix) ? key.slice(prefix.length).split('.')[0] : null;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date);
    }
  } catch {
    return none;
  }
  if (dates.size === 0) return none;

  const lastPlayed = [...dates].sort().pop()!;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  let current = 0;
  for (let day = dates.has(today) ? today : shiftDay(today, -1); dates.has(day); day = shiftDay(day, -1)) current++;
  let best = 0;
  for (const date of dates) {
    if (dates.has(shiftDay(date, -1))) continue; // not the start of a run
    let run = 0;
    for (let day = date; dates.has(day); day = shiftDay(day, 1)) run++;
    best = Math.max(best, run);
  }
  return { current, best, lastPlayed };
}

export function getStats(sport: string, variant: string): Stats {
  return read<Stats>(statsKey(sport, variant), { played: 0, totalWins: 0, best: 0, perfectSets: 0 });
}

/** Record a completed Daily once: locks the day (which is what the streak counts) and rolls up the stats. */
export function recordDaily(sport: string, date: string, variant: string, rec: DailyRecord): void {
  write(VERSION_KEY, VERSION);
  if (getDaily(sport, date, variant)?.done) return; // already locked
  write(dailyKey(sport, date, variant), rec);

  const st = getStats(sport, variant);
  write(statsKey(sport, variant), {
    played: st.played + 1,
    totalWins: st.totalWins + rec.wins,
    best: Math.max(st.best, rec.wins),
    perfectSets: st.perfectSets + rec.perfectSets,
  });
}

export function isOnboarded(): boolean {
  return read<boolean>(ONBOARDED_KEY, false);
}

export function setOnboarded(): void {
  write(ONBOARDED_KEY, true);
}
