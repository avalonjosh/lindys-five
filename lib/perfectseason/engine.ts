/**
 * The Perfect Season engine: a pure-function state machine intended to drive a
 * useReducer in the UI (spec Section 9). Zero dependencies, fully testable.
 *
 * It enforces the dedupe rule (the same human never fills two slots, even via
 * different decade-franchise stints, keyed on playerID), resolves deterministic
 * skips by walking the pre-generated round tree, blocks illegal assignments, and
 * runs the season once round six is filled. Tank and Franchise are flags on the
 * mode descriptor, not forks.
 */

import type {
  GameData,
  ModeDescriptor,
  Player,
  RoundTree,
  SimResult,
  SlotDef,
  Spin,
  SportConfig,
} from './types';
import { simulate } from './sim';
import { hasPerfectMatching, poolPlayers } from './schedule';

export interface PickRecord {
  round: number;
  spin: Spin;
  playerId: string;
  playerName: string;
  score: number;
  slotId: string;
  skips: { team: boolean; decade: boolean };
}

interface CoreState {
  round: number;
  teamSkipAvail: boolean;
  decadeSkipAvail: boolean;
  curTeamUsed: boolean;
  curDecadeUsed: boolean;
  firstSkip: 'T' | 'D' | null;
  selectedId: string | null;
  roster: Record<string, Player | null>;
  usedPlayerIds: string[];
  picks: PickRecord[];
  done: boolean;
  result: SimResult | null;
}

export interface EngineState extends CoreState {
  config: SportConfig;
  data: GameData;
  mode: ModeDescriptor;
  rounds: RoundTree[];
  past: CoreState[];
}

export type Action =
  | { type: 'SELECT_PLAYER'; id: string }
  | { type: 'ASSIGN_SLOT'; slotId: string }
  | { type: 'SKIP_TEAM' }
  | { type: 'SKIP_DECADE' }
  | { type: 'UNDO' };

export function createGame(
  data: GameData,
  config: SportConfig,
  rounds: RoundTree[],
  mode: ModeDescriptor,
): EngineState {
  const roster: Record<string, Player | null> = {};
  for (const slot of config.slots) roster[slot.id] = null;
  return {
    config,
    data,
    mode,
    rounds,
    round: 0,
    teamSkipAvail: mode.type !== 'franchise',
    decadeSkipAvail: true,
    curTeamUsed: false,
    curDecadeUsed: false,
    firstSkip: null,
    selectedId: null,
    roster,
    usedPlayerIds: [],
    picks: [],
    done: false,
    result: null,
    past: [],
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function eligible(player: Player, slot: SlotDef): boolean {
  return player.pos.some((p) => slot.accepts.includes(p));
}

/** The spin currently showing, resolved from the round tree and skips used. */
export function currentSpin(s: EngineState): Spin {
  const t = s.rounds[s.round];
  if (s.curTeamUsed && s.curDecadeUsed) {
    return (s.firstSkip === 'T' ? t.teamThenDecade : t.decadeThenTeam) ?? t.primary;
  }
  if (s.curTeamUsed) return t.teamSkip ?? t.primary;
  if (s.curDecadeUsed) return t.decadeSkip ?? t.primary;
  return t.primary;
}

export function openSlots(s: EngineState): SlotDef[] {
  return s.config.slots.filter((slot) => s.roster[slot.id] === null);
}

/**
 * The pools for the remaining rounds taken as primaries, excluding already-used
 * players and one more id. Future rounds always default to their primary (a
 * skip only affects the round it is used on), so a completion via primaries is
 * always an available strategy, which is what we keep feasible.
 */
function futurePrimaryPools(s: EngineState, excludeId: string): Player[][] {
  const used = new Set([...s.usedPlayerIds, excludeId]);
  const pools: Player[][] = [];
  for (let r = s.round + 1; r < s.rounds.length; r++) {
    pools.push(poolPlayers(s.data, s.rounds[r].primary, s.config).filter((p) => !used.has(p.id)));
  }
  return pools;
}

/**
 * Would assigning this player to this slot still leave the season finishable?
 * We require a full matching between the remaining primary pools and the slots
 * left open, so a player can never paint themselves into a dead end.
 */
export function completableAfter(s: EngineState, player: Player, slotId: string): boolean {
  const openAfter = openSlots(s).filter((sl) => sl.id !== slotId && s.roster[sl.id] === null);
  if (openAfter.length === 0) return true;
  return hasPerfectMatching(futurePrimaryPools(s, player.id), openAfter);
}

export function legalSlots(s: EngineState, player: Player): SlotDef[] {
  return openSlots(s).filter((slot) => eligible(player, slot) && completableAfter(s, player, slot.id));
}

/** Players from a given spin's pool that have at least one finishable slot. */
function playersForSpin(s: EngineState, spin: Spin): Player[] {
  const used = new Set(s.usedPlayerIds);
  const pool = poolPlayers(s.data, spin, s.config).filter(
    (p) => !used.has(p.id) && openSlots(s).some((slot) => eligible(p, slot) && completableAfter(s, p, slot.id)),
  );
  if (s.mode.type === 'tank') return pool.sort((a, b) => a.name.localeCompare(b.name));
  return pool.sort((a, b) => b.score - a.score);
}

/** Players available this spin: rosterable, not used, finishable, sorted by mode. */
export function availablePlayers(s: EngineState): Player[] {
  return playersForSpin(s, currentSpin(s));
}

function spinAfterTeamSkip(s: EngineState): Spin {
  const t = s.rounds[s.round];
  return (s.curDecadeUsed ? t.decadeThenTeam : t.teamSkip) ?? t.primary;
}

function spinAfterDecadeSkip(s: EngineState): Spin {
  const t = s.rounds[s.round];
  return (s.curTeamUsed ? t.teamThenDecade : t.decadeSkip) ?? t.primary;
}

/** A skip is offered only if the rerolled spin still leaves a finishable pick. */
export function canSkipTeam(s: EngineState): boolean {
  if (s.mode.type === 'franchise' || !s.teamSkipAvail || s.curTeamUsed) return false;
  if (!s.rounds[s.round].teamSkip) return false;
  return playersForSpin(s, spinAfterTeamSkip(s)).length > 0;
}

export function canSkipDecade(s: EngineState): boolean {
  if (!s.decadeSkipAvail || s.curDecadeUsed) return false;
  if (!s.rounds[s.round].decadeSkip) return false;
  return playersForSpin(s, spinAfterDecadeSkip(s)).length > 0;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function snapshot(s: EngineState): CoreState {
  return structuredClone({
    round: s.round,
    teamSkipAvail: s.teamSkipAvail,
    decadeSkipAvail: s.decadeSkipAvail,
    curTeamUsed: s.curTeamUsed,
    curDecadeUsed: s.curDecadeUsed,
    firstSkip: s.firstSkip,
    selectedId: s.selectedId,
    roster: s.roster,
    usedPlayerIds: s.usedPlayerIds,
    picks: s.picks,
    done: s.done,
    result: s.result,
  });
}

function advance(s: EngineState): EngineState {
  const round = s.round + 1;
  if (round >= s.rounds.length) {
    const scores = s.picks.map((p) => p.score);
    return {
      ...s,
      round,
      done: true,
      result: simulate(scores, s.mode, s.config),
      curTeamUsed: false,
      curDecadeUsed: false,
      firstSkip: null,
      selectedId: null,
    };
  }
  return { ...s, round, curTeamUsed: false, curDecadeUsed: false, firstSkip: null, selectedId: null };
}

export function reduce(s: EngineState, action: Action): EngineState {
  if (s.done && action.type !== 'UNDO') return s;

  switch (action.type) {
    case 'SELECT_PLAYER': {
      const ok = availablePlayers(s).some((p) => p.id === action.id);
      return ok ? { ...s, selectedId: action.id } : s;
    }

    case 'ASSIGN_SLOT': {
      if (!s.selectedId) return s;
      const player = availablePlayers(s).find((p) => p.id === s.selectedId);
      if (!player) return s;
      const slot = s.config.slots.find((sl) => sl.id === action.slotId);
      if (!slot || s.roster[slot.id] !== null || !eligible(player, slot)) return s;
      const spin = currentSpin(s);
      const past = [...s.past, snapshot(s)];
      const next: EngineState = {
        ...s,
        past,
        roster: { ...s.roster, [slot.id]: player },
        usedPlayerIds: [...s.usedPlayerIds, player.id],
        picks: [
          ...s.picks,
          {
            round: s.round,
            spin,
            playerId: player.id,
            playerName: player.name,
            score: player.score,
            slotId: slot.id,
            skips: { team: s.curTeamUsed, decade: s.curDecadeUsed },
          },
        ],
        selectedId: null,
      };
      return advance(next);
    }

    case 'SKIP_TEAM': {
      if (!canSkipTeam(s)) return s;
      return {
        ...s,
        teamSkipAvail: false,
        curTeamUsed: true,
        firstSkip: s.firstSkip ?? 'T',
        selectedId: null,
      };
    }

    case 'SKIP_DECADE': {
      if (!canSkipDecade(s)) return s;
      return {
        ...s,
        decadeSkipAvail: false,
        curDecadeUsed: true,
        firstSkip: s.firstSkip ?? 'D',
        selectedId: null,
      };
    }

    case 'UNDO': {
      if (s.past.length === 0) return s;
      const past = [...s.past];
      const prev = past.pop()!;
      return { ...s, ...structuredClone(prev), past };
    }

    default:
      return s;
  }
}
