'use client';

import { useEffect, useState } from 'react';
import type { ModeDescriptor, SimResult, SportConfig } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseLogo, franchiseName } from './ui';
import Decade from './Decade';
import type { GameData } from '@/lib/perfectseason/types';

interface ResultCardProps {
  result: SimResult;
  config: SportConfig;
  mode: ModeDescriptor;
  picks: PickRecord[];
  data: GameData;
  onPlayAgain: () => void;
}

/**
 * The result screen. The win total counts up while the set dots fill beneath,
 * then the verdict stamps. Free Play results get a downplayed, clearly labeled
 * share with no day number or streak (Section 10).
 */
export default function ResultCard({ result, config, mode, picks, data, onPlayAgain }: ResultCardProps) {
  const [count, setCount] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [copied, setCopied] = useState(false);
  const tank = mode.type === 'tank';

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setCount(result.wins);
      setStamped(true);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.round(result.wins * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setStamped(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result.wins]);

  const accentBorder = tank ? 'border-sabres-red' : 'border-sabres-gold';

  const shareText = buildShareText(result, config, mode);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Fallback handled below via a textarea is overkill here; ignore.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const barColor = tank ? 'bg-sabres-red' : 'bg-sabres-blue';
  const heroColor = tank ? 'text-sabres-red' : 'text-sabres-navy';
  const paceWidth = Math.max(6, (count / config.games) * 100);

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Hero record with a win-pace bar, mirroring the tracker's projected-wins bar. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {tank ? 'Final tank' : 'Final record'}
        </p>
        <div className={`text-6xl font-bold leading-none ${heroColor}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {count}-{config.games - count}
        </div>
        <div className="mt-3 h-7 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner">
          <div
            className={`flex h-7 items-center justify-end rounded-full ${barColor} shadow-md transition-all duration-300`}
            style={{ width: `${paceWidth}%` }}
          >
            <span className="whitespace-nowrap pr-2.5 text-[11px] font-bold text-white">
              {count} of {config.games}
            </span>
          </div>
        </div>
      </div>

      {/* Stat summary cards, the tracker's record-summary vocabulary. */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Wins" value={count} />
        <StatCard label="Losses" value={config.games - count} />
        <StatCard label="Sets Won" value={`${result.setsWon}/${result.totalSets}`} />
        <StatCard label="Perfect Sets" value={result.perfectSets} />
      </div>

      {/* Set chips: same win / loss family as the tracker set cards. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-md">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Your {result.totalSets} sets</p>
        <div className="flex flex-wrap gap-1">
          {result.setWins.map((w, i) => {
            const size = config.setSizes[i];
            const cls =
              w === size
                ? 'bg-sabres-blue'
                : w * 2 > size
                  ? 'bg-sabres-blue/40'
                  : 'border border-dashed border-gray-300 bg-gray-100';
            return <span key={i} className={`h-4 w-4 rounded-md ${cls}`} aria-hidden />;
          })}
        </div>
      </div>

      {/* Verdict as a status pill, like the tracker's Target Met badge. */}
      <div className={`flex justify-center transition-all duration-500 ${stamped ? 'scale-100 opacity-100' : 'scale-110 opacity-0'}`}>
        <span
          className={`inline-flex items-center rounded-full border-2 px-4 py-2 text-center text-base font-bold ${accentBorder} ${tank ? 'bg-sabres-red/10 text-sabres-red' : 'bg-sabres-gold/15 text-sabres-navy'}`}
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {result.verdict}
        </span>
      </div>

      {/* Roster recap, era-correct names as text only. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-md">
        <div className="mb-2 border-b-2 border-gray-100 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your roster</p>
        </div>
        <ul className="grid grid-cols-1 gap-1.5">
          {picks.map((p) => (
            <li key={p.slotId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-semibold text-gray-800">{p.playerName}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                {franchiseLogo(p.spin.franchise, data.sport) && (
                  <img src={franchiseLogo(p.spin.franchise, data.sport)!} alt="" className="h-4 w-auto" />
                )}
                <Decade value={p.spin.decade} /> {franchiseName(data, p.spin)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          {copied ? 'Copied' : 'Copy result'}
        </button>
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition-colors hover:border-gray-400"
        >
          Play again
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

function buildShareText(result: SimResult, config: SportConfig, mode: ModeDescriptor): string {
  const title = config.sport === 'mlb' ? '162-0' : '82-0';
  const label =
    mode.type === 'tank' ? 'Tank (Free Play)' : mode.type === 'franchise' ? 'Franchise (Free Play)' : 'Free Play';
  return [
    `${title} ${config.shareIcon} ${label}`,
    `${result.wins}-${result.losses} · ${result.setsWon}/${result.totalSets} sets`,
    '',
    `lindysfive.com/${title}`,
  ].join('\n');
}
