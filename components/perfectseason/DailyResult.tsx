'use client';

import { useEffect, useState } from 'react';
import type { SportConfig } from '@/lib/perfectseason/types';
import type { DailyRecord, GridTier, Streak } from '@/lib/perfectseason/storage';
import { buildDailyShare } from '@/lib/perfectseason/share';
import { shortDecade } from './ui';

interface DailyResultProps {
  record: DailyRecord;
  config: SportConfig;
  variant: 'classic' | 'blind';
  streak: Streak;
  played: number;
  onPlayFree: () => void;
}

const TIER_BG: Record<GridTier, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  gray: 'bg-gray-300',
};

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

export default function DailyResult({ record, config, variant, streak, played, onPlayFree }: DailyResultProps) {
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(secondsUntilEtMidnight());

  useEffect(() => {
    const t = setInterval(() => setLeft(secondsUntilEtMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  const shareText = buildDailyShare(record, config, variant);
  const paceWidth = Math.max(6, (record.wins / config.games) * 100);

  const onShare = async () => {
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
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Daily #{record.dayNumber} · {variant === 'blind' ? '🧠 BallIQ' : 'Classic'}
          </p>
          <span className="rounded-full bg-sabres-gold/15 px-2 py-0.5 text-[11px] font-bold text-sabres-navy">
            🔥 {streak.current} day{streak.current === 1 ? '' : 's'}
          </span>
        </div>
        <div className="text-6xl font-bold leading-none text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {record.wins}-{record.losses}
        </div>
        <div className="mt-3 h-7 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner">
          <div
            className="flex h-7 items-center justify-end rounded-full bg-sabres-blue shadow-md"
            style={{ width: `${paceWidth}%` }}
          >
            <span className="whitespace-nowrap pr-2.5 text-[11px] font-bold text-white">
              {record.wins} of {config.games}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Sets Won" value={`${record.setsWon}/${record.totalSets}`} />
        <StatCard label="Perfect Sets" value={record.perfectSets} />
      </div>

      <div className="flex justify-center">
        <span
          className="inline-flex items-center rounded-full border-2 border-sabres-gold bg-sabres-gold/15 px-4 py-2 text-base font-bold text-sabres-navy"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {record.verdict}
        </span>
      </div>

      {/* Spoiler-safe share grid. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-md">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Your grid</p>
        <ul className="flex flex-col gap-1">
          {record.grid.map((cell, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-7 shrink-0 text-[11px] font-bold uppercase text-gray-500">{cell.slot}</span>
              <span className={`h-4 w-4 shrink-0 rounded-sm ${TIER_BG[cell.tier]}`} aria-hidden />
              <span className="truncate text-gray-700">
                {shortDecade(cell.decade)} {cell.franchise}
                {cell.skipped && <span className="ml-1 text-gray-400">⏭️</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Next daily in</p>
        <p className="text-2xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {fmt(left)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">Played {played} · Best {streak.best} day streak</p>
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
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2 text-center">
      <div className="text-2xl font-bold text-sabres-blue" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</div>
    </div>
  );
}
