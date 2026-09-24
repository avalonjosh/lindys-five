'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, ChevronRight } from 'lucide-react';
import { getDaily, getStreak } from '@/lib/perfectseason/storage';
import { easternDateString } from '@/lib/perfectseason/seed';

type Sport = 'nhl' | 'mlb';

interface PuzzleStatus {
  record: string | null;
  streak: number;
}

const PUZZLES: { sport: Sport; title: string; league: string; href: string; blurb: string; bg: string; border: string; label: string }[] = [
  { sport: 'nhl', title: '82-0', league: 'NHL', href: '/82-0', blurb: 'Draft an all-time roster. Chase a perfect season.', bg: '#0b2463', border: '#1e40af', label: 'text-blue-200' },
  { sport: 'mlb', title: '162-0', league: 'MLB', href: '/162-0', blurb: 'Nine spins, one all-time roster. Can it go perfect?', bg: '#041E42', border: '#1e3a6e', label: 'text-red-200' },
];

function readStatus(sport: Sport, today: string): PuzzleStatus {
  const rec = getDaily(sport, today, 'classic') ?? getDaily(sport, today, 'blind');
  const s = getStreak(sport, 'classic');
  const yesterday = easternDateString(new Date(Date.now() - 86400000));
  const alive = s.lastPlayed === today || s.lastPlayed === yesterday;
  return { record: rec ? `${rec.wins}-${rec.losses}` : null, streak: alive ? s.current : 0 };
}

/** Minutes until the next midnight Eastern, when the daily rolls over. */
function minutesToRollover(): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return 24 * 60 - (h * 60 + m);
}

export default function TodaysPuzzles() {
  const [today, setToday] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<Sport, PuzzleStatus> | null>(null);
  const [minsLeft, setMinsLeft] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const d = easternDateString();
      setToday(d);
      setStatus({ nhl: readStatus('nhl', d), mlb: readStatus('mlb', d) });
      setMinsLeft(minutesToRollover());
    };
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <section aria-labelledby="puzzles-heading" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 id="puzzles-heading" className="text-2xl text-white sm:text-3xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Today&apos;s Puzzles
        </h2>
        {today && (
          <span className="whitespace-nowrap text-xs text-slate-400 sm:text-sm">
            <span className="sm:hidden">{new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="hidden sm:inline">{new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
        {PUZZLES.map((p) => {
          const s = status?.[p.sport];
          const played = Boolean(s?.record);
          return (
            <div
              key={p.sport}
              className="flex flex-col gap-2 rounded-2xl border p-3.5 sm:p-4 lg:flex-row lg:items-center lg:gap-4"
              style={{ background: p.bg, borderColor: p.border }}
            >
              <div className="text-center text-5xl leading-none text-white lg:w-24 lg:text-left" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {p.title}
              </div>
              <div className="hidden min-w-0 flex-1 flex-col gap-1 lg:flex">
                <div className={`text-[11px] font-bold tracking-wider ${p.label}`}>
                  {p.league}
                  {status && (played ? ' · PLAYED' : ' · NOT PLAYED')}
                </div>
                {played ? (
                  <div className="text-lg font-extrabold text-white sm:text-xl">You went {s?.record}</div>
                ) : (
                  <div className="text-sm leading-snug text-slate-200">{p.blurb}</div>
                )}
                {s && s.streak > 0 && (
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-400 sm:text-sm">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    {played ? `${s.streak}-day streak` : `Keep your ${s.streak}-day streak`}
                  </div>
                )}
                {played && (
                  <div className="text-xs text-blue-100">
                    Next puzzle in {Math.floor(minsLeft / 60)}h {minsLeft % 60}m
                  </div>
                )}
              </div>
              <Link
                href={p.href}
                className={`flex min-h-9 items-center justify-center gap-0.5 self-center rounded-lg px-5 text-xs font-bold text-white transition-colors lg:min-h-10 lg:text-sm ${
                  played ? 'border border-white/30 hover:bg-white/10' : 'bg-white/15 hover:bg-white/25'
                }`}
              >
                {played ? 'Result' : 'Play'}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
