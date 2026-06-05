'use client';

import { useEffect, useState } from 'react';
import type { Sport } from '@/lib/perfectseason/types';
import type { GridTier } from '@/lib/perfectseason/storage';
import { franchiseColor, shortDecade } from '../ui';

export interface RosterEntry {
  slotLabel: string;
  franchiseId: string;
  decade: string;
  playerName: string;
  tier: GridTier;
  stats: { label: string; value: string }[];
}

interface ResultBoardProps {
  sport: Sport;
  games: number;
  tank: boolean;
  wins: number;
  rating?: number;
  grade?: string;
  tier?: string;
  /** Stat labels to sum in the team-totals row (e.g. ['G','A','P'] or ['HR','RBI']). */
  totalStats: string[];
  roster: RosterEntry[];
}

const CARD_TINT: Record<GridTier, string> = {
  green: 'border-l-emerald-500 bg-emerald-50',
  yellow: 'border-l-sabres-blue bg-blue-50',
  gray: 'border-l-gray-300 bg-gray-50',
};

function gradeColor(grade: string): string {
  const g = grade[0];
  if (g === 'A') return 'text-emerald-500';
  if (g === 'B') return 'text-sabres-blue';
  if (g === 'C') return 'text-amber-500';
  if (g === 'D') return 'text-orange-500';
  return 'text-sabres-red';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** 82-0.com-style result body: record + rating, then tinted roster cards + team totals. */
export default function ResultBoard({
  sport,
  games,
  tank,
  wins,
  rating,
  grade,
  tier,
  totalStats,
  roster,
}: ResultBoardProps) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setCount(wins);
      return;
    }
    const duration = 1000;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.round(wins * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wins]);

  // Team totals: sum the configured counting columns across the roster.
  const totals = (() => {
    const acc = new Map<string, number>();
    for (const r of roster) {
      for (const c of r.stats) {
        if (!totalStats.includes(c.label)) continue;
        const n = Number(String(c.value).replace(/[^\d.-]/g, ''));
        if (!Number.isNaN(n)) acc.set(c.label, (acc.get(c.label) ?? 0) + n);
      }
    }
    return totalStats.filter((k) => acc.has(k)).map((k) => ({ label: k, value: acc.get(k)! }));
  })();

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Record + rating hero. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{tank ? `Can you go 0-${games}?` : `Can you go ${games}-0?`}</p>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Projected record</p>
        <div className="text-7xl font-bold leading-none text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {count}
          <span className="mx-1 text-gray-300">–</span>
          {games - count}
        </div>
        {grade && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm">
            <span className={`text-3xl font-bold leading-none ${gradeColor(grade)}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {grade}
            </span>
            <span className="font-bold uppercase tracking-wide text-sabres-blue">{tier}</span>
            {rating != null && <span className="text-gray-400">· {rating} pts</span>}
          </div>
        )}
      </div>

      {/* Tinted roster cards. */}
      <div className="flex flex-col gap-2">
        {roster.map((r, i) => {
          return (
            <div key={`${r.slotLabel}-${i}`} className={`flex items-center gap-3 rounded-xl border border-l-4 border-gray-100 p-2.5 ${CARD_TINT[r.tier]}`}>
              <span
                className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white shadow-sm"
                style={{ background: franchiseColor(r.franchiseId, sport) ?? '#003087' }}
              >
                <span className="text-xs font-bold leading-none">{initials(r.playerName)}</span>
                <span className="mt-0.5 text-[8px] font-bold uppercase leading-none opacity-80">{r.slotLabel}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-gray-900">{r.playerName}</div>
                <div className="text-[11px] font-semibold text-gray-500">
                  {r.franchiseId} · {shortDecade(r.decade)}
                </div>
              </div>
              {r.stats.length > 0 && (
                <div className="flex shrink-0 gap-2.5">
                  {r.stats.map((c) => (
                    <div key={c.label} className="w-8 text-center">
                      <div className="text-sm font-bold text-gray-800">{c.value}</div>
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{c.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Team totals row. */}
      {totals.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border-2 border-sabres-blue/30 bg-sabres-blue/5 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-widest text-sabres-blue">Team Totals</span>
          <div className="flex gap-4">
            {totals.map((t) => (
              <div key={t.label} className="text-center">
                <div className="text-lg font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {t.value}
                </div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
