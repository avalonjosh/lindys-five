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
import RosterList from './RosterList';
import SpinReveal from './SpinReveal';
import PlayerList from './PlayerList';
import ResultCard from './ResultCard';
import HowToPlay from './HowToPlay';

const data = mlbDataJson as unknown as GameData;
const config = mlbConfig;

function freshGame(mode: ModeDescriptor): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const schedule = generateDay(data, config, easternDateString(), mulberry32(seed));
  return createGame(data, config, schedule.rounds, mode);
}

export default function PlayClient() {
  const mode = useMemo<ModeDescriptor>(() => ({ type: 'standard', source: 'free' }), []);
  // Generated on the client only: the schedule is random, so building it during
  // SSR would mismatch hydration. Null until mounted.
  const [state, setState] = useState<EngineState | null>(null);
  const [spun, setSpun] = useState(false);
  const [undo, setUndo] = useState(false);

  useEffect(() => {
    setState(freshGame(mode));
  }, [mode]);

  const dispatch = useCallback((a: Action) => setState((s) => (s ? reduce(s, a) : s)), []);

  // A new round always starts unspun, so the SPIN button returns.
  const roundKey = state && !state.done ? state.round : -1;
  useEffect(() => {
    setSpun(false);
  }, [roundKey]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(false), 4000);
    return () => clearTimeout(t);
  }, [undo]);

  const commitAssign = useCallback((id: string, slotId: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setSpun(false);
    setState((s) => (s ? reduce(reduce(s, { type: 'SELECT_PLAYER', id }), { type: 'ASSIGN_SLOT', slotId }) : s));
    setUndo(true);
  }, []);

  const newGame = useCallback(() => {
    setUndo(false);
    setSpun(false);
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
  const players = spun ? availablePlayers(state) : [];
  const poolScores = players.map((p) => p.score).sort((a, b) => b - a);
  const topScore = poolScores[0] ?? 100;
  const top3Score = poolScores[2] ?? poolScores[poolScores.length - 1] ?? 0;
  const fillableSlotIds = new Set(players.flatMap((p) => legalSlots(state, p).map((s) => s.id)));
  const spinKey = `${state.round}:${state.curTeamUsed ? 'T' : ''}${state.curDecadeUsed ? 'D' : ''}:${state.firstSkip ?? ''}`;

  return (
    <Shell>
      {/* Variant toggle, always on the board (Blind ships in a later phase). */}
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border-2 border-gray-200 bg-white p-1 shadow-sm">
        <span className="rounded-lg bg-sabres-blue py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
          Classic
        </span>
        <span className="rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide text-gray-300">
          Blind · soon
        </span>
      </div>

      {/* Spin board. */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
        <SpinReveal
          data={data}
          spin={spin}
          revealed={spun}
          revealKey={spinKey}
          round={state.round}
          totalRounds={config.slots.length}
        />

        {!spun ? (
          <button
            type="button"
            onClick={() => setSpun(true)}
            className="mt-4 w-full rounded-xl bg-sabres-gold py-4 text-lg font-bold uppercase tracking-widest text-sabres-navy shadow-md transition-transform hover:scale-[1.02] active:scale-100"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Spin
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canSkipTeam(state)}
              onClick={() => dispatch({ type: 'SKIP_TEAM' })}
              className="rounded-xl border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue enabled:hover:text-sabres-blue"
            >
              Skip Team {state.teamSkipAvail ? '· 1' : '· 0'}
            </button>
            <button
              type="button"
              disabled={!canSkipDecade(state)}
              onClick={() => dispatch({ type: 'SKIP_DECADE' })}
              className="rounded-xl border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue enabled:hover:text-sabres-blue"
            >
              Skip Decade {state.decadeSkipAvail ? '· 1' : '· 0'}
            </button>
          </div>
        )}
      </div>

      {/* Roster. */}
      <div className="mt-3 rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-md">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Your Roster</p>
        <RosterList slots={config.slots} picks={state.picks} data={data} fillableSlotIds={fillableSlotIds} />
      </div>

      {/* Pick list (after the spin). */}
      {spun && (
        <div className="mt-3 pb-24">
          <PlayerList
            players={players}
            config={config}
            topScore={topScore}
            top3Score={top3Score}
            blind={false}
            getLegalSlots={(p) => legalSlots(state, p)}
            onAssign={commitAssign}
          />
        </div>
      )}

      <div className="mt-3">
        <HowToPlay />
      </div>

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b-4 shadow-xl" style={{ background: '#002D72', borderBottomColor: '#041E42' }}>
        <div className="mx-auto max-w-[480px] px-4 py-3 text-center">
          <Link href="/162-0" className="block transition-opacity hover:opacity-90">
            <p className="text-4xl font-bold tracking-wider text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </p>
          </Link>
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white/80">
            <span>162-0</span>
            <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" className="h-4 w-auto" />
          </div>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/50">Free Play</p>
        </div>
      </header>
      <main className="mx-auto max-w-[480px] px-3 py-4">{children}</main>
    </div>
  );
}
