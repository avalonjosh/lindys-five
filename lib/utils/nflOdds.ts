/**
 * NFL playoff odds. Each team gets a rating in points per game (margin of
 * victory adjusted for opponents, a simple rating system), blended with a share
 * of last season's rating that fades as games are played. Remaining games are
 * simulated with a normal margin model and home field, then each conference is
 * seeded the NFL way: 4 division winners (seeds 1-4) plus 3 wild cards.
 *
 * Tiebreakers are approximated (win %, then a coin flip weighted by rating),
 * so odds are estimates. Backtest before changing a constant:
 *   npx tsx scripts/backtest-nfl-odds.ts
 */

export const NFL_DIVISIONS: Record<string, string[]> = {
  'AFC East': ['BUF', 'MIA', 'NE', 'NYJ'],
  'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
  'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
  'AFC West': ['DEN', 'KC', 'LV', 'LAC'],
  'NFC East': ['DAL', 'NYG', 'PHI', 'WSH'],
  'NFC North': ['CHI', 'DET', 'GB', 'MIN'],
  'NFC South': ['ATL', 'CAR', 'NO', 'TB'],
  'NFC West': ['ARI', 'LAR', 'SF', 'SEA'],
};
export const NFL_DIVISION_OF = new Map(Object.entries(NFL_DIVISIONS).flatMap(([d, teams]) => teams.map((t) => [t, d])));
export const NFL_CONFERENCE_OF = (abbr: string) => (NFL_DIVISION_OF.get(abbr) || '').slice(0, 3);

// Backtest 2021-25 (5 seasons x weeks 3/6/9/12/15): Brier 0.1309 vs 0.2461 for
// the base rate. Heavy shrinkage wins (records overstate talent early), and
// a small carryover helps most at week 3.
/** Games of prior-season weight in a team's rating. */
export const NFL_PRIOR_GAMES = 14;
/** Share of last season's rating carried into this one. */
export const NFL_CARRYOVER = 0.1;
/** Home-field edge in points. */
export const NFL_HFA = 2;
/** Standard deviation of a game's margin around the rating difference. */
export const NFL_SIGMA = 13.5;

export interface NFLGame {
  week: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  final: boolean;
  neutral: boolean;
}

export interface NFLOddsParams {
  priorGames: number;
  carryover: number;
  hfa: number;
  sigma: number;
}

export const NFL_DEFAULT_PARAMS: NFLOddsParams = {
  priorGames: NFL_PRIOR_GAMES,
  carryover: NFL_CARRYOVER,
  hfa: NFL_HFA,
  sigma: NFL_SIGMA,
};

/** Opponent-adjusted margin rating from final games (home field removed). */
export function simpleRatings(games: NFLGame[], hfa: number): Map<string, number> {
  const played = games.filter((g) => g.final);
  const teams = new Set<string>();
  for (const g of played) {
    teams.add(g.home);
    teams.add(g.away);
  }
  const r = new Map<string, number>([...teams].map((t) => [t, 0]));
  for (let iter = 0; iter < 30; iter++) {
    const sum = new Map<string, number>();
    const n = new Map<string, number>();
    for (const g of played) {
      const edge = g.neutral ? 0 : hfa;
      const margin = g.homeScore - g.awayScore - edge;
      sum.set(g.home, (sum.get(g.home) || 0) + margin + (r.get(g.away) || 0));
      sum.set(g.away, (sum.get(g.away) || 0) - margin + (r.get(g.home) || 0));
      n.set(g.home, (n.get(g.home) || 0) + 1);
      n.set(g.away, (n.get(g.away) || 0) + 1);
    }
    let mean = 0;
    for (const t of teams) {
      r.set(t, (sum.get(t) || 0) / (n.get(t) || 1));
      mean += r.get(t)!;
    }
    mean /= teams.size || 1;
    for (const t of teams) r.set(t, r.get(t)! - mean);
  }
  return r;
}

/** This season's rating blended with last season's (regressed) by games played. */
export function blendedRatings(
  games: NFLGame[],
  prior: Map<string, number>,
  params: NFLOddsParams = NFL_DEFAULT_PARAMS,
): Map<string, number> {
  const current = simpleRatings(games, params.hfa);
  const played = new Map<string, number>();
  for (const g of games) {
    if (!g.final) continue;
    played.set(g.home, (played.get(g.home) || 0) + 1);
    played.set(g.away, (played.get(g.away) || 0) + 1);
  }
  const out = new Map<string, number>();
  for (const t of NFL_DIVISION_OF.keys()) {
    const n = played.get(t) || 0;
    const p = (prior.get(t) || 0) * params.carryover;
    const c = current.get(t) || 0;
    out.set(t, (c * n + p * params.priorGames) / (n + params.priorGames));
  }
  return out;
}

// Abramowitz-Stegun erf, plenty accurate for win probabilities.
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 + y / 2 : 0.5 - y / 2;
}

export function homeWinProb(rHome: number, rAway: number, neutral: boolean, params: NFLOddsParams = NFL_DEFAULT_PARAMS): number {
  return normalCdf((rHome - rAway + (neutral ? 0 : params.hfa)) / params.sigma);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NFLTeamOdds {
  abbr: string;
  playoff: number;
  division: number;
  topSeed: number;
  projWins: number;
}

/**
 * Simulate the rest of the season. Deterministic for a given seed so the
 * numbers don't jitter between page renders.
 */
export function simulateSeason(
  games: NFLGame[],
  ratings: Map<string, number>,
  params: NFLOddsParams = NFL_DEFAULT_PARAMS,
  sims = 10000,
  seed = 20260928,
): Map<string, NFLTeamOdds> {
  const teams = [...NFL_DIVISION_OF.keys()];
  const baseWins = new Map<string, number>(teams.map((t) => [t, 0]));
  const baseGames = new Map<string, number>(teams.map((t) => [t, 0]));
  const remaining: { home: string; away: string; p: number }[] = [];
  for (const g of games) {
    if (g.final) {
      baseGames.set(g.home, (baseGames.get(g.home) || 0) + 1);
      baseGames.set(g.away, (baseGames.get(g.away) || 0) + 1);
      if (g.homeScore > g.awayScore) baseWins.set(g.home, (baseWins.get(g.home) || 0) + 1);
      else if (g.awayScore > g.homeScore) baseWins.set(g.away, (baseWins.get(g.away) || 0) + 1);
      else {
        baseWins.set(g.home, (baseWins.get(g.home) || 0) + 0.5);
        baseWins.set(g.away, (baseWins.get(g.away) || 0) + 0.5);
      }
    } else {
      remaining.push({ home: g.home, away: g.away, p: homeWinProb(ratings.get(g.home) || 0, ratings.get(g.away) || 0, g.neutral, params) });
    }
  }

  const rand = mulberry32(seed);
  const tally = new Map<string, { playoff: number; division: number; topSeed: number; wins: number }>(
    teams.map((t) => [t, { playoff: 0, division: 0, topSeed: 0, wins: 0 }]),
  );
  const wins = new Map<string, number>();
  const key = new Map<string, number>();

  for (let s = 0; s < sims; s++) {
    for (const t of teams) wins.set(t, baseWins.get(t)!);
    for (const g of remaining) {
      if (rand() < g.p) wins.set(g.home, wins.get(g.home)! + 1);
      else wins.set(g.away, wins.get(g.away)! + 1);
    }
    // Rank key: wins, then a rating-weighted coin flip standing in for tiebreakers.
    for (const t of teams) key.set(t, wins.get(t)! + 0.001 * ((ratings.get(t) || 0) / 10 + rand()));
    for (const conf of ['AFC', 'NFC']) {
      const divWinners: string[] = [];
      for (const [div, members] of Object.entries(NFL_DIVISIONS)) {
        if (!div.startsWith(conf)) continue;
        divWinners.push(members.reduce((best, t) => (key.get(t)! > key.get(best)! ? t : best)));
      }
      divWinners.sort((a, b) => key.get(b)! - key.get(a)!);
      const wildcards = teams
        .filter((t) => NFL_CONFERENCE_OF(t) === conf && !divWinners.includes(t))
        .sort((a, b) => key.get(b)! - key.get(a)!)
        .slice(0, 3);
      for (const t of divWinners) {
        tally.get(t)!.division++;
        tally.get(t)!.playoff++;
      }
      for (const t of wildcards) tally.get(t)!.playoff++;
      tally.get(divWinners[0])!.topSeed++;
    }
    for (const t of teams) tally.get(t)!.wins += wins.get(t)!;
  }

  const out = new Map<string, NFLTeamOdds>();
  for (const t of teams) {
    const x = tally.get(t)!;
    out.set(t, {
      abbr: t,
      playoff: (100 * x.playoff) / sims,
      division: (100 * x.division) / sims,
      topSeed: (100 * x.topSeed) / sims,
      projWins: x.wins / sims,
    });
  }
  return out;
}
