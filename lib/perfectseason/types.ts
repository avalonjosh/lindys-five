/**
 * Shared types for the Perfect Season engine (162-0 / 82-0).
 * One engine, thin sport configs, mode flags. See spec Section 9.
 */

export type Sport = 'mlb' | 'nhl';

export interface PlayerLine {
  [key: string]: string | number;
}

export interface Player {
  id: string;
  name: string;
  pos: string[];
  score: number;
  line: PlayerLine;
}

export interface FranchiseInfo {
  id: string;
  names: Record<string, string>;
  activeDecades: string[];
}

export interface GameData {
  sport: Sport;
  decades: string[];
  franchises: FranchiseInfo[];
  pools: Record<string, Player[]>;
}

/** A single slot-machine outcome: a decade plus a franchise. */
export interface Spin {
  decade: string;
  franchise: string;
}

/**
 * The bounded skip-replacement tree for one round (spec Section 7.3).
 * Skip Team rerolls the franchise and keeps the decade. Skip Decade rerolls
 * the decade and keeps the franchise. Both currencies are one-use per game, so
 * at a single round a player can reach at most a second-order node.
 */
export interface RoundTree {
  primary: Spin;
  teamSkip: Spin | null;
  decadeSkip: Spin | null;
  teamThenDecade: Spin | null;
  decadeThenTeam: Spin | null;
}

export interface DailySchedule {
  sport: Sport;
  date: string;
  dayNumber: number;
  rounds: RoundTree[];
}

/** A roster slot definition. accepts lists the eligible source positions. */
export interface SlotDef {
  id: string;
  label: string;
  accepts: string[];
}

export interface VerdictBand {
  min: number;
  line: string;
}

export interface SportConfig {
  sport: Sport;
  games: number;
  slots: SlotDef[];
  /** Set sizes that sum to games, e.g. 32 fives plus a 2-game finale. */
  setSizes: number[];
  /** Compact stat keys shown on a player row, in order, per player kind. */
  statColumns: { bat: string[]; pitch: string[] };
  verdict: { standard: VerdictBand[]; tank: VerdictBand[] };
  blindLabel: string;
  shareIcon: string;
}

export type ModeType = 'standard' | 'tank' | 'franchise';
export type ModeSource = 'daily' | 'free';

export interface ModeDescriptor {
  type: ModeType;
  source: ModeSource;
  franchiseId?: string;
}

export interface SimResult {
  wins: number;
  losses: number;
  teamScore: number;
  totalSets: number;
  setsWon: number;
  perfectSets: number;
  setWins: number[];
  verdict: string;
}
