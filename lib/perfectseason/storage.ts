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
const streakKey = (sport: string, variant: string) => `l5ps.${sport}.streak.${variant}`;
const statsKey = (sport: string, variant: string) => `l5ps.${sport}.stats.${variant}`;

function shiftDay(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function getDaily(sport: string, date: string, variant: string): DailyRecord | null {
  return read<DailyRecord | null>(dailyKey(sport, date, variant), null);
}

export function getStreak(sport: string, variant: string): Streak {
  return read<Streak>(streakKey(sport, variant), { current: 0, best: 0, lastPlayed: null });
}

export function getStats(sport: string, variant: string): Stats {
  return read<Stats>(statsKey(sport, variant), { played: 0, totalWins: 0, best: 0, perfectSets: 0 });
}

/**
 * Record a completed Daily once. Locks the day, extends or resets the streak
 * (a gap of more than one day breaks it), and rolls up the stats.
 */
export function recordDaily(sport: string, date: string, variant: string, rec: DailyRecord): void {
  write(VERSION_KEY, VERSION);
  if (getDaily(sport, date, variant)?.done) return; // already locked
  write(dailyKey(sport, date, variant), rec);

  const s = getStreak(sport, variant);
  const current = s.lastPlayed === shiftDay(date, -1) ? s.current + 1 : 1;
  write(streakKey(sport, variant), { current, best: Math.max(s.best, current), lastPlayed: date });

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
