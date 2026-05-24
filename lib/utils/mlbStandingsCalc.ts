import type { MLBStandingsTeam } from '@/lib/types/mlb';

const TOTAL_GAMES = 162;
const DIV_HISTORICAL_FLOOR = 88;
const WC_HISTORICAL_FLOOR = 84;

export function getMLBProjectedWins(wins: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((wins / gamesPlayed) * TOTAL_GAMES);
}

export function getMLBDivCutLine(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): number {
  const divTeams = standings
    .filter(t => t.division === team.division)
    .sort((a, b) => b.wins - a.wins);

  const winner = divTeams[0];
  const second = divTeams[1];

  let cutLine: number;
  if (winner && second && winner.wins + winner.losses > 0 && second.wins + second.losses > 0) {
    const winnerProjected = (winner.wins / (winner.wins + winner.losses)) * TOTAL_GAMES;
    const secondProjected = (second.wins / (second.wins + second.losses)) * TOTAL_GAMES;
    cutLine = Math.ceil((winnerProjected + secondProjected) / 2);
  } else if (winner && winner.wins + winner.losses > 0) {
    cutLine = Math.ceil((winner.wins / (winner.wins + winner.losses)) * TOTAL_GAMES);
  } else {
    cutLine = DIV_HISTORICAL_FLOOR;
  }
  return Math.max(cutLine, DIV_HISTORICAL_FLOOR);
}

export function getMLBWildCardCutLine(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): number {
  const leagueTeams = standings.filter(t => t.league === team.league);
  const divisionWinners = new Set<string>();
  const divisions = Array.from(new Set(leagueTeams.map(t => t.division)));
  for (const div of divisions) {
    const top = leagueTeams
      .filter(t => t.division === div)
      .sort((a, b) => b.wins - a.wins)[0];
    if (top) divisionWinners.add(top.teamAbbrev);
  }

  const wcContenders = leagueTeams
    .filter(t => !divisionWinners.has(t.teamAbbrev))
    .sort((a, b) => b.wins - a.wins);

  const wc3 = wcContenders[2];
  const wc4 = wcContenders[3];

  let cutLine: number;
  if (wc3 && wc4 && wc3.wins + wc3.losses > 0 && wc4.wins + wc4.losses > 0) {
    const wc3Projected = (wc3.wins / (wc3.wins + wc3.losses)) * TOTAL_GAMES;
    const wc4Projected = (wc4.wins / (wc4.wins + wc4.losses)) * TOTAL_GAMES;
    cutLine = Math.ceil((wc3Projected + wc4Projected) / 2);
  } else if (wc3 && wc3.wins + wc3.losses > 0) {
    cutLine = Math.ceil((wc3.wins / (wc3.wins + wc3.losses)) * TOTAL_GAMES);
  } else {
    cutLine = WC_HISTORICAL_FLOOR;
  }
  return Math.max(cutLine, WC_HISTORICAL_FLOOR);
}

export function isMLBInPlayoffPosition(team: MLBStandingsTeam): boolean {
  if (team.divisionRank === 1) return true;
  return team.wildCardRank !== undefined && team.wildCardRank >= 1 && team.wildCardRank <= 3;
}

export function probabilityForFinalWins(
  finalWins: number,
  gamesPlayed: number,
  cutLine: number,
  pathType: 'division' | 'wildcard' = 'wildcard'
): number {
  const diff = finalWins - cutLine;
  const confidenceFactor = Math.min(gamesPlayed / TOTAL_GAMES, 1);

  // Steepness tuned for win-based scale (vs NHL points scale which is 2x as wide).
  // Division: tighter race once a leader emerges → steeper.
  // Wildcard: more competitors, more volatile → flatter.
  const k = pathType === 'division'
    ? 0.30 + (confidenceFactor * 0.35) // 0.30–0.65
    : 0.22 + (confidenceFactor * 0.28); // 0.22–0.50

  const probability = 100 / (1 + Math.exp(-k * diff));
  return Math.max(1, Math.min(99, Math.round(probability)));
}

export function getMLBPlayoffProbability(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): {
  probability: number;
  projectedWins: number;
  divCutLine: number;
  wcCutLine: number;
  activePath: 'division' | 'wildcard';
} {
  const gamesPlayed = team.wins + team.losses;
  const projectedWins = getMLBProjectedWins(team.wins, gamesPlayed);
  const divCutLine = getMLBDivCutLine(team, standings);
  const wcCutLine = getMLBWildCardCutLine(team, standings);

  if (gamesPlayed < 10) {
    return { probability: 50, projectedWins, divCutLine, wcCutLine, activePath: 'division' };
  }

  // Mathematical elimination check: if remaining wins can't reach the lower of the two cut lines
  const gamesRemaining = TOTAL_GAMES - gamesPlayed;
  const maxFinalWins = team.wins + gamesRemaining;
  const minCutLine = Math.min(divCutLine, wcCutLine);
  if (maxFinalWins < minCutLine) {
    return { probability: 0, projectedWins, divCutLine, wcCutLine, activePath: 'wildcard' };
  }

  // Position bonus for teams currently holding a playoff spot
  let positionBonus = 0;
  if (isMLBInPlayoffPosition(team) && gamesPlayed >= 40) {
    const seasonProgress = Math.min(gamesPlayed / TOTAL_GAMES, 1);
    positionBonus = 2 * seasonProgress;
  }

  const divProb = probabilityForFinalWins(projectedWins, gamesPlayed, divCutLine - positionBonus, 'division');
  const wcProb = probabilityForFinalWins(projectedWins, gamesPlayed, wcCutLine - positionBonus, 'wildcard');

  const probability = Math.max(divProb, wcProb);
  const activePath = divProb >= wcProb ? 'division' : 'wildcard';

  return { probability, projectedWins, divCutLine, wcCutLine, activePath };
}

export function getMLBPlayoffStatusMessage(probability: number, gamesPlayed: number): string {
  if (gamesPlayed < 10) return 'Season just getting started';
  if (probability >= 95) return 'Clinch in sight';
  if (probability >= 80) return 'Strong playoff position';
  if (probability >= 60) return 'On track for playoffs';
  if (probability >= 40) return 'In the playoff hunt';
  if (probability >= 20) return 'Need to pick up the pace';
  if (probability >= 5) return 'Playoff hopes fading';
  return 'Facing long odds';
}
