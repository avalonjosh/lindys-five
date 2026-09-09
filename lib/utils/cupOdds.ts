import type { StandingsTeam } from '@/lib/types/boxscore';
import type { PlayoffBracketResponse, PlayoffSeries, StanleyCupOddsEntry } from '@/lib/types/playoffs';
import { seriesWinProbabilityRaw, seriesOptionsFor } from '@/lib/utils/playoffProbability';

// Bracket-aware Stanley Cup odds.
//
// The NHL bracket is a fixed tree: series letters A-H (round 1) feed I-L
// (round 2) in pairs (A+B → I, C+D → J, ...), I-L feed M-N, and M+N feed the
// Final (O). Given that structure, the probability a team wins any series is
//
//   P(win node) = P(reach node) × Σ_opp P(opp reaches node from the other side) × P(beat opp)
//
// with P(reach) = P(win the feeder series). The two feeders are disjoint
// subtrees, so the terms are independent and the sum is a proper mixture over
// every possible opponent. No "average playoff opponent" assumption is needed,
// and every stage's odds sum to exactly the number of survivors of that stage
// (the Cup odds sum to 100% across the field).
//
// Series in progress use their actual game count; future series start 0-0 with
// home ice going to the team with the better regular-season record.

interface TeamInfo {
  abbrev: string;
  name: string;
  logo: string;
  seed: number;
  conferenceName: string;
  standing?: StandingsTeam;
  /** Round-1 node index (0-7); the team's path through the tree follows from it. */
  r1Index: number;
}

interface Node {
  round: number;
  index: number;
  series?: PlayoffSeries;
  topAbbrev?: string;
  bottomAbbrev?: string;
  topWins: number;
  bottomWins: number;
  feeders: [Node, Node] | null;
  /** P(team plays in this series) */
  reach: Map<string, number>;
  /** P(team wins this series) */
  win: Map<string, number>;
}

const ROUND_SIZES = [8, 4, 2, 1];

function letterIndex(series: PlayoffSeries, roundNumber: number, fallback: number): number {
  const letter = series.seriesLetter?.toUpperCase();
  if (!letter || letter.length !== 1) return fallback;
  // A-H → 0-7, I-L → 0-3, M-N → 0-1, O → 0
  const roundStart = [0, 8, 12, 14][roundNumber - 1] ?? 0;
  const idx = letter.charCodeAt(0) - 65 - roundStart;
  return idx >= 0 && idx < ROUND_SIZES[roundNumber - 1] ? idx : fallback;
}

/** Which team hosts games 1, 2, 5, 7 of a future series. */
function hasHomeIce(a: StandingsTeam | undefined, b: StandingsTeam | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  if (a.points !== b.points) return a.points > b.points;
  if (a.pointPctg !== b.pointPctg) return a.pointPctg > b.pointPctg;
  return (a.regulationWins || 0) >= (b.regulationWins || 0);
}

export function buildCupOdds(
  bracket: PlayoffBracketResponse,
  standingsMap: Map<string, StandingsTeam>
): StanleyCupOddsEntry[] {
  // ── Build the tree ──
  const nodes: Node[][] = ROUND_SIZES.map((size, r) =>
    Array.from({ length: size }, (_, i) => ({
      round: r + 1,
      index: i,
      topWins: 0,
      bottomWins: 0,
      feeders: null,
      reach: new Map(),
      win: new Map(),
    }))
  );
  for (let r = 1; r < 4; r++) {
    for (const node of nodes[r]) {
      node.feeders = [nodes[r - 1][node.index * 2], nodes[r - 1][node.index * 2 + 1]];
    }
  }

  const teams = new Map<string, TeamInfo>();

  for (const round of bracket.rounds || []) {
    const r = round.roundNumber;
    if (r < 1 || r > 4) continue;
    (round.series || []).forEach((series, i) => {
      const idx = letterIndex(series, r, i);
      const node = nodes[r - 1][idx];
      if (!node) return;
      node.series = series;
      node.topWins = series.topSeedWins || 0;
      node.bottomWins = series.bottomSeedWins || 0;
      for (const mt of series.matchupTeams || []) {
        const abbrev = mt.team.abbrev;
        if (mt.seed?.isTop) node.topAbbrev = abbrev;
        else node.bottomAbbrev = abbrev;
        if (!teams.has(abbrev)) {
          const standing = standingsMap.get(abbrev);
          teams.set(abbrev, {
            abbrev,
            name: mt.team.commonName?.default || mt.team.name?.default || abbrev,
            logo: mt.team.logo,
            seed: mt.seed?.rank || 0,
            conferenceName: standing?.conferenceName || '',
            standing,
            r1Index: r === 1 ? idx : idx * Math.pow(2, r - 1),
          });
        }
      }
    });
  }

  // ── Probability of beating an opponent in a given node ──
  const pairCache = new Map<string, number>();
  function pBeats(node: Node, t: string, o: string): number {
    const key = `${node.round}:${node.index}:${t}:${o}`;
    const cached = pairCache.get(key);
    if (cached !== undefined) return cached;

    const ti = teams.get(t);
    const oi = teams.get(o);
    let tWins = 0;
    let oWins = 0;
    let tHome: boolean;
    if (node.topAbbrev === t && node.bottomAbbrev === o) {
      tWins = node.topWins;
      oWins = node.bottomWins;
      tHome = true;
    } else if (node.topAbbrev === o && node.bottomAbbrev === t) {
      tWins = node.bottomWins;
      oWins = node.topWins;
      tHome = false;
    } else {
      tHome = hasHomeIce(ti?.standing, oi?.standing);
    }

    const p = seriesWinProbabilityRaw(
      ti?.standing?.pointPctg ?? 0.5,
      oi?.standing?.pointPctg ?? 0.5,
      tWins,
      oWins,
      tHome,
      seriesOptionsFor(ti?.standing, oi?.standing)
    );
    pairCache.set(key, p);
    pairCache.set(`${node.round}:${node.index}:${o}:${t}`, 1 - p);
    return p;
  }

  // ── Walk the tree ──
  for (let r = 0; r < 4; r++) {
    for (const node of nodes[r]) {
      let sideA: Map<string, number>;
      let sideB: Map<string, number>;
      if (node.feeders) {
        sideA = node.feeders[0].win;
        sideB = node.feeders[1].win;
      } else {
        sideA = new Map(node.topAbbrev ? [[node.topAbbrev, 1]] : []);
        sideB = new Map(node.bottomAbbrev ? [[node.bottomAbbrev, 1]] : []);
      }
      for (const [t, p] of sideA) if (p > 0) node.reach.set(t, p);
      for (const [t, p] of sideB) if (p > 0) node.reach.set(t, p);

      const compute = (mine: Map<string, number>, theirs: Map<string, number>) => {
        for (const [t, pReach] of mine) {
          if (pReach <= 0) continue;
          let total = 0;
          let oppMass = 0;
          for (const [o, pOpp] of theirs) {
            if (pOpp <= 0) continue;
            oppMass += pOpp;
            total += pOpp * pBeats(node, t, o);
          }
          // If the other side is unknown (no data at all), treat as a coin flip
          // against an unknown opponent rather than a bye.
          const pWin = oppMass > 0 ? total / oppMass : 0.5;
          node.win.set(t, pReach * pWin);
        }
      };
      compute(sideA, sideB);
      compute(sideB, sideA);
    }
  }

  // ── Per-team entries ──
  const entries: StanleyCupOddsEntry[] = [];
  for (const [abbrev, team] of teams) {
    const path = ROUND_SIZES.map((_, r) => nodes[r][Math.floor(team.r1Index / Math.pow(2, r))]);

    // Current round = the last node on the path with real series data that
    // includes this team. Eliminated = lost that series.
    let currentIdx = 0;
    let eliminated = false;
    for (let r = 0; r < 4; r++) {
      const node = path[r];
      const inSeries = node.topAbbrev === abbrev || node.bottomAbbrev === abbrev;
      if (!inSeries) break;
      currentIdx = r;
      const losses = node.topAbbrev === abbrev ? node.bottomWins : node.topWins;
      if (losses >= 4) {
        eliminated = true;
        break;
      }
    }

    const stage = path.map((node) => (node.win.get(abbrev) || 0) * 100);
    const round1 = (v: number) => Math.round(v * 10) / 10;

    if (eliminated) {
      const stageOdds = [0, 0, 0, 0];
      for (let r = 0; r < currentIdx; r++) stageOdds[r] = 100;
      entries.push({
        abbrev, name: team.name, logo: team.logo, seed: team.seed,
        conferenceName: team.conferenceName,
        cupOdds: 0, currentSeriesOdds: 0, isEliminated: true,
        oddsR1: stageOdds[0], oddsR2: stageOdds[1], oddsConf: stageOdds[2], oddsCup: stageOdds[3],
      });
      continue;
    }

    const current = path[currentIdx];
    const reach = current.reach.get(abbrev) || 1;
    const currentSeriesOdds = Math.round(((current.win.get(abbrev) || 0) / reach) * 100);
    // Anything is possible until they're mathematically out: show at least 0.1%.
    const cupOdds = Math.max(round1(stage[3]), 0.1);

    entries.push({
      abbrev, name: team.name, logo: team.logo, seed: team.seed,
      conferenceName: team.conferenceName,
      cupOdds,
      currentSeriesOdds,
      isEliminated: false,
      oddsR1: round1(stage[0]),
      oddsR2: round1(stage[1]),
      oddsConf: round1(stage[2]),
      oddsCup: cupOdds,
    });
  }
  return entries;
}
