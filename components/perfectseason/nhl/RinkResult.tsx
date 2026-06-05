'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GameData, ModeDescriptor, Player, SimResult, SportConfig } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { poolPlayers } from '@/lib/perfectseason/schedule';
import { franchiseLogo, franchiseName, statCells } from '../ui';
import Decade from '../Decade';

interface RinkResultProps {
  result: SimResult;
  config: SportConfig;
  mode: ModeDescriptor;
  picks: PickRecord[];
  data: GameData;
  onPlayAgain: () => void;
}

type Tier = 'green' | 'yellow' | 'gray';

interface RosterRow {
  pick: PickRecord;
  player: Player | null;
  tier: Tier;
  cells: { label: string; value: string }[];
}

// Tier tint, 82-0.com's quality-coloring kept in Lindy's Five blue/gold.
const TINT: Record<Tier, string> = {
  green: 'border-emerald-300 bg-emerald-50',
  yellow: 'border-sabres-gold/50 bg-sabres-gold/10',
  gray: 'border-gray-200 bg-gray-50',
};
const BADGE: Record<Tier, string> = {
  green: 'bg-emerald-500 text-white',
  yellow: 'bg-sabres-gold text-sabres-navy',
  gray: 'bg-gray-300 text-gray-600',
};

function tierOf(pick: PickRecord, data: GameData, config: SportConfig): { tier: Tier; player: Player | null } {
  const pool = poolPlayers(data, pick.spin, config);
  const player = pool.find((pl) => pl.id === pick.playerId) ?? null;
  const higher = pool.filter((pl) => pl.score > pick.score).length;
  const tier: Tier = higher === 0 ? 'green' : higher < 3 ? 'yellow' : 'gray';
  return { tier, player };
}

/** 82-0.com-style result: centered record, tinted roster cards by pick quality,
 *  a team-totals row, and our 5-game-set framing kept. NHL free-play only. */
export default function RinkResult({ result, config, mode, picks, data, onPlayAgain }: RinkResultProps) {
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const tank = mode.type === 'tank';

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setCount(result.wins);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.round(result.wins * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result.wins]);

  const rows: RosterRow[] = useMemo(
    () =>
      picks.map((pick) => {
        const { tier, player } = tierOf(pick, data, config);
        return { pick, player, tier, cells: player ? statCells(player, config) : [] };
      }),
    [picks, data, config],
  );

  // Team totals: sum the skater counting columns across all skaters on the roster.
  const totals = useMemo(() => {
    const sumKeys = new Set(['G', 'A', 'P']);
    const acc = new Map<string, number>();
    for (const row of rows) {
      for (const c of row.cells) {
        if (!sumKeys.has(c.label)) continue;
        const n = Number(String(c.value).replace(/[^\d.-]/g, ''));
        if (!Number.isNaN(n)) acc.set(c.label, (acc.get(c.label) ?? 0) + n);
      }
    }
    return ['G', 'A', 'P'].filter((k) => acc.has(k)).map((k) => ({ label: k, value: acc.get(k)! }));
  }, [rows]);

  const heroColor = tank ? 'text-sabres-red' : 'text-sabres-navy';
  const barColor = tank ? 'bg-sabres-red' : 'bg-sabres-blue';
  const paceWidth = Math.max(6, (count / config.games) * 100);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(result, config, mode));
    } catch {
      /* clipboard unavailable; ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Centered record hero — 82-0.com's big-number top, Lindy's branding. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {tank ? 'Can you go 0-82?' : 'Can you go 82-0?'}
        </p>
        <div className={`mt-1 text-7xl font-bold leading-none ${heroColor}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {count}-{config.games - count}
        </div>
        <div className="mx-auto mt-3 h-6 w-full max-w-sm overflow-hidden rounded-full bg-gray-200 shadow-inner">
          <div
            className={`flex h-6 items-center justify-end rounded-full ${barColor} shadow-md transition-all duration-300`}
            style={{ width: `${paceWidth}%` }}
          >
            <span className="whitespace-nowrap pr-2.5 text-[11px] font-bold text-white">
              {count} of {config.games}
            </span>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold text-gray-600" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {result.verdict}
        </p>
      </div>

      {/* 5-game-set framing kept: set dots + sets-won / perfect. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your {result.totalSets} sets</p>
          <p className="text-xs font-bold text-sabres-blue">
            {result.setsWon}/{result.totalSets} won · {result.perfectSets} perfect
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {result.setWins.map((w, i) => {
            const size = config.setSizes[i];
            const cls = w === size ? 'bg-sabres-blue' : w * 2 > size ? 'bg-sabres-blue/40' : 'border border-dashed border-gray-300 bg-gray-100';
            return <span key={i} className={`h-4 w-4 rounded-md ${cls}`} aria-hidden />;
          })}
        </div>
      </div>

      {/* Tinted roster cards by pick quality. */}
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const slot = config.slots.find((s) => s.id === row.pick.slotId);
          const logo = franchiseLogo(row.pick.spin.franchise, data.sport);
          return (
            <div key={row.pick.slotId} className={`flex items-center gap-3 rounded-xl border-2 p-2.5 ${TINT[row.tier]}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase ${BADGE[row.tier]}`}>
                {slot?.label ?? row.pick.slotId}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-gray-900">{row.pick.playerName}</div>
                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                  {logo && <img src={logo} alt="" className="h-3.5 w-auto" />}
                  <Decade value={row.pick.spin.decade} /> {franchiseName(data, row.pick.spin)}
                </div>
              </div>
              {row.cells.length > 0 && (
                <div className="flex shrink-0 gap-2.5">
                  {row.cells.map((c) => (
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

      {/* Team totals row, 82-0.com's roster-sum footer. */}
      {totals.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border-2 border-sabres-blue/30 bg-sabres-blue/5 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-widest text-sabres-blue">Skater Totals</span>
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

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          {copied ? 'Copied' : 'Share result'}
        </button>
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition-colors hover:border-gray-400"
        >
          Build another
        </button>
      </div>
    </div>
  );
}

function buildShareText(result: SimResult, config: SportConfig, mode: ModeDescriptor): string {
  const title = config.sport === 'mlb' ? '162-0' : '82-0';
  const label = mode.type === 'tank' ? 'Tank (Free Play)' : mode.type === 'franchise' ? 'Franchise (Free Play)' : 'Free Play';
  return [`${title} ${config.shareIcon} ${label}`, `${result.wins}-${result.losses} · ${result.setsWon}/${result.totalSets} sets`, '', `lindysfive.com/${title}`].join('\n');
}
