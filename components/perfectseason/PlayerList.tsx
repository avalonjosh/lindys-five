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

// Stats highlighted as the headline (the quality signal) per player kind.
const HEADLINE = new Set(['OPS', 'ERA']);

/**
 * The sorted pick list with a search box and position filters. Each row shows
 * the player, a clean stat line, a quality score, and the slot buttons they can
 * fill; tapping a slot assigns them. In blind mode stats and score are hidden.
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

      <ul className="mt-3 flex flex-col gap-2" role="listbox" aria-label="Available players">
        {shown.map((player) => {
          const dot = player.score >= topScore ? 'bg-emerald-500' : player.score >= top3Score ? 'bg-amber-400' : 'bg-gray-300';
          // One assign target per distinct slot label the player can fill.
          const legal = getLegalSlots(player);
          const targets: { label: string; slotId: string }[] = [];
          for (const slot of legal) {
            if (!targets.some((b) => b.label === slot.label)) targets.push({ label: slot.label, slotId: slot.id });
          }
          if (targets.length === 0) return null;
          const primary = targets[0];
          const multi = targets.length > 1;
          return (
            <li key={player.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onAssign(player.id, primary.slotId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAssign(player.id, primary.slotId);
                  }
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border-2 border-gray-200 bg-white p-2.5 shadow-sm transition-all hover:border-sabres-blue hover:shadow-md active:scale-[0.99]"
              >
                {!blind && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />}
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

                {/* Single position: a label showing where the tap assigns. Multi: pick a spot. */}
                {multi ? (
                  <div className="flex shrink-0 flex-col gap-1">
                    {targets.map((b) => (
                      <button
                        key={b.slotId}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssign(player.id, b.slotId);
                        }}
                        className="min-h-[30px] min-w-[42px] rounded-lg border-2 border-sabres-blue bg-sabres-blue/5 px-2 text-xs font-bold uppercase tracking-wide text-sabres-blue transition-colors hover:bg-sabres-blue hover:text-white"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="shrink-0 rounded-lg bg-sabres-blue/10 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-sabres-blue">
                    {primary.label}
                  </span>
                )}
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-gray-400">No players match.</li>}
      </ul>
    </div>
  );
}
