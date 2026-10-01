'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flame } from 'lucide-react';
import { getDaily } from '@/lib/perfectseason/storage';
import { easternDateString } from '@/lib/perfectseason/seed';
import { nextMilestone, TIER_LABEL } from '@/lib/perfectseason/cards';
import type { ProfileResponse } from '@/app/api/account/profile/route';
import { SectionTitle } from './ui';

const PUZZLES = [
  { sport: 'nhl', title: '82-0', league: 'NHL', href: '/82-0', blurb: 'Draft an all-time roster. Chase a perfect season.', bg: '#0b2463', border: '#1e40af', label: 'text-blue-200' },
  { sport: 'mlb', title: '162-0', league: 'MLB', href: '/162-0', blurb: 'Nine spins, one all-time roster. Can it go perfect?', bg: '#041E42', border: '#1e3a6e', label: 'text-red-200' },
] as const;

/** Today's Dailies in the home page's style, with the account's per-game streak and next card. */
export default function PuzzlesPanel({ profile }: { profile: ProfileResponse | null }) {
  const [today, setToday] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<'nhl' | 'mlb', string | null>>({ nhl: null, mlb: null });

  useEffect(() => {
    const d = easternDateString();
    setToday(d);
    const rec = (s: 'nhl' | 'mlb') => {
      const r = getDaily(s, d, 'classic') ?? getDaily(s, d, 'blind');
      return r ? `${r.wins}-${r.losses}` : null;
    };
    setRecords({ nhl: rec('nhl'), mlb: rec('mlb') });
  }, []);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle
        right={today && (
          <span className="whitespace-nowrap text-xs text-slate-400 sm:text-sm">
            {new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        )}
      >
        Today&apos;s Puzzles
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
        {PUZZLES.map(p => {
          const played = !!profile?.perfectSeason.daily.playedToday[p.sport] || !!records[p.sport];
          const streak = profile?.perfectSeason.daily.bySport?.[p.sport].current ?? 0;
          const next = streak > 0 ? nextMilestone(p.sport, streak) : null;
          return (
            <div
              key={p.sport}
              className="flex flex-col gap-2 rounded-2xl border p-3.5 sm:p-4 lg:flex-row lg:items-center lg:gap-4"
              style={{ background: p.bg, borderColor: p.border }}
            >
              <div className="text-center text-5xl leading-none text-white lg:w-24 lg:text-left" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{p.title}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-center lg:text-left">
                <div className={`text-[11px] font-bold tracking-wider ${p.label}`}>{p.league} · {played ? 'PLAYED' : 'NOT PLAYED'}</div>
                {played ? (
                  <div className="text-base font-extrabold text-white sm:text-lg">{records[p.sport] ? `You went ${records[p.sport]}` : 'Played today'}</div>
                ) : (
                  <div className="hidden text-sm leading-snug text-slate-200 lg:block">{p.blurb}</div>
                )}
                {streak > 0 && (
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-amber-400 lg:justify-start sm:text-sm">
                    <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {played ? `${streak}-day streak` : `Keep your ${streak}-day streak`}
                      {next && <span className="hidden sm:inline"> · {TIER_LABEL[next.tier]} card in {next.daysLeft} day{next.daysLeft === 1 ? '' : 's'}</span>}
                    </span>
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
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
