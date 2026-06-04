'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import mlbDataJson from '@/data/mlb-data.json';
import scheduleJson from '@/data/mlb-daily-schedule.json';
import type { GameData, ModeDescriptor, ModeType, RoundTree } from '@/lib/perfectseason/types';
import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import { generateDay, generateFranchiseDay, poolPlayers } from '@/lib/perfectseason/schedule';
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
import {
  getDaily,
  getStats,
  getStreak,
  recordDaily,
  type DailyRecord,
  type GridCell,
  type GridTier,
} from '@/lib/perfectseason/storage';
import RosterList from './RosterList';
import SpinReveal from './SpinReveal';
import PlayerList from './PlayerList';
import ResultCard from './ResultCard';
import DailyResult from './DailyResult';
import FranchisePicker from './FranchisePicker';
import HowToPlay from './HowToPlay';
import { franchiseLogo, franchiseName } from './ui';
import Decade from './Decade';

const data = mlbDataJson as unknown as GameData;
const schedule = scheduleJson as unknown as { days: Record<string, { dayNumber: number; rounds: RoundTree[] }> };
const config = mlbConfig;
const ROLL_TOTAL_MS = 1750;
const DEFAULT_SPIN = { decade: '1950s', franchise: 'NYY' };

type Phase = 'board' | 'rolling' | 'pick';
type Source = 'daily' | 'free';
type FreeType = 'standard' | 'tank' | 'franchise';

function randomGame(type: 'standard' | 'tank'): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const sched = generateDay(data, config, easternDateString(), mulberry32(seed));
  return createGame(data, config, sched.rounds, { type, source: 'free' });
}

function franchiseGame(franchiseId: string): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const sched = generateFranchiseDay(data, config, franchiseId, mulberry32(seed));
  return createGame(data, config, sched.rounds, { type: 'franchise', source: 'free', franchiseId });
}

function dailyToday(): { state: EngineState; dayNumber: number; date: string } | null {
  const date = easternDateString();
  const day = schedule.days[date];
  if (!day) return null;
  return { state: createGame(data, config, day.rounds, { type: 'standard', source: 'daily' }), dayNumber: day.dayNumber, date };
}

function buildDailyRecord(state: EngineState, dayNumber: number): DailyRecord {
  const r = state.result!;
  const grid: GridCell[] = state.picks.map((p) => {
    const pool = poolPlayers(data, p.spin, config);
    const higher = pool.filter((pl) => pl.score > p.score).length;
    const tier: GridTier = higher === 0 ? 'green' : higher < 3 ? 'yellow' : 'gray';
    const slot = config.slots.find((s) => s.id === p.slotId);
    return {
      slot: slot?.label ?? p.slotId,
      decade: p.spin.decade,
      franchise: franchiseName(data, p.spin),
      tier,
      skipped: p.skips.team || p.skips.decade,
    };
  });
  return {
    done: true,
    dayNumber,
    wins: r.wins,
    losses: r.losses,
    setsWon: r.setsWon,
    totalSets: r.totalSets,
    perfectSets: r.perfectSets,
    verdict: r.verdict,
    grid,
    skips: { team: state.picks.some((p) => p.skips.team), decade: state.picks.some((p) => p.skips.decade) },
  };
}

export default function PlayClient() {
  const [source, setSource] = useState<Source>('daily');
  const [freeType, setFreeType] = useState<FreeType>('standard');
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [phase, setPhase] = useState<Phase>('board');
  const [undo, setUndo] = useState(false);
  const [day, setDay] = useState<{ dayNumber: number; date: string } | null>(null);
  const [record, setRecord] = useState<DailyRecord | null>(null);

  const type: ModeType = source === 'daily' ? 'standard' : freeType;
  const mode = useMemo<ModeDescriptor>(
    () => ({ type, source, franchiseId: type === 'franchise' ? franchiseId ?? undefined : undefined }),
    [type, source, franchiseId],
  );

  // Initialize / re-initialize when the mode changes.
  useEffect(() => {
    setUndo(false);
    setPhase('board');
    if (source === 'daily') {
      const date = easternDateString();
      const existing = getDaily('mlb', date, 'classic');
      if (existing) {
        setRecord(existing);
        setDay({ dayNumber: existing.dayNumber, date });
        setState(null);
        return;
      }
      const dg = dailyToday();
      if (!dg) {
        setSource('free');
        return;
      }
      setRecord(null);
      setDay({ dayNumber: dg.dayNumber, date: dg.date });
      setState(dg.state);
      return;
    }
    // Free Play
    setRecord(null);
    setDay(null);
    if (freeType === 'franchise') {
      setState(franchiseId ? franchiseGame(franchiseId) : null);
      return;
    }
    setState(randomGame(freeType));
  }, [source, freeType, franchiseId]);

  // Lock and record a finished Daily once.
  useEffect(() => {
    if (source !== 'daily' || record || !state?.done || !state.result || !day) return;
    const rec = buildDailyRecord(state, day.dayNumber);
    recordDaily('mlb', day.date, 'classic', rec);
    setRecord(rec);
  }, [source, record, state, day]);

  const spinKey =
    !state || state.done
      ? 'idle'
      : `${state.round}:${state.curTeamUsed ? 'T' : ''}${state.curDecadeUsed ? 'D' : ''}:${state.firstSkip ?? ''}`;

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

  const dispatch = useCallback((a: Action) => setState((s) => (s ? reduce(s, a) : s)), []);

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
    if (freeType === 'franchise' && franchiseId) setState(franchiseGame(franchiseId));
    else if (freeType !== 'franchise') setState(randomGame(freeType));
  }, [freeType, franchiseId]);

  const chooseFreeType = (t: FreeType) => {
    setSource('free');
    setFreeType(t);
    if (t === 'franchise') setFranchiseId(null);
  };

  const shellProps = { source, freeType, onSource: setSource, onFreeType: chooseFreeType };

  // --- Daily result / lockout ---
  if (source === 'daily' && record) {
    return (
      <Shell {...shellProps}>
        <DailyResult
          record={record}
          config={config}
          streak={getStreak('mlb', 'classic')}
          played={getStats('mlb', 'classic').played}
          onPlayFree={() => chooseFreeType('standard')}
        />
      </Shell>
    );
  }

  // --- Franchise picker ---
  if (source === 'free' && freeType === 'franchise' && !franchiseId) {
    return (
      <Shell {...shellProps}>
        <FranchisePicker data={data} onPick={setFranchiseId} />
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell {...shellProps}>
        <div className="py-20 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">Loading...</div>
      </Shell>
    );
  }

  if (state.done && state.result) {
    if (source === 'free') {
      return (
        <Shell {...shellProps}>
          <ResultCard result={state.result} config={config} mode={mode} picks={state.picks} data={data} onPlayAgain={newGame} />
        </Shell>
      );
    }
    return (
      <Shell {...shellProps}>
        <div className="py-20 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">
          Scoring your season...
        </div>
      </Shell>
    );
  }

  const spin = currentSpin(state);
  const picking = phase === 'pick';
  const players = picking ? spinPlayers(state) : [];
  const openCategories = new Set(openSlots(state).map((s) => s.label));
  const filled = state.picks.length;
  const total = config.slots.length;
  const isFranchise = type === 'franchise';
  const isTank = type === 'tank';

  return (
    <Shell {...shellProps}>
      {(isTank || isFranchise) && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide ${
            isTank ? 'bg-sabres-red/10 text-sabres-red' : 'bg-sabres-blue/10 text-sabres-blue'
          }`}
        >
          {isTank ? 'Tank · build the WORST team, chase 0-162' : `Franchise · best all-time ${franchiseName(data, spin)}`}
        </div>
      )}

      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
        {phase !== 'pick' ? (
          <>
            <SpinReveal
              data={data}
              spin={spin}
              rolling={phase === 'rolling'}
              previousSpin={state.picks.length > 0 ? state.picks[state.picks.length - 1].spin : null}
              defaultSpin={isFranchise ? null : DEFAULT_SPIN}
              decadeOnly={isFranchise}
              revealKey={spinKey}
              round={state.round}
              totalRounds={total}
            />

            {phase === 'board' && (
              <>
                <button
                  type="button"
                  onClick={() => setPhase('rolling')}
                  className={`mt-4 w-full rounded-xl py-4 text-lg font-bold uppercase tracking-widest text-white shadow-md transition-all hover:scale-[1.02] active:scale-100 ${
                    isTank ? 'bg-sabres-red hover:brightness-110' : 'bg-sabres-blue hover:bg-sabres-light'
                  }`}
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Spin
                </button>

                {!isTank && !isFranchise && (
                  <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                    <span className="rounded-lg bg-white py-2 text-center text-xs font-bold uppercase tracking-wide text-sabres-blue shadow-sm">
                      Classic
                    </span>
                    <span className="py-2 text-center text-xs font-bold uppercase tracking-wide text-gray-400">Blind · soon</span>
                  </div>
                )}

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
                {players.length} available · {isTank ? 'pick a bad one' : 'pick one to assign'} · {filled}/{total} filled
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

function Shell({
  source,
  freeType,
  onSource,
  onFreeType,
  children,
}: {
  source: Source;
  freeType: FreeType;
  onSource: (s: Source) => void;
  onFreeType: (t: FreeType) => void;
  children: React.ReactNode;
}) {
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
        </div>
      </header>
      <main className="mx-auto max-w-[480px] px-3 py-4">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onSource('daily')}
            className={`rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide transition-colors ${
              source === 'daily' ? 'bg-sabres-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => onFreeType('standard')}
            className={`rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide transition-colors ${
              source === 'free' ? 'bg-sabres-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Free Play
          </button>
        </div>
        {source === 'free' && (
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-sm">
            {(['standard', 'tank', 'franchise'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onFreeType(t)}
                className={`rounded-lg py-1.5 text-center text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  freeType === t
                    ? t === 'tank'
                      ? 'bg-sabres-red text-white shadow-sm'
                      : 'bg-sabres-blue text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
