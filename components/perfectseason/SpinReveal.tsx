'use client';

import { useEffect, useState } from 'react';
import type { GameData, Spin } from '@/lib/perfectseason/types';
import { franchiseName, shortDecade } from './ui';

interface SpinRevealProps {
  data: GameData;
  spin: Spin;
  /** True once the player has spun this round; tiles stay blank until then. */
  revealed: boolean;
  /** Changes whenever a fresh reveal should play (round, or a skip reroll). */
  revealKey: string;
  round: number;
  totalRounds: number;
}

/**
 * The slot-machine moment, the one accent the game layer adds (Section 11.3).
 * Before the spin the tiles read blank; on spin the decade tile flips in, then
 * the franchise tile a beat later. prefers-reduced-motion collapses to instant.
 */
export default function SpinReveal({ data, spin, revealed, revealKey, round, totalRounds }: SpinRevealProps) {
  const [stage, setStage] = useState(0); // 0 nothing, 1 decade in, 2 franchise in

  useEffect(() => {
    if (!revealed) {
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
    const t1 = setTimeout(() => setStage(1), 60);
    const t2 = setTimeout(() => setStage(2), 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [revealed, revealKey]);

  const tile = 'rounded-2xl text-center shadow-lg px-4 py-3 transition-all duration-300';
  const tileBg = { background: '#002D72' }; // matches the header blue

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
        {revealed ? `Round ${round + 1} of ${totalRounds}` : `Round ${round + 1} · spin to reveal your decade + franchise`}
      </div>

      <div className="flex items-stretch justify-center gap-2">
        <div className={`${tile} ${revealed && stage >= 1 ? 'opacity-100' : 'opacity-90'}`} style={tileBg}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">Decade</div>
          <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {revealed && stage >= 1 ? shortDecade(spin.decade) : '-'}
          </div>
        </div>
        <div className={`${tile} flex-1 max-w-[260px] ${revealed && stage >= 2 ? 'opacity-100' : 'opacity-90'}`} style={tileBg}>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">Franchise</div>
          <div className="text-xl font-bold leading-tight text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {revealed && stage >= 2 ? franchiseName(data, spin) : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
