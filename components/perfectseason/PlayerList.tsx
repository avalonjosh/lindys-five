'use client';

import { useMemo, useState } from 'react';
import type { Player, SlotDef, SportConfig } from '@/lib/perfectseason/types';
import { statCells } from './ui';

interface PlayerListProps {
  players: Player[];
  config: SportConfig;
  topScore: number;
  top3Score: number;
  blind: boolean;
  /** The legal, finishable slots for a player (drives the assign buttons). */
  getLegalSlots: (player: Player) => SlotDef[];
  onAssign: (playerId: string, slotId: string) => void;
}

/**
 * The sorted pick list with a search box and position filters. Each row shows
 * the player and the slot buttons they can fill; tapping a slot assigns them
 * directly. In blind mode the stats and score are hidden.
 */
export default function PlayerList({
  players,
  config,
  topScore,
  top3Score,
  blind,
  getLegalSlots,
  onAssign,
}: PlayerListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  // Distinct slot labels (C, IF, OF, SP) for the filter chips.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const s of config.slots) if (!seen.includes(s.label)) seen.push(s.label);
    return ['All', ...seen];
  }, [config.slots]);

  const matchesCategory = (player: Player, label: string): boolean => {
    if (label === 'All') return true;
    return config.slots.some((s) => s.label === label && s.accepts.some((p) => player.pos.includes(p)));
  };

  const shown = players.filter(
    (p) => matchesCategory(p, filter) && p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players..."
        className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-sabres-blue"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {categories.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilter(label)}
            className={[
              'rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors',
              filter === label
                ? 'border-sabres-blue bg-sabres-blue text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-2 flex flex-col gap-1.5" role="listbox" aria-label="Available players">
        {shown.map((player) => {
          const dot = player.score >= topScore ? 'bg-emerald-500' : player.score >= top3Score ? 'bg-amber-400' : 'bg-gray-300';
          // One assign button per distinct slot label the player can fill.
          const legal = getLegalSlots(player);
          const buttons: { label: string; slotId: string }[] = [];
          for (const slot of legal) {
            if (!buttons.some((b) => b.label === slot.label)) buttons.push({ label: slot.label, slotId: slot.id });
          }
          return (
            <li key={player.id} className="rounded-2xl border-2 border-gray-200 bg-white p-2.5 shadow-sm">
              <div className="flex items-start gap-2">
                {!blind && <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-gray-900">{player.name}</span>
                    {player.pos.map((p) => (
                      <span key={p} className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-bold uppercase text-gray-500">
                        {p}
                      </span>
                    ))}
                  </div>
                  {!blind && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {statCells(player, config).map((cell) => (
                        <span key={cell.label} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          <span className="font-bold text-gray-800">{cell.value}</span>{' '}
                          <span className="uppercase tracking-wide">{cell.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {!blind && (
                  <span
                    className="shrink-0 rounded-xl bg-gradient-to-br from-sabres-navy to-sabres-blue px-2.5 py-1.5 text-base font-bold text-white shadow-sm"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {player.score.toFixed(0)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                {buttons.map((b) => (
                  <button
                    key={b.slotId}
                    type="button"
                    onClick={() => onAssign(player.id, b.slotId)}
                    className="min-h-[36px] rounded-lg border-2 border-sabres-blue bg-sabres-blue/5 px-4 text-xs font-bold uppercase tracking-wide text-sabres-blue transition-colors hover:bg-sabres-blue hover:text-white"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-400">No players match.</li>
        )}
      </ul>
    </div>
  );
}
