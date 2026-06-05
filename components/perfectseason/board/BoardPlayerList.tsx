'use client';

import { useMemo, useState } from 'react';
import type { Player, SlotDef, SportConfig } from '@/lib/perfectseason/types';
import { posTint, statCells } from '../ui';

interface BoardPlayerListProps {
  players: Player[];
  config: SportConfig;
  blind: boolean;
  selectedId: string | null;
  getLegalSlots: (player: Player) => SlotDef[];
  onSelect: (player: Player) => void;
}

export default function BoardPlayerList({ players, config, blind, selectedId, getLegalSlots, onSelect }: BoardPlayerListProps) {
  const GROUPS = config.positionGroups;
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [sortBy, setSortBy] = useState('Best'); // Best = engine order
  const [sortOpen, setSortOpen] = useState(false);

  const statKeys = useMemo(() => {
    // Union of stat labels across player kinds, in first-seen order.
    const seen: string[] = [];
    for (const p of players.slice(0, 30)) for (const c of statCells(p, config)) if (!seen.includes(c.label)) seen.push(c.label);
    return seen;
  }, [players, config]);

  const matchesGroup = (p: Player): boolean => {
    const g = GROUPS.find((x) => x.key === group);
    return !g?.accepts || p.pos.some((pos) => g.accepts!.includes(pos));
  };

  let shown = players.filter((p) => matchesGroup(p) && p.name.toLowerCase().includes(query.trim().toLowerCase()));
  if (!blind && sortBy !== 'Best') {
    shown = [...shown].sort((a, b) => {
      const av = Number(String(statCells(a, config).find((c) => c.label === sortBy)?.value ?? 0).replace(/[^\d.-]/g, ''));
      const bv = Number(String(statCells(b, config).find((c) => c.label === sortBy)?.value ?? 0).replace(/[^\d.-]/g, ''));
      return bv - av;
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players..."
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-sabres-blue focus:bg-white"
        />
        {!blind && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSortOpen((o) => !o)}
              className="flex h-full items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold uppercase text-gray-600 outline-none"
            >
              {sortBy}
              <span className={`text-[8px] transition-transform ${sortOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {sortOpen && (
              <>
                <button type="button" aria-label="Close sort menu" onClick={() => setSortOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="absolute right-0 top-full z-20 mt-1 w-28 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                  {['Best', ...statKeys].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setSortBy(k);
                        setSortOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-xs font-bold uppercase ${
                        sortBy === k ? 'bg-sabres-blue/10 text-sabres-blue' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {GROUPS.map((gr) => (
          <button
            key={gr.key}
            type="button"
            onClick={() => setGroup(gr.key)}
            className={[
              'rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors',
              group === gr.key ? 'border-sabres-blue bg-sabres-blue text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
            ].join(' ')}
          >
            {gr.key}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-gray-500">{shown.length} available</p>

      <ul className="mt-1 flex flex-col gap-1.5" role="listbox" aria-label="Available players">
        {shown.map((player) => {
          const legal = getLegalSlots(player);
          const blocked = legal.length === 0;
          const selected = player.id === selectedId;
          const cells = statCells(player, config);
          return (
            <li key={`${player.id}-${'era' in player.line ? 'p' : 'b'}`}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => onSelect(player)}
                className={[
                  'flex w-full items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all',
                  blocked
                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50'
                    : selected
                      ? 'border-sabres-blue bg-sabres-blue/5 shadow-md'
                      : 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 hover:border-sabres-blue hover:shadow-md',
                ].join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight text-gray-900">{player.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {player.pos.map((p) => (
                      <span key={p} className={`rounded px-1 text-[10px] font-bold uppercase ${posTint(p)}`}>
                        {p}
                      </span>
                    ))}
                    {blocked && <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">No open slots</span>}
                  </div>
                </div>
                {!blind && (
                  <div className="flex shrink-0 gap-2.5">
                    {cells.map((cell) => (
                      <div key={cell.label} className="w-9 text-center">
                        <div className="text-sm font-bold text-gray-800">{cell.value}</div>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{cell.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-gray-400">No players match.</li>}
      </ul>
    </div>
  );
}
