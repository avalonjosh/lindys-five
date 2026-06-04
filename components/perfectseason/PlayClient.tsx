'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import mlbDataJson from '@/data/mlb-data.json';
import type { GameData, ModeDescriptor } from '@/lib/perfectseason/types';
import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import { generateDay } from '@/lib/perfectseason/schedule';
import { mulberry32, easternDateString } from '@/lib/perfectseason/seed';
import {
  canSkipDecade,
  canSkipTeam,
  createGame,
  currentSpin,
  legalSlots,
  openSlots,
  reduce,
  spinPlayers,
  type Action,
  type EngineState,
} from '@/lib/perfectseason/engine';
import RosterList from './RosterList';
import SpinReveal from './SpinReveal';
import PlayerList from './PlayerList';
import ResultCard from './ResultCard';
import HowToPlay from './HowToPlay';
import { franchiseLogo, franchiseName } from './ui';
import Decade from './Decade';

const data = mlbDataJson as unknown as GameData;
const config = mlbConfig;
const ROLL_TOTAL_MS = 1750; // SpinReveal lands the franchise at ~1.25s, then rest 0.5s on the result
// Resting preview on the first board so it is not empty dashes. Iconic and on-brand.
const DEFAULT_SPIN = { decade: '1950s', franchise: 'NYY' };

type Phase = 'board' | 'rolling' | 'pick';

function freshGame(mode: ModeDescriptor): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const schedule = generateDay(data, config, easternDateString(), mulberry32(seed));
  return createGame(data, config, schedule.rounds, mode);
}

export default function PlayClient() {
  const mode = useMemo<ModeDescriptor>(() => ({ type: 'standard', source: 'free' }), []);
  // Generated on the client only: random schedule, so SSR would mismatch.
  const [state, setState] = useState<EngineState | null>(null);
  const [phase, setPhase] = useState<Phase>('board');
  const [undo, setUndo] = useState(false);

  useEffect(() => {
    setState(freshGame(mode));
  }, [mode]);

  const dispatch = useCallback((a: Action) => setState((s) => (s ? reduce(s, a) : s)), []);

  const spinKey =
    !state || state.done
      ? 'idle'
      : `${state.round}:${state.curTeamUsed ? 'T' : ''}${state.curDecadeUsed ? 'D' : ''}:${state.firstSkip ?? ''}`;

  // Once the reels finish, switch to the pick view. A skip mid-roll restarts it.
  useEffect(() => {
    if (phase !== 'rolling') return;
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPhase('pick'), reduceMotion ? 0 : ROLL_TOTAL_MS);
    return () => clearTimeout(t);
  }, [phase, spinKey]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(false), 4000);
    return () => clearTimeout(t);
  }, [undo]);

  const commitAssign = useCallback((id: string, slotId: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setPhase('board');
    setState((s) => (s ? reduce(reduce(s, { type: 'SELECT_PLAYER', id }), { type: 'ASSIGN_SLOT', slotId }) : s));
    setUndo(true);
  }, []);

  const onSkip = (a: Action) => {
    dispatch(a);
    setPhase('rolling');
  };

  const newGame = useCallback(() => {
    setUndo(false);
    setPhase('board');
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
        <ResultCard result={state.result} config={config} mode={mode} picks={state.picks} data={data} onPlayAgain={newGame} />
      </Shell>
    );
  }

  const spin = currentSpin(state);
  const picking = phase === 'pick';
  const players = picking ? spinPlayers(state) : [];
  const openCategories = new Set(openSlots(state).map((s) => s.label));
  const filled = state.picks.length;
  const total = config.slots.length;

  return (
    <Shell>
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
        {phase !== 'pick' ? (
          <>
            <SpinReveal
              data={data}
              spin={spin}
              rolling={phase === 'rolling'}
              previousSpin={state.picks.length > 0 ? state.picks[state.picks.length - 1].spin : null}
              defaultSpin={DEFAULT_SPIN}
              revealKey={spinKey}
              round={state.round}
              totalRounds={total}
            />

            {phase === 'board' && (
              <>
                <button
                  type="button"
                  onClick={() => setPhase('rolling')}
                  className="mt-4 w-full rounded-xl bg-sabres-blue py-4 text-lg font-bold uppercase tracking-widest text-white shadow-md transition-all hover:scale-[1.02] hover:bg-sabres-light active:scale-100"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Spin
                </button>

                <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                  <span className="rounded-lg bg-white py-2 text-center text-xs font-bold uppercase tracking-wide text-sabres-blue shadow-sm">
                    Classic
                  </span>
                  <span className="py-2 text-center text-xs font-bold uppercase tracking-wide text-gray-400">Blind · soon</span>
                </div>

                <div className="my-4 border-t border-gray-100" />
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Your Roster · {filled}/{total}
                </p>
                <RosterList slots={config.slots} picks={state.picks} data={data} fillableSlotIds={new Set()} />
              </>
            )}
          </>
        ) : (
          <>
            {/* Focused pick view: roster hidden, only the available players. */}
            <div className="border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                {franchiseLogo(spin.franchise) && (
                  <img src={franchiseLogo(spin.franchise)!} alt="" className="h-7 w-auto shrink-0" />
                )}
                <p className="text-xl font-bold text-sabres-blue" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  <Decade value={spin.decade} /> · {franchiseName(data, spin)}
                </p>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {players.length} available · pick one to assign · {filled}/{total} filled
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canSkipTeam(state)}
                onClick={() => onSkip({ type: 'SKIP_TEAM' })}
                className="rounded-xl border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue enabled:hover:text-sabres-blue"
              >
                Skip Team {state.teamSkipAvail ? '· 1' : '· 0'}
              </button>
              <button
                type="button"
                disabled={!canSkipDecade(state)}
                onClick={() => onSkip({ type: 'SKIP_DECADE' })}
                className="rounded-xl border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue enabled:hover:text-sabres-blue"
              >
                Skip Decade {state.decadeSkipAvail ? '· 1' : '· 0'}
              </button>
            </div>

            <div className="mt-3 pb-2">
              <PlayerList
                players={players}
                config={config}
                blind={false}
                openCategories={openCategories}
                getLegalSlots={(p) => legalSlots(state, p)}
                onAssign={commitAssign}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-3">
        <HowToPlay />
      </div>

      <div className="h-20" />

      {undo && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="flex w-full max-w-[480px] items-center justify-between rounded-xl bg-sabres-navy px-4 py-3 text-white shadow-xl">
            <span className="text-sm font-semibold">Pick added</span>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'UNDO' });
                setUndo(false);
                setPhase('pick');
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
