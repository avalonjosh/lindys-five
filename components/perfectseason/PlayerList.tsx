'use client';

import { useMemo, useState } from 'react';
import type { Player, SlotDef, SportConfig } from '@/lib/perfectseason/types';
import { statCells } from './ui';

interface PlayerListProps {
  players: Player[];
  config: SportConfig;
  blind: boolean;
  /** Slot labels still open; filled-position filter chips grey out. */
  openCategories: Set<string>;
  /** The legal, finishable slots for a player (drives the assign buttons). */
  getLegalSlots: (player: Player) => SlotDef[];
  onAssign: (playerId: string, slotId: string) => void;
}

// Stats highlighted as the headline (the quality signal) per player kind.
const HEADLINE = new Set(['OPS', 'ERA']);

const ROW_BASE = 'flex items-center gap-2.5 rounded-xl border-2 border-gray-200 bg-white p-2.5 shadow-sm transition-all';
const ASSIGN_BTN =
  'min-h-[34px] min-w-[42px] rounded-lg border-2 border-sabres-blue bg-sabres-blue/5 px-2 text-xs font-bold uppercase tracking-wide text-sabres-blue transition-colors hover:bg-sabres-blue hover:text-white';

/**
 * The sorted pick list with a search box and position filters. A single-position
 * player can be rostered by tapping the whole row; a multi-position player must
 * tap one of the position buttons so the slot is unambiguous. Blind mode hides
 * the stat line.
 */
export default function PlayerList({ players, config, blind, openCategories, getLegalSlots, onAssign }: PlayerListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

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
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-sabres-blue focus:bg-white"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {categories.map((label) => {
          const closed = label !== 'All' && !openCategories.has(label); // position already filled
          return (
            <button
              key={label}
              type="button"
              disabled={closed}
              onClick={() => !closed && setFilter(label)}
              className={[
                'rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors',
                closed
                  ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                  : filter === label
                    ? 'border-sabres-blue bg-sabres-blue text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-col gap-2" role="listbox" aria-label="Available players">
        {shown.map((player) => {
          // One assign target per distinct slot label the player can fill.
          const legal = getLegalSlots(player);
          const targets: { label: string; slotId: string }[] = [];
          for (const slot of legal) {
            if (!targets.some((b) => b.label === slot.label)) targets.push({ label: slot.label, slotId: slot.id });
          }
          const multi = targets.length > 1;

          const info = (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-gray-900">{player.name}</div>
              {!blind && (
                <div className="mt-0.5 truncate text-[11px] text-gray-400">
                  {statCells(player, config).map((cell, i) => (
                    <span key={cell.label}>
                      {i > 0 && <span className="text-gray-300"> · </span>}
                      <span className={HEADLINE.has(cell.label) ? 'font-bold text-sabres-blue' : 'font-semibold text-gray-700'}>
                        {cell.value}
                      </span>{' '}
                      <span className="uppercase tracking-wide">{cell.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );

          // No open slot for any of this player's positions: shown greyed, not pickable.
          if (targets.length === 0) {
            return (
              <li key={player.id} className={`${ROW_BASE} opacity-50`}>
                {info}
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-400">No open slots</span>
              </li>
            );
          }

          // Multi-position: the row is not tappable; the player must choose a spot.
          if (multi) {
            return (
              <li key={player.id} className={ROW_BASE}>
                {info}
                <div className="flex shrink-0 gap-1">
                  {targets.map((b) => (
                    <button key={b.slotId} type="button" onClick={() => onAssign(player.id, b.slotId)} className={ASSIGN_BTN}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          }

          // Single position: tapping the whole row assigns to it.
          const only = targets[0];
          return (
            <li key={player.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onAssign(player.id, only.slotId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAssign(player.id, only.slotId);
                  }
                }}
                className={`${ROW_BASE} cursor-pointer hover:border-sabres-blue hover:shadow-md active:scale-[0.99]`}
              >
                {info}
                <span className="shrink-0 rounded-lg bg-sabres-blue/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-sabres-blue">
                  {only.label}
                </span>
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-gray-400">No players match.</li>}
      </ul>
    </div>
  );
}
