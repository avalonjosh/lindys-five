import type { StandingsTeam } from '@/lib/types/boxscore';
import { getCurrentSeasonGameCount } from './season';

// ── Points projection ────────────────────────────────────────────────────────

// League-average NHL points pace (≈92 over 82 games, ≈94 over 84).
export const LEAGUE_AVG_PACE = 1.12;
// Regression prior for a team's points pace, expressed as phantom games played
// at the league average. Empirically the spread of NHL true talent is about
// 0.15 pts/game (sd) against ~0.93 pts/game of single-game noise, which puts
// the ideal prior near 35-40 games. Backtests on 2024-25 and 2025-26 (see
// scripts/backtest-nhl-odds.ts) confirmed 40 beats 20 and 30 on Brier score
// in both seasons; 50 was mixed.
export const PACE_PRIOR_GAMES = 40;

/**
 * Model projection of a team's final point total. Banked points stay banked;
 * the remaining games are played at a pace regressed toward the league average
 * with a PACE_PRIOR_GAMES-game prior. At zero games played every team projects
 * to the league average; by late season the prior has almost no pull.
 *
 * This is the projection the probability model runs on. The raw "on pace for"
 * number shown in the UI is a different quantity (points / gp × season length).
 */
export function projectPointsWithPrior(
  points: number,
  gamesPlayed: number,
  totalGames: number = getCurrentSeasonGameCount()
): number {
  const gp = Math.max(0, gamesPlayed);
  const remaining = Math.max(0, totalGames - gp);
  const regressedPace = (points + LEAGUE_AVG_PACE * PACE_PRIOR_GAMES) / (gp + PACE_PRIOR_GAMES);
  return points + regressedPace * remaining;
}

// ── Playoff probability ──────────────────────────────────────────────────────

/**
 * Get a message describing the playoff situation
 */
export function getPlayoffStatusMessage(probability: number, gamesPlayed: number): string {
  if (gamesPlayed < 5) {
    return "Season just getting started";
  }

  if (probability >= 90) {
    return "Strong playoff position";
  } else if (probability >= 70) {
    return "On track for playoffs";
  } else if (probability >= 50) {
    return "In the playoff hunt";
  } else if (probability >= 30) {
    return "Need to pick up the pace";
  } else if (probability >= 10) {
    return "Playoff hopes fading";
  } else {
    return "Facing long odds";
  }
}

/**
 * Get color for probability display
 * Always returns 'team' to use team color scheme regardless of probability
 */
export function getProbabilityColor(): string {
  return 'team';
}

// Steepness of the logistic curve at a full season remaining. With the curve's
// spread tied to the square root of games remaining, this reproduces the
// binomial spread of an NHL team's points (≈0.93 pts/game of noise on both the
// team and the cut line): ~12 points of sd with 84 games left, ~8.5 at the
// halfway mark, ~1.3 with one game left.
const K_FULL_SEASON = 0.15 * Math.sqrt(84);
// Never let the curve go fully vertical: with no games left the cut line is
// still an estimate (average of two teams' projections), so keep a sliver of
// uncertainty rather than a hard step.
const MIN_EFFECTIVE_GAMES_REMAINING = 0.5;

/**
 * Calculate probability for a hypothetical final point total
 * Uses a logistic (S-curve) function for more realistic probability distribution:
 * - Steep changes near the cut line where each point matters most
 * - Flattens at extremes (diminishing returns for being way above/below)
 * - Sharpens as games run out, so a team that is above the cut line with a few
 *   games left is near-certain, and one that is below with none left is out
 *
 * @param finalPoints - The hypothetical final point total
 * @param gamesPlayed - Games played so far (sets how many games remain)
 * @param cutLine - The current season's projected cut line (defaults to 96, scaled to season length)
 * @param pathType - Optional path type to tune steepness: 'division' (steeper), 'wildcard' (flatter), or 'default'
 * @param totalGames - Season length; defaults to the season in progress
 */
export function probabilityForFinalPoints(
  finalPoints: number,
  gamesPlayed: number,
  cutLine: number = Math.round(96 * getCurrentSeasonGameCount() / 82),
  pathType: 'division' | 'wildcard' | 'default' = 'default',
  totalGames: number = getCurrentSeasonGameCount()
): number {
  // How far above/below the current season's projected cut line
  const diff = finalPoints - cutLine;

  const gamesRemaining = Math.max(MIN_EFFECTIVE_GAMES_REMAINING, totalGames - gamesPlayed);
  let k = K_FULL_SEASON / Math.sqrt(gamesRemaining);

  // Division: fewer competitors, less volatile → steeper curve
  // Wildcard: more competitors, more volatile → flatter curve
  // Default: used for breakdown table
  switch (pathType) {
    case 'division':
      k *= 1.15;
      break;
    case 'wildcard':
      k *= 0.92;
      break;
  }

  // Logistic function: P = 100 / (1 + e^(-k * diff))
  // At diff=0: 50%, curves toward 0% and 100% at extremes
  const probability = 100 / (1 + Math.exp(-k * diff));

  // Cap at 99/1 - never show 100% or 0% unless mathematically clinched/eliminated
  return Math.max(1, Math.min(99, Math.round(probability)));
}

// Backtested on 2024-25 and 2025-26: 3 points beat 1.5 in both seasons
// (most of the gain after 60 GP); 4.5 and 6 were mixed; 0 was clearly worse.
const POSITION_BONUS_MAX = 3;

/**
 * Compute position-aware playoff probability considering both division and wildcard paths.
 * A team makes the playoffs if they finish top 3 in their division OR wildcard 1-2.
 * We calculate probability for both paths and take the max.
 *
 * @param projectedPoints - Team's projected final point total (use projectPointsWithPrior)
 * @param gamesPlayed - Games played so far
 * @param divCutLine - Projected division cut line (top 3 threshold)
 * @param wcCutLine - Projected wildcard cut line
 * @param isInPlayoffPosition - Whether team currently holds a playoff spot
 * @param clinchIndicator - NHL clinch/elimination flag (x/y/z/p/e)
 * @param totalGames - Season length; defaults to the season in progress
 */
export function computePositionAwareProbability(
  projectedPoints: number,
  gamesPlayed: number,
  divCutLine: number,
  wcCutLine: number,
  isInPlayoffPosition: boolean,
  clinchIndicator?: string,
  totalGames: number = getCurrentSeasonGameCount()
): { probability: number; activePath: 'division' | 'wildcard'; effectiveCutLine: number } {
  // Teams that have clinched a playoff spot are guaranteed 100%
  // x = clinched playoff, y = clinched division, z = clinched conference, p = Presidents' Trophy
  if (clinchIndicator && ['x', 'y', 'z', 'p'].includes(clinchIndicator)) {
    return { probability: 100, activePath: 'division', effectiveCutLine: 0 };
  }
  // Eliminated teams are 0%
  if (clinchIndicator === 'e') {
    return { probability: 0, activePath: 'wildcard', effectiveCutLine: 0 };
  }

  // Position bonus: teams currently holding a playoff spot are displaced less
  // often than pace alone suggests. Ramps linearly with season progress, up to
  // POSITION_BONUS_MAX points shaved off the cut line at season's end.
  let positionBonus = 0;
  if (isInPlayoffPosition) {
    const seasonProgress = Math.min(gamesPlayed / totalGames, 1);
    positionBonus = POSITION_BONUS_MAX * seasonProgress;
  }

  const adjustedDivCutLine = divCutLine - positionBonus;
  const adjustedWcCutLine = wcCutLine - positionBonus;

  const divProb = probabilityForFinalPoints(projectedPoints, gamesPlayed, adjustedDivCutLine, 'division', totalGames);
  const wcProb = probabilityForFinalPoints(projectedPoints, gamesPlayed, adjustedWcCutLine, 'wildcard', totalGames);

  const probability = Math.max(divProb, wcProb);
  const activePath = divProb >= wcProb ? 'division' : 'wildcard';
  const effectiveCutLine = activePath === 'division'
    ? Math.round(adjustedDivCutLine)
    : Math.round(adjustedWcCutLine);

  return { probability, activePath, effectiveCutLine };
}

// ── Series (best-of-seven) model ─────────────────────────────────────────────

export interface SeriesOddsOptions {
  // Goal differential per game — blended with point % for a stronger team-strength signal
  teamGoalDiffPerGame?: number;
  oppGoalDiffPerGame?: number;
  // Team-specific home/road win rates — replaces the flat 4% home-ice boost
  teamHomeWinPct?: number;
  teamRoadWinPct?: number;
  oppHomeWinPct?: number;
  oppRoadWinPct?: number;
}

export interface SeriesStrength {
  goalDiffPerGame?: number;
  homeWinPct?: number;
  roadWinPct?: number;
}

/** Strength inputs for the series model, derived from a standings row. */
export function seriesStrengthFor(st: StandingsTeam | undefined | null): SeriesStrength {
  if (!st) return {};
  const gp = st.gamesPlayed || 0;
  const homeGP = (st.homeWins || 0) + (st.homeLosses || 0) + (st.homeOtLosses || 0);
  const roadGP = (st.roadWins || 0) + (st.roadLosses || 0) + (st.roadOtLosses || 0);
  return {
    goalDiffPerGame: gp > 0 ? ((st.goalFor || 0) - (st.goalAgainst || 0)) / gp : undefined,
    homeWinPct: homeGP > 0 ? (st.homeWins || 0) / homeGP : undefined,
    roadWinPct: roadGP > 0 ? (st.roadWins || 0) / roadGP : undefined,
  };
}

/** Pack two teams' strengths into the options bag computeSeriesWinProbability expects. */
export function seriesOptionsFor(
  team: StandingsTeam | undefined | null,
  opp: StandingsTeam | undefined | null
): SeriesOddsOptions {
  const t = seriesStrengthFor(team);
  const o = seriesStrengthFor(opp);
  return {
    teamGoalDiffPerGame: t.goalDiffPerGame,
    oppGoalDiffPerGame: o.goalDiffPerGame,
    teamHomeWinPct: t.homeWinPct,
    teamRoadWinPct: t.roadWinPct,
    oppHomeWinPct: o.homeWinPct,
    oppRoadWinPct: o.roadWinPct,
  };
}

// Logistic slope for single-game win probability from the strength gap.
// k=2.2 puts a .600 team at ≈55.5% per game against a .500 team, in line with
// public NHL Elo/MoneyPuck single-game odds; with home ice that is a ≈63%
// series favorite. (The old k=4.5 gave 61% per game and a 74% series, well
// hotter than any public model.)
const SERIES_K = 2.2;

/**
 * Compute the probability that a team wins a best-of-7 series.
 *
 * Uses team point-percentages (optionally blended with goal differential) as a
 * strength proxy. A logistic function converts the strength gap into a
 * single-game win probability, and a dynamic program over the remaining games
 * (2-2-1-1-1 home/road pattern) converts that into a series-win probability.
 *
 * Home-ice advantage: the higher seed hosts games 1, 2, 5, 7.
 *
 * @param teamPtPctg - Team's regular-season point percentage (0-1)
 * @param oppPtPctg  - Opponent's regular-season point percentage (0-1)
 * @param teamWins   - Games won so far in the series (0-4)
 * @param oppWins    - Games lost so far in the series (0-4)
 * @param hasHomeIce - Whether this team has home-ice advantage
 */
export function computeSeriesWinProbability(
  teamPtPctg: number,
  oppPtPctg: number,
  teamWins: number = 0,
  oppWins: number = 0,
  hasHomeIce: boolean = true,
  options: SeriesOddsOptions = {}
): number {
  return Math.round(
    100 * seriesWinProbabilityRaw(teamPtPctg, oppPtPctg, teamWins, oppWins, hasHomeIce, options)
  );
}

/**
 * Unrounded series-win probability (0-1). Same model as
 * computeSeriesWinProbability; the bracket-aware Cup model chains these so
 * rounding does not compound across rounds.
 */
export function seriesWinProbabilityRaw(
  teamPtPctg: number,
  oppPtPctg: number,
  teamWins: number = 0,
  oppWins: number = 0,
  hasHomeIce: boolean = true,
  options: SeriesOddsOptions = {}
): number {
  // If series already decided
  if (teamWins >= 4) return 1;
  if (oppWins >= 4) return 0;

  // Composite strength: 60% point %, 40% normalized goal-diff per game.
  // Falls back to raw point % when goal-diff data is missing (preserves existing callers).
  const normalizeGD = (gd: number) => 0.5 + Math.max(-1, Math.min(1, gd)) * 0.25;
  const teamStrength =
    options.teamGoalDiffPerGame != null
      ? 0.6 * teamPtPctg + 0.4 * normalizeGD(options.teamGoalDiffPerGame)
      : teamPtPctg;
  const oppStrength =
    options.oppGoalDiffPerGame != null
      ? 0.6 * oppPtPctg + 0.4 * normalizeGD(options.oppGoalDiffPerGame)
      : oppPtPctg;

  const diff = teamStrength - oppStrength;
  const baseP = 1 / (1 + Math.exp(-SERIES_K * diff));

  // Team-specific home-ice boost if splits are provided; otherwise flat 4% (historical league average).
  // Formula: half the team's own home-vs-road win-rate differential, capped at 10%.
  const FLAT_HOME_BOOST = 0.04;
  const teamOwnBoost =
    options.teamHomeWinPct != null && options.teamRoadWinPct != null
      ? Math.min(0.10, Math.max(0, (options.teamHomeWinPct - options.teamRoadWinPct) / 2))
      : FLAT_HOME_BOOST;
  const oppOwnBoost =
    options.oppHomeWinPct != null && options.oppRoadWinPct != null
      ? Math.min(0.10, Math.max(0, (options.oppHomeWinPct - options.oppRoadWinPct) / 2))
      : FLAT_HOME_BOOST;

  // pHome is P(team wins) when team is at home → boost = +teamOwnBoost
  // pAway is P(team wins) when team is on road → boost = -oppOwnBoost (opponent's home advantage working against us)
  const pHome = Math.min(0.95, Math.max(0.05, baseP + teamOwnBoost));
  const pAway = Math.min(0.95, Math.max(0.05, baseP - oppOwnBoost));

  // Best-of-7, 2-2-1-1-1 format: home team hosts games 1,2,5,7
  // Enumerate remaining games using dynamic programming
  const winsNeeded = 4 - teamWins;
  const lossesAllowed = 4 - oppWins;
  const gamesPlayed = teamWins + oppWins;

  // Build home-ice schedule for remaining games
  // Games are numbered 1-7 overall; higher seed is home for 1,2,5,7
  const homeGames = new Set(hasHomeIce ? [1, 2, 5, 7] : [3, 4, 6]);
  const remainingSchedule: boolean[] = [];
  for (let g = gamesPlayed + 1; g <= 7; g++) {
    remainingSchedule.push(homeGames.has(g));
  }

  // DP: probability of winning from state (w, l) with remaining schedule
  // w = additional wins needed, l = additional losses allowed
  const memo = new Map<string, number>();

  function dp(w: number, l: number, gameIdx: number): number {
    if (w <= 0) return 1;
    if (l <= 0) return 0;
    if (gameIdx >= remainingSchedule.length) return 0;

    const key = `${w},${l},${gameIdx}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const isHome = remainingSchedule[gameIdx];
    const p = isHome ? pHome : pAway;

    const result = p * dp(w - 1, l, gameIdx + 1) + (1 - p) * dp(w, l - 1, gameIdx + 1);
    memo.set(key, result);
    return result;
  }

  const prob = dp(winsNeeded, lossesAllowed, 0);
  // Humility cap [15%, 85%] applies only before the series starts — playoff
  // hockey has inherent variance, so no pre-series model should be more
  // confident than ~85% about a best-of-7. Once games are played the model
  // must be allowed past it: a 3-0 lead is a real ~95-98%, and capping it at
  // 85% distorts the displayed series odds and everything chained off them
  // (Cup odds). Mid-series output keeps a softer [2%, 98%] bound.
  if (gamesPlayed === 0) {
    return Math.max(0.15, Math.min(0.85, prob));
  }
  return Math.max(0.02, Math.min(0.98, prob));
}
