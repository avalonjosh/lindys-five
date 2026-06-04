'use client';

import { useEffect, useState } from 'react';
import type { ModeDescriptor, SimResult, SportConfig } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseName, shortDecade } from './ui';
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

  const accent = tank ? 'text-sabres-red' : 'text-sabres-gold';
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

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {tank ? 'Final tank' : 'Final record'}
        </div>
        <div
          className={`text-6xl font-bold ${tank ? 'text-sabres-red' : 'text-sabres-navy'}`}
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {count}-{config.games - count}
        </div>
        <div className="text-sm font-semibold text-gray-500">
          {result.setsWon} of {result.totalSets} sets won · {result.perfectSets} perfect
        </div>
      </div>

      {/* Set dots: same win/loss visual family as the tracker set chips. */}
      <div className="flex flex-wrap justify-center gap-1 max-w-[320px]">
        {result.setWins.map((w, i) => {
          const size = config.setSizes[i];
          const cls =
            w === size ? 'bg-emerald-500' : w * 2 > size ? 'bg-emerald-300' : 'bg-gray-300';
          return <span key={i} className={`h-3.5 w-3.5 rounded-sm ${cls}`} aria-hidden />;
        })}
      </div>

      {/* Verdict stamp. */}
      <div
        className={`transition-all duration-500 ${stamped ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
      >
        <div
          className={`rounded-xl border-2 ${accentBorder} bg-white px-4 py-2 text-center shadow-md`}
        >
          <span className={`text-base font-bold ${accent}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {result.verdict}
          </span>
        </div>
      </div>

      {/* Roster recap, era-correct names as text only. */}
      <div className="w-full rounded-xl border-2 border-gray-200 bg-white p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Your roster</div>
        <ul className="grid grid-cols-1 gap-1">
          {picks.map((p) => (
            <li key={p.slotId} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">{p.playerName}</span>
              <span className="text-xs text-gray-500">
                {shortDecade(p.spin.decade)} {franchiseName(data, p.spin)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex w-full flex-col gap-2">
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

function buildShareText(result: SimResult, config: SportConfig, mode: ModeDescriptor): string {
  const title = config.sport === 'mlb' ? '162-0' : '82-0';
  const label = mode.type === 'tank' ? 'Tank (Free Play)' : 'Free Play';
  return [
    `${title} ${config.shareIcon} ${label}`,
    `${result.wins}-${result.losses} · ${result.setsWon}/${result.totalSets} sets`,
    '',
    `lindysfive.com/${title}`,
  ].join('\n');
}
