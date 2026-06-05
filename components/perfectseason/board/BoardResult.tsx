'use client';

import { useMemo, useState } from 'react';
import type { GameData, ModeDescriptor, SportConfig } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import type { SimResult } from '@/lib/perfectseason/types';
import type { GridTier } from '@/lib/perfectseason/storage';
import { poolPlayers } from '@/lib/perfectseason/schedule';
import { rosterRating } from '@/lib/perfectseason/rating';
import { statCells } from '../ui';
import ResultBoard, { type RosterEntry } from './ResultBoard';

interface RinkResultProps {
  result: SimResult;
  config: SportConfig;
  mode: ModeDescriptor;
  picks: PickRecord[];
  data: GameData;
  onPlayAgain: () => void;
}

/** Free-play NHL result: the shared 82-0.com-style ResultBoard + share/build-another. */
export default function RinkResult({ result, config, mode, picks, data, onPlayAgain }: RinkResultProps) {
  const [copied, setCopied] = useState(false);
  const tank = mode.type === 'tank';

  const { roster, rating } = useMemo(() => {
    const roster: RosterEntry[] = picks.map((p) => {
      const pool = poolPlayers(data, p.spin, config);
      const player = pool.find((pl) => pl.id === p.playerId);
      const higher = pool.filter((pl) => pl.score > p.score).length;
      const tier: GridTier = higher === 0 ? 'green' : higher < 3 ? 'yellow' : 'gray';
      const slot = config.slots.find((s) => s.id === p.slotId);
      return {
        slotLabel: slot?.label ?? p.slotId,
        franchiseId: p.spin.franchise,
        decade: p.spin.decade,
        playerName: p.playerName,
        tier,
        stats: player ? statCells(player, config) : [],
      };
    });
    return { roster, rating: rosterRating(data, config, picks, mode.type) };
  }, [picks, data, config, mode.type]);

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
      <ResultBoard
        sport={config.sport}
        games={config.games}
        tank={tank}
        wins={result.wins}
        rating={rating.rating}
        grade={rating.grade}
        tier={rating.tier}
        totalStats={config.totalStats}
        roster={roster}
      />

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
