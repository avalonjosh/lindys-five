'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameData, Spin } from '@/lib/perfectseason/types';
import { franchiseName, shortDecade } from './ui';

interface SpinRevealProps {
  data: GameData;
  spin: Spin;
  /** True while the reels are spinning; tiles read blank otherwise. */
  rolling: boolean;
  /** Changes whenever a fresh roll should play (round, or a skip reroll). */
  revealKey: string;
  round: number;
  totalRounds: number;
}

const ROLL_MS = 70; // how fast the reels cycle
const DECADE_LANDS = 750;
const FRANCHISE_LANDS = 1250;

/**
 * The slot-machine moment, the one accent the game layer adds (Section 11.3).
 * On spin both reels cycle through random values; the decade reel lands first,
 * then the franchise a beat later. prefers-reduced-motion lands instantly.
 */
export default function SpinReveal({ data, spin, rolling, revealKey, round, totalRounds }: SpinRevealProps) {
  const [stage, setStage] = useState(0); // 0 spinning, 1 decade landed, 2 both landed
  const [tick, setTick] = useState(0);

  const flashFranchises = useMemo(
    () => data.franchises.map((f) => Object.values(f.names)[0]).filter(Boolean) as string[],
    [data],
  );

  useEffect(() => {
    if (!rolling) {
      setStage(0);
      return;
    }
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStage(2);
      return;
    }
    setStage(0);
    setTick(0);
    const iv = setInterval(() => setTick((t) => t + 1), ROLL_MS);
    const t1 = setTimeout(() => setStage(1), DECADE_LANDS);
    const t2 = setTimeout(() => {
      setStage(2);
      clearInterval(iv);
    }, FRANCHISE_LANDS);
    return () => {
      clearInterval(iv);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [rolling, revealKey]);

  const decadeText = !rolling ? '-' : stage >= 1 ? shortDecade(spin.decade) : shortDecade(data.decades[tick % data.decades.length]);
  const franchiseText = !rolling
    ? '-'
    : stage >= 2
      ? franchiseName(data, spin)
      : flashFranchises[tick % Math.max(1, flashFranchises.length)] ?? '...';

  const decadeSpinning = rolling && stage < 1;
  const franchiseSpinning = rolling && stage < 2;

  const tile =
    'rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 text-center px-4 py-3 shadow-sm overflow-hidden';

  return (
    <div className="text-center">
      {/* Segmented round progress. */}
      <div className="mx-auto mb-2 flex max-w-[260px] items-center gap-1">
        {Array.from({ length: totalRounds }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < round ? 'bg-sabres-blue/50' : i === round ? 'bg-sabres-blue' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        {rolling ? `Round ${round + 1} of ${totalRounds}` : `Round ${round + 1} · spin to reveal your decade + franchise`}
      </div>

      <div className="flex items-stretch justify-center gap-2">
        <div className={`${tile} transition-transform ${decadeSpinning ? 'scale-[0.97]' : 'scale-100'}`}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Decade</div>
          <div
            className={`text-2xl font-bold text-sabres-blue ${decadeSpinning ? 'blur-[1px] opacity-80' : ''}`}
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            {decadeText}
          </div>
        </div>
        <div className={`${tile} flex-1 max-w-[260px] transition-transform ${franchiseSpinning ? 'scale-[0.97]' : 'scale-100'}`}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Franchise</div>
          <div
            className={`text-xl font-bold leading-tight text-sabres-blue ${franchiseSpinning ? 'blur-[1px] opacity-80' : ''}`}
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            {franchiseText}
          </div>
        </div>
      </div>
    </div>
  );
}
