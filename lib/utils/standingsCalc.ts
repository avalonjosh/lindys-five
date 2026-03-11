import type { StandingsTeam } from '@/lib/types/boxscore';
import { computePositionAwareProbability } from './playoffProbability';

const TOTAL_GAMES = 82;
const WC_HISTORICAL_FLOOR = 94;
const DIV_HISTORICAL_FLOOR = 90;

/** Project a team's final point total (integer). */
export function getProjectedPoints(points: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((points / gamesPlayed) * TOTAL_GAMES);
}

/** Division cut line: average of 3rd & 4th place projected points, ceil, floor 90. */
export function getDivCutLine(team: StandingsTeam, standings: StandingsTeam[]): number {
  const divTeams = standings
    .filter(t => t.divisionName === team.divisionName)
    .sort((a, b) => b.points - a.points);

  const div3Team = divTeams[2];
  const div4Team = divTeams[3];

  let cutLine: number;
  if (div3Team && div4Team && div3Team.gamesPlayed > 0 && div4Team.gamesPlayed > 0) {
    const div3Projected = (div3Team.points / div3Team.gamesPlayed) * TOTAL_GAMES;
    const div4Projected = (div4Team.points / div4Team.gamesPlayed) * TOTAL_GAMES;
    cutLine = Math.ceil((div3Projected + div4Projected) / 2);
  } else if (div3Team && div3Team.gamesPlayed > 0) {
    cutLine = Math.ceil((div3Team.points / div3Team.gamesPlayed) * TOTAL_GAMES);
  } else {
    cutLine = DIV_HISTORICAL_FLOOR;
  }
  return Math.max(cutLine, DIV_HISTORICAL_FLOOR);
}

/** Wildcard cut line: average of WC2 & WC3 projected points, ceil, floor 94. */
export function getWcCutLine(team: StandingsTeam, standings: StandingsTeam[]): number {
  const wcTeams = standings
    .filter(t => t.conferenceName === team.conferenceName && t.divisionSequence > 3)
    .sort((a, b) => b.points - a.points);

  const wc2Team = wcTeams[1];
  const wc3Team = wcTeams[2];

  if (!wc2Team || wc2Team.gamesPlayed === 0) return WC_HISTORICAL_FLOOR;

  const wc2Projected = (wc2Team.points / wc2Team.gamesPlayed) * TOTAL_GAMES;

  let cutLine: number;
  if (wc3Team && wc3Team.gamesPlayed > 0) {
    const wc3Projected = (wc3Team.points / wc3Team.gamesPlayed) * TOTAL_GAMES;
    cutLine = Math.ceil((wc2Projected + wc3Projected) / 2);
  } else {
    cutLine = Math.ceil(wc2Projected);
  }
  return Math.max(cutLine, WC_HISTORICAL_FLOOR);
}

/** Whether a team currently holds a playoff spot (top 3 in division or WC1/WC2). */
export function isInPlayoffPosition(team: StandingsTeam): boolean {
  if (team.divisionSequence <= 3) return true;
  return team.wildcardSequence >= 1 && team.wildcardSequence <= 2;
}

/** Full playoff probability for a team given current standings. */
export function getPlayoffProbability(team: StandingsTeam, standings: StandingsTeam[]): number {
  if (team.gamesPlayed < 5) return 50;
  const projected = getProjectedPoints(team.points, team.gamesPlayed);
  const divCutLine = getDivCutLine(team, standings);
  const wcCutLine = getWcCutLine(team, standings);
  const inPlayoffs = isInPlayoffPosition(team);

  const { probability } = computePositionAwareProbability(
    projected, team.gamesPlayed, divCutLine, wcCutLine, inPlayoffs
  );
  return probability;
}

/**
 * Compute probability for a hypothetical points/GP scenario.
 * Cut lines are pre-computed and passed in so callers can reuse them.
 */
export function computeProb(
  points: number,
  gamesPlayed: number,
  divCutLine: number,
  wcCutLine: number,
  team: StandingsTeam,
  standings: StandingsTeam[]
): number {
  if (gamesPlayed <= 0) return 50;
  const projected = getProjectedPoints(points, gamesPlayed);
  const inPlayoffs = isInPlayoffPosition(team);
  const { probability } = computePositionAwareProbability(
    projected, gamesPlayed, divCutLine, wcCutLine, inPlayoffs
  );
  return probability;
}
