'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SportConfig } from '@/lib/perfectseason/types';
import type { DailyRecord, Streak } from '@/lib/perfectseason/storage';
import { buildDailyShare } from '@/lib/perfectseason/share';
import ResultBoard, { type RosterEntry } from './ResultBoard';

interface NhlDailyResultProps {
  record: DailyRecord;
  config: SportConfig;
  variant: 'classic' | 'blind';
  streak: Streak;
  played: number;
  onPlayFree: () => void;
}

function secondsUntilEtMidnight(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get('hour') % 24;
  return 24 * 3600 - (h * 3600 + get('minute') * 60 + get('second'));
}

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Daily result for NHL: the 82-0.com-style ResultBoard plus our daily layer. */
export default function NhlDailyResult({ record, config, variant, streak, played, onPlayFree }: NhlDailyResultProps) {
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(secondsUntilEtMidnight());

  useEffect(() => {
    const t = setInterval(() => setLeft(secondsUntilEtMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  const roster: RosterEntry[] = record.grid.map((c) => ({
    slotLabel: c.slot,
    franchiseId: c.franchiseId ?? '',
    decade: c.decade,
    // Pre-fix records have no player name; fall back to the team name.
    playerName: c.playerName || c.franchise,
    tier: c.tier,
    stats: c.stats ?? [],
  }));

  const dayLabel = record.date
    ? new Date(`${record.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : `Daily #${record.dayNumber}`;

  const onShare = async () => {
    const shareText = buildDailyShare(record, config, variant);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // user dismissed the share sheet; ignore
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {dayLabel} · {variant === 'blind' ? `🧠 ${config.blindLabel}` : 'Classic'}
        </p>
      </div>

      <ResultBoard
        sport={config.sport}
        games={config.games}
        tank={false}
        wins={record.wins}
        rating={record.rating}
        grade={record.grade}
        tier={record.tier}
        roster={roster}
      />

      <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Next daily in</p>
        <p className="text-2xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {fmt(left)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          Played {played} · Best {streak.best} day streak
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onShare}
          className="w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          {copied ? 'Copied' : 'Share'}
        </button>
        <button
          type="button"
          onClick={onPlayFree}
          className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition-colors hover:border-gray-400"
        >
          Free Play
        </button>
      </div>

      <Link
        href={config.sport === 'mlb' ? '/82-0' : '/162-0'}
        className="block text-center text-xs font-semibold text-sabres-blue underline-offset-2 hover:underline"
      >
        {config.sport === 'mlb' ? 'Now try the NHL daily · 82-0 🏒' : 'Now try the MLB daily · 162-0 ⚾'}
      </Link>
    </div>
  );
}
