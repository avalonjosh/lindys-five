import type { StandingsTeam } from '@/lib/types/boxscore';
import { computePositionAwareProbability, projectPointsWithPrior } from './playoffProbability';
import { getCurrentSeasonGameCount } from './season';

// 82-game-era historical floors, scaled to the season in progress (84 games from 2026-27)
const WC_HISTORICAL_FLOOR = (totalGames: number) => Math.round(94 * totalGames / 82);
const DIV_HISTORICAL_FLOOR = (totalGames: number) => Math.round(90 * totalGames / 82);

/** Raw "on pace for" projection (integer): points / gp × season length. This is
 * the display number; the probability model uses getModelProjectedPoints. */
export function getProjectedPoints(
  points: number,
  gamesPlayed: number,
  totalGames: number = getCurrentSeasonGameCount()
): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((points / gamesPlayed) * totalGames);
}

/** Model projection: banked points plus remaining games at a pace regressed
 * toward the league average. Feed this to computePositionAwareProbability. */
export function getModelProjectedPoints(
  points: number,
  gamesPlayed: number,
  totalGames: number = getCurrentSeasonGameCount()
): number {
  return projectPointsWithPrior(points, gamesPlayed, totalGames);
}

export interface CutLines {
  divCutLine: number;
  wcCutLine: number;
  /** 4th-place team in the division (first team out of a division spot), or 3rd if no 4th. */
  divBubbleTeamAbbrev: string;
  /** Second wild card (last team in). */
  wc2TeamAbbrev: string;
}

/** Division cut line: average of the 3rd and 4th place teams' model
 * projections, ceil, floored at the historical minimum. Uses the NHL's own
 * divisionSequence so ordering matches the official standings tiebreakers. */
export function getDivCutLine(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): number {
  return getCutLines(team, standings, totalGames).divCutLine;
}

/** Wildcard cut line: average of WC2 and WC3 model projections, ceil, floored
 * at the historical minimum. Uses the NHL's wildcardSequence. */
export function getWcCutLine(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): number {
  return getCutLines(team, standings, totalGames).wcCutLine;
}

export function getCutLines(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): CutLines {
  const project = (t: StandingsTeam) => projectPointsWithPrior(t.points, t.gamesPlayed, totalGames);

  // --- Division ---
  const divTeams = standings
    .filter(t => t.divisionName === team.divisionName)
    .sort((a, b) => a.divisionSequence - b.divisionSequence || b.points - a.points);
  const div3Team = divTeams[2];
  const div4Team = divTeams[3];

  const divFloor = DIV_HISTORICAL_FLOOR(totalGames);
  let divCutLine: number;
  let divBubbleTeamAbbrev = '';
  if (div3Team && div4Team) {
    divCutLine = Math.ceil((project(div3Team) + project(div4Team)) / 2);
    divBubbleTeamAbbrev = div4Team.teamAbbrev.default;
  } else if (div3Team) {
    divCutLine = Math.ceil(project(div3Team));
    divBubbleTeamAbbrev = div3Team.teamAbbrev.default;
  } else {
    divCutLine = divFloor;
  }
  divCutLine = Math.max(divCutLine, divFloor);

  // --- Wild card ---
  const wcTeams = standings
    .filter(t => t.conferenceName === team.conferenceName && t.divisionSequence > 3)
    .sort((a, b) => a.wildcardSequence - b.wildcardSequence || b.points - a.points);
  const wc2Team = wcTeams[1];
  const wc3Team = wcTeams[2];

  const wcFloor = WC_HISTORICAL_FLOOR(totalGames);
  let wcCutLine: number;
  if (wc2Team && wc3Team) {
    wcCutLine = Math.ceil((project(wc2Team) + project(wc3Team)) / 2);
  } else if (wc2Team) {
    wcCutLine = Math.ceil(project(wc2Team));
  } else {
    wcCutLine = wcFloor;
  }
  wcCutLine = Math.max(wcCutLine, wcFloor);

  return {
    divCutLine,
    wcCutLine,
    divBubbleTeamAbbrev,
    wc2TeamAbbrev: wc2Team?.teamAbbrev.default || '',
  };
}

/** Whether a team currently holds a playoff spot (top 3 in division or WC1/WC2). */
export function isInPlayoffPosition(team: StandingsTeam): boolean {
  if (team.divisionSequence <= 3) return true;
  return team.wildcardSequence >= 1 && team.wildcardSequence <= 2;
}

/** Full playoff probability for a team given current standings. */
export function getPlayoffProbability(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): number {
  const projected = getModelProjectedPoints(team.points, team.gamesPlayed, totalGames);
  const { divCutLine, wcCutLine } = getCutLines(team, standings, totalGames);
  const inPlayoffs = isInPlayoffPosition(team);

  const { probability } = computePositionAwareProbability(
    projected, team.gamesPlayed, divCutLine, wcCutLine, inPlayoffs, team.clinchIndicator, totalGames
  );
  return probability;
}

/**
 * Compute probability for a hypothetical points/GP scenario.
 * Cut lines are pre-computed and passed in so callers can reuse them.
 * `team` supplies the playoff-position flag and clinch indicator.
 */
export function computeProb(
  points: number,
  gamesPlayed: number,
  divCutLine: number,
  wcCutLine: number,
  team: StandingsTeam
): number {
  const projected = getModelProjectedPoints(points, gamesPlayed);
  const inPlayoffs = isInPlayoffPosition(team);
  const { probability } = computePositionAwareProbability(
    projected, gamesPlayed, divCutLine, wcCutLine, inPlayoffs, team.clinchIndicator
  );
  return probability;
}
