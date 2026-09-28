/**
 * MLB postseason odds. Team strength blends regular-season win % with
 * Pythagorean win % (runs scored/allowed), regressed toward .500 because
 * playoff teams are closer in true talent than their records. Games use log5
 * plus home field; series follow MLB's formats (Wild Card: all games at the
 * higher seed; Division Series 2-2-1; LCS/World Series 2-3-2).
 *
 * Backtest before changing a constant: npx tsx scripts/backtest-mlb-postseason.ts
 */

/** Share of a team's distance from .500 we trust. Backtest 2015-25 (101
 *  series): Brier 0.2391 vs coin flip 0.2500; 0.75-1.0 scored best. */
export const MLB_REGRESSION = 0.75;
/** Home-field edge in log-odds (about 52% for evenly matched teams). The
 *  backtest can't resolve home field on 101 series, so this stays modest. */
export const MLB_HOME_LOGIT = 0.08;

const PYTH_EXP = 1.83;

export interface MLBTeamRecord {
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
}

export function teamStrength(r: MLBTeamRecord, regression = MLB_REGRESSION): number {
  const games = r.wins + r.losses;
  if (games === 0) return 0.5;
  const winPct = r.wins / games;
  const rs = Math.max(1, r.runsScored);
  const ra = Math.max(1, r.runsAllowed);
  const pyth = rs ** PYTH_EXP / (rs ** PYTH_EXP + ra ** PYTH_EXP);
  return 0.5 + regression * ((winPct + pyth) / 2 - 0.5);
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** P(team a wins one game vs b). */
export function gameWinProb(a: number, b: number, aHome: boolean | null, homeLogit = MLB_HOME_LOGIT): number {
  const log5 = (a * (1 - b)) / (a * (1 - b) + b * (1 - a));
  if (aHome === null) return log5;
  return sigmoid(logit(log5) + (aHome ? homeLogit : -homeLogit));
}

/** Home side for each game of a series, from the higher seed's view. */
export function homePattern(bestOf: number): boolean[] {
  if (bestOf === 3) return [true, true, true];
  if (bestOf === 5) return [true, true, false, false, true];
  return [true, true, false, false, false, true, true];
}

/**
 * P(a wins the series) from the current state. `aHomeByGame[i]` is whether a
 * hosts game i (0-based, full series length); games already played are skipped.
 */
export function seriesWinProb(
  a: number,
  b: number,
  bestOf: number,
  aWins: number,
  bWins: number,
  aHomeByGame: (boolean | null)[],
  homeLogit = MLB_HOME_LOGIT,
): number {
  const need = Math.ceil(bestOf / 2);
  const memo = new Map<string, number>();
  const go = (w: number, l: number): number => {
    if (w >= need) return 1;
    if (l >= need) return 0;
    const key = `${w}-${l}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const idx = w + l;
    const p = gameWinProb(a, b, aHomeByGame[idx] ?? null, homeLogit);
    const v = p * go(w + 1, l) + (1 - p) * go(w, l + 1);
    memo.set(key, v);
    return v;
  };
  return go(aWins, bWins);
}

// ─── Bracket walk ────────────────────────────────────────────────────────────

export interface SeriesState {
  /** Team ids actually in the series (null while a side is undecided). */
  teamA: number | null;
  teamB: number | null;
  aWins: number;
  bWins: number;
  /** Whether teamA hosts each game (from the schedule). */
  aHomeByGame: boolean[];
}

export type BracketNode =
  | { kind: 'team'; id: number }
  | {
      kind: 'series';
      key: string;
      bestOf: number;
      a: BracketNode;
      b: BracketNode;
      /** Real state once both sides are known. */
      state?: SeriesState;
      /** Fixed host for hypothetical matchups (e.g. a bye team hosts its Division Series). */
      fixedHostId?: number;
    };

/** Probability each team wins this node (reaches past it). */
export function bracketDistribution(
  node: BracketNode,
  strength: (id: number) => number,
  cache = new Map<string, Map<number, number>>(),
): Map<number, number> {
  if (node.kind === 'team') return new Map([[node.id, 1]]);
  const hit = cache.get(node.key);
  if (hit) return hit;
  const da = bracketDistribution(node.a, strength, cache);
  const db = bracketDistribution(node.b, strength, cache);
  const out = new Map<number, number>();
  for (const [x, px] of da) {
    for (const [y, py] of db) {
      const reach = px * py;
      if (reach === 0) continue;
      const sx = strength(x);
      const sy = strength(y);
      let pX: number;
      const st = node.state;
      if (st && st.teamA !== null && st.teamB !== null && ((st.teamA === x && st.teamB === y) || (st.teamA === y && st.teamB === x))) {
        const xIsA = st.teamA === x;
        const homes = xIsA ? st.aHomeByGame : st.aHomeByGame.map((h) => !h);
        pX = seriesWinProb(sx, sy, node.bestOf, xIsA ? st.aWins : st.bWins, xIsA ? st.bWins : st.aWins, homes);
      } else {
        const xHosts = node.fixedHostId !== undefined
          ? node.fixedHostId === x || (node.fixedHostId !== y && sx >= sy)
          : sx >= sy;
        const pattern = homePattern(node.bestOf).map((h) => (xHosts ? h : !h));
        pX = seriesWinProb(sx, sy, node.bestOf, 0, 0, pattern);
      }
      out.set(x, (out.get(x) || 0) + reach * pX);
      out.set(y, (out.get(y) || 0) + reach * (1 - pX));
    }
  }
  cache.set(node.key, out);
  return out;
}
