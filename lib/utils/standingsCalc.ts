import type { StandingsTeam } from '@/lib/types/boxscore';
import { computePositionAwareProbability, projectPointsWithPrior } from './playoffProbability';
import { getCurrentSeasonGameCount } from './season';
import { getTeamPriorPace } from './nhlPriorPace';

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
 * toward the team's preseason talent estimate (league average if no abbrev).
 * Feed this to computePositionAwareProbability. */
export function getModelProjectedPoints(
  points: number,
  gamesPlayed: number,
  teamAbbrev?: string,
  totalGames: number = getCurrentSeasonGameCount()
): number {
  return projectPointsWithPrior(points, gamesPlayed, totalGames, getTeamPriorPace(teamAbbrev));
}

export interface CutLines {
  divCutLine: number;
  wcCutLine: number;
  /** 4th-place team in the division (first team out of a division spot), or 3rd if no 4th. */
  divBubbleTeamAbbrev: string;
  /** Second wild card (last team in). */
  wc2TeamAbbrev: string;
}

/** Division cut line: average of the 3rd and 4th best model projections in the
 * division, ceil, floored at the historical minimum. */
export function getDivCutLine(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): number {
  return getCutLines(team, standings, totalGames).divCutLine;
}

/** Wildcard cut line: average of the 2nd and 3rd best model projections among
 * conference teams outside their division's projected top 3, ceil, floored at
 * the historical minimum. */
export function getWcCutLine(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): number {
  return getCutLines(team, standings, totalGames).wcCutLine;
}

// Cut lines rank teams by model projection, not the current standings order:
// on opening night (all 0-0-0) the standings order is arbitrary, and late in
// the season the two orders agree. Backtested neutral-to-better on 2023-24
// through 2025-26. The bubble-team labels still follow the NHL's official
// divisionSequence/wildcardSequence so they match the standings table.
export function getCutLines(
  team: StandingsTeam,
  standings: StandingsTeam[],
  totalGames: number = getCurrentSeasonGameCount()
): CutLines {
  return cutLinesFromProjections(
    team,
    standings,
    t => getModelProjectedPoints(t.points, t.gamesPlayed, t.teamAbbrev.default, totalGames),
    totalGames
  );
}

/** Cut lines for any projection of final points; the preseason odds pass
 * last season's regressed pace so they match the live model at zero games. */
export function cutLinesFromProjections(
  team: StandingsTeam,
  standings: StandingsTeam[],
  project: (t: StandingsTeam) => number,
  totalGames: number
): CutLines {
  const byProjection = (ts: StandingsTeam[]) => [...ts].sort((a, b) => project(b) - project(a));
  const midpoint = (ranked: StandingsTeam[], i: number, floor: number) => {
    if (ranked.length > i + 1) return Math.max(Math.ceil((project(ranked[i]) + project(ranked[i + 1])) / 2), floor);
    if (ranked.length > i) return Math.max(Math.ceil(project(ranked[i])), floor);
    return floor;
  };

  // --- Division ---
  const divTeams = standings.filter(t => t.divisionName === team.divisionName);
  const divCutLine = midpoint(byProjection(divTeams), 2, DIV_HISTORICAL_FLOOR(totalGames));
  const divBySequence = [...divTeams].sort((a, b) => a.divisionSequence - b.divisionSequence || b.points - a.points);
  const divBubbleTeamAbbrev = (divBySequence[3] ?? divBySequence[2])?.teamAbbrev.default ?? '';

  // --- Wild card ---
  const confTeams = standings.filter(t => t.conferenceName === team.conferenceName);
  const projectedDivLeaders = new Set(
    [...new Set(confTeams.map(t => t.divisionName))].flatMap(d =>
      byProjection(confTeams.filter(t => t.divisionName === d)).slice(0, 3))
  );
  const wcCutLine = midpoint(byProjection(confTeams.filter(t => !projectedDivLeaders.has(t))), 1, WC_HISTORICAL_FLOOR(totalGames));
  const wc2Team = confTeams
    .filter(t => t.divisionSequence > 3)
    .sort((a, b) => a.wildcardSequence - b.wildcardSequence || b.points - a.points)[1];

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
  const projected = getModelProjectedPoints(team.points, team.gamesPlayed, team.teamAbbrev.default, totalGames);
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
  const projected = getModelProjectedPoints(points, gamesPlayed, team.teamAbbrev.default);
  const inPlayoffs = isInPlayoffPosition(team);
  const { probability } = computePositionAwareProbability(
    projected, gamesPlayed, divCutLine, wcCutLine, inPlayoffs, team.clinchIndicator
  );
  return probability;
}
