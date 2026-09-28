import { getCurrentNHLSeason } from './season';
import { NHL_PRIOR_PACE } from '@/lib/data/nhlPriorPace';

// League-average NHL points pace (≈92 over 82 games, ≈94 over 84).
export const LEAGUE_AVG_PACE = 1.12;
// How much of last season's deviation from average carries into this season's
// talent estimate. Year-to-year points correlation is ~0.6, but as the live
// model's prior mean, 0.3 backtested best (2023-24..2025-26 Brier: 0.2-0.5 all
// beat the flat league average; 0.62 lost in two of three seasons).
export const PRESEASON_REGRESSION = 0.3;

/** Last season's points pace regressed toward the league average. */
export function priorPaceFromLastSeason(points: number, gamesPlayed: number): number {
  const lastPace = gamesPlayed > 0 ? points / gamesPlayed : LEAGUE_AVG_PACE;
  return LEAGUE_AVG_PACE + PRESEASON_REGRESSION * (lastPace - LEAGUE_AVG_PACE);
}

let override: Record<string, number> | null = null;

/** Backtests replay past seasons with their own priors; live pages use the
 * committed table for the season in progress. */
export function setPriorPaceOverride(paces: Record<string, number> | null): void {
  override = paces;
}

/** A team's preseason talent estimate (pts/game) for the season in progress,
 * or the league average when the team or season has no entry. */
export function getTeamPriorPace(teamAbbrev?: string): number {
  if (!teamAbbrev) return LEAGUE_AVG_PACE;
  const table = override ?? NHL_PRIOR_PACE[getCurrentNHLSeason()];
  return table?.[teamAbbrev] ?? LEAGUE_AVG_PACE;
}
