'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameData, ModeDescriptor, ModeType, RoundTree, Sport, Spin, SportConfig } from '@/lib/perfectseason/types';
import { generateDay, generateFranchiseDay, poolPlayers } from '@/lib/perfectseason/schedule';
import { mulberry32, easternDateString } from '@/lib/perfectseason/seed';
import { createGame, reduce, type Action, type EngineState } from '@/lib/perfectseason/engine';
import { getDaily, recordDaily, type DailyRecord, type GridCell, type GridTier } from '@/lib/perfectseason/storage';
import { rosterRating } from '@/lib/perfectseason/rating';
import { franchiseName, statCells } from './ui';

const ROLL_TOTAL_MS = 1750;

export type ScheduleJson = { days: Record<string, { dayNumber: number; rounds: RoundTree[] }> };
export type Phase = 'board' | 'rolling' | 'pick';
export type Source = 'daily' | 'free';
export type FreeType = 'standard' | 'tank' | 'franchise';
export type Variant = 'classic' | 'blind';

export interface GameProps {
  sport: Sport;
  data: GameData;
  config: SportConfig;
  schedule: ScheduleJson;
  /** The idle preview spin shown on the starting board (a real pool). */
  defaultSpin: Spin;
}

function randomGame(data: GameData, config: SportConfig, type: 'standard' | 'tank'): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const sched = generateDay(data, config, easternDateString(), mulberry32(seed));
  return createGame(data, config, sched.rounds, { type, source: 'free' });
}

function franchiseGame(data: GameData, config: SportConfig, franchiseId: string): EngineState {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const sched = generateFranchiseDay(data, config, franchiseId, mulberry32(seed));
  return createGame(data, config, sched.rounds, { type: 'franchise', source: 'free', franchiseId });
}

function dailyToday(
  data: GameData,
  config: SportConfig,
  schedule: ScheduleJson,
): { state: EngineState; dayNumber: number; date: string } | null {
  const date = easternDateString();
  const day = schedule.days[date];
  if (!day) return null;
  return {
    state: createGame(data, config, day.rounds, { type: 'standard', source: 'daily' }),
    dayNumber: day.dayNumber,
    date,
  };
}

export function buildDailyRecord(
  data: GameData,
  config: SportConfig,
  state: EngineState,
  dayNumber: number,
): DailyRecord {
  const r = state.result!;
  const grid: GridCell[] = state.picks.map((p) => {
    const pool = poolPlayers(data, p.spin, config);
    const higher = pool.filter((pl) => pl.score > p.score).length;
    const tier: GridTier = higher === 0 ? 'green' : higher < 3 ? 'yellow' : 'gray';
    const slot = config.slots.find((s) => s.id === p.slotId);
    const player = pool.find((pl) => pl.id === p.playerId);
    return {
      slot: slot?.label ?? p.slotId,
      decade: p.spin.decade,
      franchise: franchiseName(data, p.spin),
      franchiseId: p.spin.franchise,
      playerName: p.playerName,
      stats: player ? statCells(player, config) : [],
      tier,
      skipped: p.skips.team || p.skips.decade,
    };
  });
  const { rating, grade, tier } = rosterRating(data, config, state.picks, state.mode.type);
  return {
    done: true,
    dayNumber,
    wins: r.wins,
    losses: r.losses,
    setsWon: r.setsWon,
    totalSets: r.totalSets,
    perfectSets: r.perfectSets,
    verdict: r.verdict,
    rating,
    grade,
    tier,
    grid,
    skips: { team: state.picks.some((p) => p.skips.team), decade: state.picks.some((p) => p.skips.decade) },
  };
}

/**
 * All the game state and handlers, sport-agnostic. The MLB and NHL boards render
 * different layouts on top of this one hook so they share the engine wiring,
 * daily/free/franchise/tank/blind flows, lockout, and the spin phase machine.
 */
export function usePerfectSeasonGame({ sport, data, config, schedule }: GameProps) {
  const [source, setSource] = useState<Source>('daily');
  const [freeType, setFreeType] = useState<FreeType>('standard');
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [variant, setVariant] = useState<Variant>('classic');
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
      const existing = getDaily(sport, date, variant);
      if (existing) {
        setRecord(existing);
        setDay({ dayNumber: existing.dayNumber, date });
        setState(null);
        return;
      }
      const dg = dailyToday(data, config, schedule);
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
      setState(franchiseId ? franchiseGame(data, config, franchiseId) : null);
      return;
    }
    setState(randomGame(data, config, freeType));
  }, [sport, data, config, schedule, source, freeType, franchiseId, variant]);

  // Lock and record a finished Daily once.
  useEffect(() => {
    if (source !== 'daily' || record || !state?.done || !state.result || !day) return;
    const rec = buildDailyRecord(data, config, state, day.dayNumber);
    recordDaily(sport, day.date, variant, rec);
    setRecord(rec);
  }, [sport, data, config, source, record, state, day, variant]);

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

  const onSkip = useCallback(
    (a: Action) => {
      dispatch(a);
      setPhase('rolling');
    },
    [dispatch],
  );

  const newGame = useCallback(() => {
    setUndo(false);
    setPhase('board');
    if (freeType === 'franchise' && franchiseId) setState(franchiseGame(data, config, franchiseId));
    else if (freeType !== 'franchise') setState(randomGame(data, config, freeType));
  }, [data, config, freeType, franchiseId]);

  const undoPick = useCallback(() => {
    dispatch({ type: 'UNDO' });
    setUndo(false);
    setPhase('pick');
  }, [dispatch]);

  const chooseFreeType = useCallback((t: FreeType) => {
    setSource('free');
    setFreeType(t);
    if (t === 'franchise') setFranchiseId(null);
  }, []);

  return {
    source,
    freeType,
    franchiseId,
    variant,
    state,
    phase,
    undo,
    day,
    record,
    type,
    mode,
    spinKey,
    setSource,
    setVariant,
    setPhase,
    setFranchiseId,
    dispatch,
    commitAssign,
    onSkip,
    newGame,
    undoPick,
    chooseFreeType,
  };
}
