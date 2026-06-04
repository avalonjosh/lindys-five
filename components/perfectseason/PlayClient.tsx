'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import mlbDataJson from '@/data/mlb-data.json';
import type { GameData, ModeDescriptor } from '@/lib/perfectseason/types';
import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import { generateDay } from '@/lib/perfectseason/schedule';
import { mulberry32, easternDateString } from '@/lib/perfectseason/seed';
import {
  availablePlayers,
  canSkipDecade,
  canSkipTeam,
  createGame,
  currentSpin,
  legalSlots,
  reduce,
  type Action,
  type EngineState,
} from '@/lib/perfectseason/engine';
import RosterStrip from './RosterStrip';
import SpinReveal from './SpinReveal';
import PlayerList from './PlayerList';
import ResultCard from './ResultCard';

const data = mlbDataJson as unknown as GameData;
const config = mlbConfig;

function freshGame(mode: ModeDescriptor): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const date = easternDateString();
  const schedule = generateDay(data, config, date, mulberry32(seed));
  return createGame(data, config, schedule.rounds, mode);
}

export default function PlayClient() {
  const mode = useMemo<ModeDescriptor>(() => ({ type: 'standard', source: 'free' }), []);
  // Generated on the client only: the schedule is random, so building it during
  // SSR would mismatch hydration. Null until mounted.
  const [state, setState] = useState<EngineState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [undo, setUndo] = useState(false);

  useEffect(() => {
    setState(freshGame(mode));
  }, [mode]);

  const dispatch = useCallback((a: Action) => setState((s) => (s ? reduce(s, a) : s)), []);

  const spinKey =
    !state || state.done
      ? 'idle'
      : `${state.round}:${state.curTeamUsed ? 'T' : ''}${state.curDecadeUsed ? 'D' : ''}:${state.firstSkip ?? ''}`;

  // Play the spin reveal, then surface the pick list a beat later. Keyed on the
  // spin only, so selecting a player does not re-hide the list.
  useEffect(() => {
    if (spinKey === 'idle') return;
    setRevealed(false);
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setRevealed(true), reduceMotion ? 0 : 700);
    return () => clearTimeout(t);
  }, [spinKey]);

  // Auto-dismiss the undo toast after four seconds.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(false), 4000);
    return () => clearTimeout(t);
  }, [undo]);

  const commitAssign = useCallback((id: string, slotId: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setState((s) => (s ? reduce(reduce(s, { type: 'SELECT_PLAYER', id }), { type: 'ASSIGN_SLOT', slotId }) : s));
    setUndo(true);
  }, []);

  const newGame = useCallback(() => {
    setUndo(false);
    setState(freshGame(mode));
  }, [mode]);

  if (!state) {
    return (
      <Shell>
        <div className="py-20 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">
          Shuffling the all-time pools...
        </div>
      </Shell>
    );
  }

  const players = state.done ? [] : availablePlayers(state);
  const poolScores = players.map((p) => p.score).sort((a, b) => b - a);
  const topScore = poolScores[0] ?? 100;
  const top3Score = poolScores[2] ?? poolScores[poolScores.length - 1] ?? 0;

  const selectedPlayer = state.selectedId ? players.find((p) => p.id === state.selectedId) ?? null : null;
  const legals = selectedPlayer ? legalSlots(state, selectedPlayer) : [];
  const legalIds = new Set(legals.map((s) => s.id));

  const onSelect = (id: string) => {
    const player = players.find((p) => p.id === id);
    if (!player) return;
    const ls = legalSlots(state, player);
    if (ls.length === 1) commitAssign(id, ls[0].id);
    else dispatch({ type: 'SELECT_PLAYER', id });
  };

  if (state.done && state.result) {
    return (
      <Shell>
        <ResultCard
          result={state.result}
          config={config}
          mode={mode}
          picks={state.picks}
          data={data}
          onPlayAgain={newGame}
        />
      </Shell>
    );
  }

  const spin = currentSpin(state);
  const teamSkipOpen = canSkipTeam(state);
  const decadeSkipOpen = canSkipDecade(state);

  return (
    <Shell>
      <RosterStrip
        slots={config.slots}
        roster={state.roster}
        legalSlotIds={legalIds}
        selecting={!!selectedPlayer}
        onAssign={(slotId) => state.selectedId && commitAssign(state.selectedId, slotId)}
      />

      <div className="mt-4">
        <SpinReveal data={data} spin={spin} revealKey={spinKey} round={state.round} totalRounds={config.slots.length} />
      </div>

      {revealed && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!teamSkipOpen}
              onClick={() => dispatch({ type: 'SKIP_TEAM' })}
              className="rounded-lg border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue"
            >
              Skip Team {state.teamSkipAvail ? '· 1' : '· 0'}
            </button>
            <button
              type="button"
              disabled={!decadeSkipOpen}
              onClick={() => dispatch({ type: 'SKIP_DECADE' })}
              className="rounded-lg border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue"
            >
              Skip Decade {state.decadeSkipAvail ? '· 1' : '· 0'}
            </button>
          </div>

          {selectedPlayer && legals.length > 1 && (
            <div className="mt-3 rounded-lg bg-sabres-gold/15 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-sabres-navy">
              Tap a highlighted slot above for {selectedPlayer.name.split(' ').slice(-1)[0]}
            </div>
          )}

          <div className="mt-3 pb-24">
            <PlayerList
              players={players}
              config={config}
              selectedId={state.selectedId}
              topScore={topScore}
              top3Score={top3Score}
              onSelect={onSelect}
            />
          </div>
        </>
      )}

      {undo && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="flex w-full max-w-[480px] items-center justify-between rounded-xl bg-sabres-navy px-4 py-3 text-white shadow-xl">
            <span className="text-sm font-semibold">Pick added</span>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'UNDO' });
                setUndo(false);
              }}
              className="text-sm font-bold uppercase tracking-wide text-sabres-gold"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-sabres-navy px-4 py-3">
        <div className="mx-auto flex max-w-[480px] items-center justify-between">
          <Link href="/162-0" className="text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            162-0 <span className="text-sabres-gold">⚾</span>
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Free Play</span>
        </div>
      </header>
      <main className="mx-auto max-w-[480px] px-3 pt-3">{children}</main>
    </div>
  );
}
