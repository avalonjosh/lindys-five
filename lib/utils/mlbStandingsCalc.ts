import type { MLBStandingsTeam } from '@/lib/types/mlb';

// 162-game regular season
const TOTAL_GAMES = 162;
// Bill James' refined Pythagorean exponent for MLB (better than the classic 2.0)
const PYTHAGOREAN_EXPONENT = 1.83;
// Regression-to-mean prior strength, expressed as "phantom games at .500"
// 70 games is a moderate prior — strong enough to anchor early-season noise,
// weak enough to let real talent emerge by mid-season.
const PRIOR_STRENGTH = 70;

/**
 * Abramowitz & Stegun 26.2.17 approximation of the standard normal CDF.
 * Error < 7.5e-8, fast, no external dependencies.
 */
function normalCdf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

export function getMLBProjectedWins(wins: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((wins / gamesPlayed) * TOTAL_GAMES);
}

/**
 * Pythagorean expected win percentage from runs scored and runs allowed.
 * Better predictor of future performance than raw W-L record, especially
 * for teams that have been lucky or unlucky in close games.
 */
function pythagoreanWinPct(runsScored: number, runsAllowed: number): number {
  if (runsScored <= 0 && runsAllowed <= 0) return 0.500;
  if (runsAllowed <= 0) return 1.000;
  if (runsScored <= 0) return 0.000;
  const rsE = Math.pow(runsScored, PYTHAGOREAN_EXPONENT);
  const raE = Math.pow(runsAllowed, PYTHAGOREAN_EXPONENT);
  return rsE / (rsE + raE);
}

/**
 * Estimate a team's true-talent win percentage by blending:
 *   1. Observed win rate (luck-inclusive)
 *   2. Pythagorean expectation (luck-adjusted, run-based)
 *   3. League mean of .500 (regression-to-mean prior)
 * The prior weakens as more games are played.
 */
function estimateTrueTalent(team: MLBStandingsTeam): number {
  const gamesPlayed = team.wins + team.losses;
  if (gamesPlayed === 0) return 0.500;
  const currentRate = team.wins / gamesPlayed;
  const pythag = pythagoreanWinPct(team.runsScored, team.runsAllowed);
  // 50/50 between observed and Pythagorean — Pythagorean is more predictive
  // but observed captures one-run-game performance, bullpen strength, etc.
  const observed = 0.5 * currentRate + 0.5 * pythag;
  // Bayesian update with prior centered at .500, strength = PRIOR_STRENGTH games
  const weight = gamesPlayed / (gamesPlayed + PRIOR_STRENGTH);
  return weight * observed + (1 - weight) * 0.500;
}

interface WinsDistribution {
  mean: number;
  variance: number;
}

/**
 * Project a team's final regular-season win count as a normal distribution
 * over their estimated true talent and remaining games. Variance comes from
 * the binomial approximation: σ² = n·p·(1-p) over remaining games.
 */
function projectFinalWins(team: MLBStandingsTeam): WinsDistribution {
  const gamesPlayed = team.wins + team.losses;
  const gamesRemaining = Math.max(0, TOTAL_GAMES - gamesPlayed);
  const talent = estimateTrueTalent(team);
  const futureMean = gamesRemaining * talent;
  const futureVariance = gamesRemaining * talent * (1 - talent);
  return { mean: team.wins + futureMean, variance: futureVariance };
}

/**
 * Probability that team's final wins exceed rival's final wins, treating both
 * as independent normal distributions. The difference of two normals is normal
 * with mean = μ_t - μ_r and variance = σ²_t + σ²_r.
 */
function probTeamBeatsRival(team: MLBStandingsTeam, rival: MLBStandingsTeam): number {
  const t = projectFinalWins(team);
  const r = projectFinalWins(rival);
  const diffMean = t.mean - r.mean;
  const diffStd = Math.sqrt(t.variance + r.variance);
  if (diffStd < 1e-6) return diffMean > 0 ? 1.0 : diffMean < 0 ? 0.0 : 0.5;
  return normalCdf(diffMean / diffStd);
}

/**
 * Find the team's most relevant division rival (used for cut-line display):
 *   - If team is leader: rival is 2nd place (the chaser they need to hold off)
 *   - Otherwise: rival is the current leader (the team they need to catch)
 */
function findDivisionRival(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): MLBStandingsTeam | null {
  const divTeams = standings
    .filter(t => t.division === team.division)
    .sort((a, b) => b.wins - a.wins);
  if (divTeams.length < 2) return null;
  const isLeader = divTeams[0].teamAbbrev === team.teamAbbrev;
  return isLeader ? divTeams[1] : divTeams[0];
}

/**
 * Probability the team wins their division: the joint probability of beating
 * every other team in the division. Computed as a product of independent
 * pairwise probabilities — an approximation since rest-of-season outcomes are
 * mildly correlated, but much better than comparing to a single rival
 * (which would massively over-credit teams in crowded divisions).
 */
function probWinsDivision(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): number {
  const rivals = standings.filter(t => t.division === team.division && t.teamAbbrev !== team.teamAbbrev);
  if (rivals.length === 0) return 0.5;
  let prob = 1;
  for (const rival of rivals) {
    prob *= probTeamBeatsRival(team, rival);
  }
  return prob;
}

/**
 * Find the team's wild-card bubble rival:
 *   - If team is currently in WC top 3: rival is WC4 (closest chaser)
 *   - Otherwise: rival is WC3 (the team they need to displace)
 */
function findWildCardRival(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): MLBStandingsTeam | null {
  const leagueTeams = standings.filter(t => t.league === team.league);
  const divisions = Array.from(new Set(leagueTeams.map(t => t.division)));
  const divWinners = new Set(
    divisions
      .map(d => leagueTeams.filter(t => t.division === d).sort((a, b) => b.wins - a.wins)[0])
      .filter((t): t is MLBStandingsTeam => !!t)
      .map(t => t.teamAbbrev)
  );
  const wcContenders = leagueTeams
    .filter(t => !divWinners.has(t.teamAbbrev))
    .sort((a, b) => b.wins - a.wins);
  const idx = wcContenders.findIndex(t => t.teamAbbrev === team.teamAbbrev);
  if (idx < 0) return null;
  return idx <= 2 ? (wcContenders[3] || null) : (wcContenders[2] || null);
}

export function getMLBDivCutLine(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): number {
  const rival = findDivisionRival(team, standings);
  if (!rival) return 88;
  return Math.round(projectFinalWins(rival).mean);
}

export function getMLBWildCardCutLine(team: MLBStandingsTeam, standings: MLBStandingsTeam[]): number {
  const rival = findWildCardRival(team, standings);
  if (!rival) return 84;
  return Math.round(projectFinalWins(rival).mean);
}

export function isMLBInPlayoffPosition(team: MLBStandingsTeam): boolean {
  if (team.divisionRank === 1) return true;
  return team.wildCardRank !== undefined && team.wildCardRank >= 1 && team.wildCardRank <= 3;
}

/**
 * For the breakdown table: probability that a team finishing with `finalWins`
 * would beat the cut line. Treats finalWins as a fixed conditional and only
 * accounts for the bubble team's variance (since finalWins is the conditional).
 *
 * Bubble variance is approximated from cutLine itself: a bubble team projected
 * to win at cutLine/162 over the same remaining games. Slightly less precise
 * than passing the bubble's full distribution, but keeps the breakdown table's
 * API simple.
 */
export function probabilityForFinalWins(
  finalWins: number,
  gamesPlayed: number,
  cutLine: number,
  // path kept for backwards compatibility with the call site; not used here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pathType: 'division' | 'wildcard' = 'wildcard',
): number {
  const gamesRemaining = Math.max(0, TOTAL_GAMES - gamesPlayed);
  if (gamesRemaining === 0) {
    return finalWins >= cutLine ? 99 : 1;
  }
  const cutLineTalent = Math.max(0.30, Math.min(0.70, cutLine / TOTAL_GAMES));
  const cutLineVariance = gamesRemaining * cutLineTalent * (1 - cutLineTalent);
  const cutLineStd = Math.sqrt(cutLineVariance);
  const diff = finalWins - cutLine;
  if (cutLineStd < 1e-6) return diff > 0 ? 99 : diff < 0 ? 1 : 50;
  const prob = Math.round(100 * normalCdf(diff / cutLineStd));
  return Math.max(1, Math.min(99, prob));
}

/**
 * Probability that a team will reach (or exceed) a given win total by end of
 * season, given their current performance and remaining games. Uses full
 * variance from projectFinalWins. Used for the "Lindy's Five Target"
 * probability circle in the UI.
 */
export function probabilityOfReachingTotal(targetWins: number, team: MLBStandingsTeam): number {
  const dist = projectFinalWins(team);
  const std = Math.sqrt(dist.variance);
  if (std < 1e-6) return dist.mean >= targetWins ? 99 : 1;
  const prob = 1 - normalCdf((targetWins - dist.mean) / std);
  return Math.max(1, Math.min(99, Math.round(100 * prob)));
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

  // Authoritative clinch/elimination from the MLB API takes precedence
  if (team.divisionChamp || team.clinched) {
    return { probability: 100, projectedWins, divCutLine, wcCutLine, activePath: 'division' };
  }
  if (team.eliminationNumber === 'E' && team.wildCardEliminationNumber === 'E') {
    return { probability: 0, projectedWins, divCutLine, wcCutLine, activePath: 'wildcard' };
  }

  if (gamesPlayed < 10) {
    return { probability: 50, projectedWins, divCutLine, wcCutLine, activePath: 'division' };
  }

  const wcRival = findWildCardRival(team, standings);
  const divProb = probWinsDivision(team, standings);
  const wcProb = wcRival ? probTeamBeatsRival(team, wcRival) : 0.5;

  const rawProb = Math.max(divProb, wcProb);
  // Clamp to [1, 99] so we never display 0% or 100% without API confirmation
  const probability = Math.max(1, Math.min(99, Math.round(100 * rawProb)));
  const activePath: 'division' | 'wildcard' = divProb >= wcProb ? 'division' : 'wildcard';

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
