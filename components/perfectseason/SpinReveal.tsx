'use client';

import { useEffect, useState } from 'react';
import type { GameData, Spin } from '@/lib/perfectseason/types';
import { franchiseName, shortDecade } from './ui';

interface SpinRevealProps {
  data: GameData;
  spin: Spin;
  /** Changes whenever a fresh reveal should play (round index, or skip count). */
  revealKey: string;
  round: number;
  totalRounds: number;
}

/**
 * The slot-machine moment: the one accent treatment the game layer adds
 * (Section 11.3). The decade tile flips in first, then the franchise tile a
 * beat later. prefers-reduced-motion collapses both to an instant fade.
 */
export default function SpinReveal({ data, spin, revealKey, round, totalRounds }: SpinRevealProps) {
  const [stage, setStage] = useState(0); // 0 nothing, 1 decade in, 2 franchise in

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStage(2);
      return;
    }
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 60);
    const t2 = setTimeout(() => setStage(2), 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [revealKey]);

  const tile = 'rounded-xl bg-sabres-navy text-center shadow-lg px-4 py-3 transition-all duration-300';
  const hidden = 'opacity-0 -translate-y-2 scale-95';
  const shown = 'opacity-100 translate-y-0 scale-100';

  return (
    <div className="text-center">
      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
        Round {round + 1} of {totalRounds}
      </div>
      <div className="flex items-stretch justify-center gap-2">
        <div className={`${tile} ${stage >= 1 ? shown : hidden}`}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-sabres-gold/80">Decade</div>
          <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {shortDecade(spin.decade)}
          </div>
        </div>
        <div className={`${tile} ${stage >= 2 ? shown : hidden} flex-1 max-w-[260px]`}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-sabres-gold/80">Franchise</div>
          <div
            className="text-xl font-bold text-white leading-tight"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            {franchiseName(data, spin)}
          </div>
        </div>
      </div>
    </div>
  );
}
