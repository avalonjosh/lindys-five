'use client';

import type { Player, SportConfig } from '@/lib/perfectseason/types';
import { statCells } from './ui';

interface PlayerListProps {
  players: Player[];
  config: SportConfig;
  selectedId: string | null;
  /** Top score and third-best score in this pool, for green/yellow dots. */
  topScore: number;
  top3Score: number;
  onSelect: (id: string) => void;
}

/**
 * The sorted pick list. Full-row tap target, max four stats on mobile. The
 * left rail dot mirrors the share grid (green = top option, yellow = top three).
 */
export default function PlayerList({
  players,
  config,
  selectedId,
  topScore,
  top3Score,
  onSelect,
}: PlayerListProps) {
  return (
    <ul className="flex flex-col gap-1.5" role="listbox" aria-label="Available players">
      {players.map((player) => {
        const selected = player.id === selectedId;
        const dot = player.score >= topScore ? 'bg-emerald-500' : player.score >= top3Score ? 'bg-amber-400' : 'bg-gray-300';
        return (
          <li key={player.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(player.id)}
              className={[
                'flex w-full items-center gap-2 rounded-2xl border-2 px-2.5 min-h-[56px] text-left transition-all',
                selected
                  ? 'border-sabres-blue bg-sabres-blue/5 shadow-lg'
                  : 'border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md',
              ].join(' ')}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-gray-900">{player.name}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {player.pos.join('/')}
                  </span>
                </span>
                <span className="mt-0.5 flex gap-2.5">
                  {statCells(player, config).map((cell) => (
                    <span key={cell.label} className="text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-700">{cell.value}</span>{' '}
                      <span className="uppercase tracking-wide">{cell.label}</span>
                    </span>
                  ))}
                </span>
              </span>
              <span
                className="shrink-0 rounded-xl bg-gradient-to-br from-sabres-navy to-sabres-blue px-2.5 py-1.5 text-base font-bold text-white shadow-sm"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                {player.score.toFixed(0)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
