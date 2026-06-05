'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameData, Spin } from '@/lib/perfectseason/types';
import { franchiseLogo, franchiseName } from './ui';
import Decade from './Decade';

interface SpinRevealProps {
  data: GameData;
  spin: Spin;
  /** True while the reels are spinning; tiles read blank otherwise. */
  rolling: boolean;
  /** The last round's spin, shown muted on the board until the next spin. */
  previousSpin: Spin | null;
  /** Shown muted on the very first board (no previous spin yet) as a preview. */
  defaultSpin: Spin | null;
  /** Franchise mode: the franchise is fixed and shown vivid; only the decade rolls. */
  decadeOnly?: boolean;
  /** Changes whenever a fresh roll should play (round, or a skip reroll). */
  revealKey: string;
  round: number;
  totalRounds: number;
  /** Tile styling: 'mlb' keeps the light tiles; 'nhl' uses 82-0.com-style navy/gold panels. */
  tileVariant?: 'mlb' | 'nhl';
}

const ROLL_MS = 70; // how fast the reels cycle
const DECADE_LANDS = 750;
const FRANCHISE_LANDS = 1250;

/**
 * The slot-machine moment, the one accent the game layer adds (Section 11.3).
 * On spin both reels cycle through random values; the decade reel lands first,
 * then the franchise a beat later. prefers-reduced-motion lands instantly.
 */
export default function SpinReveal({
  data,
  spin,
  rolling,
  previousSpin,
  defaultSpin,
  decadeOnly = false,
  revealKey,
  round,
  totalRounds,
  tileVariant = 'mlb',
}: SpinRevealProps) {
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

  // On the board (not rolling) rest on the previous spin, or a default preview.
  const boardSpin = previousSpin ?? defaultSpin;
  const decadeValue = rolling
    ? stage >= 1
      ? spin.decade
      : data.decades[tick % data.decades.length]
    : boardSpin
      ? boardSpin.decade
      : null;
  // Franchise mode: the franchise is fixed (always shown vivid), only decade rolls.
  const franchiseText = decadeOnly
    ? franchiseName(data, spin)
    : rolling
      ? stage >= 2
        ? franchiseName(data, spin)
        : flashFranchises[tick % Math.max(1, flashFranchises.length)] ?? '...'
      : boardSpin
        ? franchiseName(data, boardSpin)
        : null;

  const decadeSpinning = rolling && stage < 1;
  const franchiseSpinning = !decadeOnly && rolling && stage < 2;
  // The board shows the resting spin muted; rolling and landed values are vivid.
  const nhl = tileVariant === 'nhl';
  const labelColor = nhl ? 'text-white/60' : 'text-gray-500';
  const valueColor = nhl ? (rolling ? 'text-white' : 'text-white/70') : rolling ? 'text-sabres-blue' : 'text-gray-400';
  const franchiseColor = decadeOnly ? (nhl ? 'text-white' : 'text-sabres-blue') : valueColor;

  // Logo shows on the landed franchise (or the board's resting one).
  const landedFranchiseId = decadeOnly
    ? spin.franchise
    : rolling
      ? stage >= 2
        ? spin.franchise
        : null
      : boardSpin?.franchise ?? null;
  const logo = landedFranchiseId ? franchiseLogo(landedFranchiseId, data.sport) : null;

  const tile = nhl
    ? 'rounded-2xl border-2 border-sabres-gold/40 bg-gradient-to-br from-sabres-navy to-sabres-blue text-center px-4 py-4 shadow-md overflow-hidden'
    : 'rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 text-center px-4 py-3 shadow-sm overflow-hidden';

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
        {rolling
          ? `Round ${round + 1} of ${totalRounds}`
          : decadeOnly
            ? `Round ${round + 1} · spin to reveal your decade`
            : previousSpin
              ? `Round ${round + 1} · last spin shown · tap spin for a new one`
              : `Round ${round + 1} · spin to reveal your decade + franchise`}
      </div>

      <div className="flex items-stretch justify-center gap-2">
        <div className={`${tile} transition-transform ${decadeSpinning ? 'scale-[0.97]' : 'scale-100'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>Decade</div>
          <div
            className={`text-2xl font-bold ${valueColor} ${decadeSpinning ? 'blur-[1px] opacity-80' : ''}`}
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            {decadeValue ? <Decade value={decadeValue} /> : '-'}
          </div>
        </div>
        <div className={`${tile} flex-1 max-w-[260px] transition-transform ${franchiseSpinning ? 'scale-[0.97]' : 'scale-100'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>Franchise</div>
          <div
            className={`flex items-center justify-center gap-1.5 text-xl font-bold leading-tight ${franchiseColor} ${franchiseSpinning ? 'blur-[1px] opacity-80' : ''}`}
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            {logo && <img src={logo} alt="" className={`h-5 w-auto shrink-0 ${rolling || decadeOnly ? '' : 'opacity-60'}`} />}
            <span className="truncate">{franchiseText ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
