import type { StandingsTeam } from '@/lib/types/boxscore';
import type { PlayoffBracketResponse, StanleyCupOddsEntry } from '@/lib/types/playoffs';
import { computeSeriesWinProbability } from '@/lib/utils/playoffProbability';

interface TeamStrength {
  goalDiffPerGame?: number;
  homeWinPct?: number;
  roadWinPct?: number;
}

function strengthFor(st: StandingsTeam | undefined): TeamStrength {
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

// V2 model — chains the team's current series win % with projected future-round odds vs an
// average playoff opponent. Mirrors the math used on /playoffs and the team-tracker Win Odds.
export function buildCupOdds(
  bracket: PlayoffBracketResponse,
  standingsMap: Map<string, StandingsTeam>
): StanleyCupOddsEntry[] {
  const entries: StanleyCupOddsEntry[] = [];

  const teamsInBracket = new Map<string, {
    abbrev: string; name: string; logo: string; seed: number;
    ptPctg: number; conferenceName: string; isEliminated: boolean;
    currentSeriesWinPct: number; roundsToWin: number;
    strength: TeamStrength;
  }>();

  for (const round of bracket.rounds || []) {
    for (const series of round.series || []) {
      for (const mt of series.matchupTeams || []) {
        const abbrev = mt.team.abbrev;
        if (teamsInBracket.has(abbrev)) continue;
        const standing = standingsMap.get(abbrev);
        const isTop = mt.seed?.isTop;
        const losses = isTop ? series.bottomSeedWins : series.topSeedWins;
        teamsInBracket.set(abbrev, {
          abbrev,
          name: mt.team.commonName?.default || mt.team.name?.default || abbrev,
          logo: mt.team.logo,
          seed: mt.seed?.rank || 0,
          ptPctg: standing?.pointPctg || 0.5,
          conferenceName: standing?.conferenceName || '',
          isEliminated: losses >= 4,
          currentSeriesWinPct: 50,
          roundsToWin: 5 - round.roundNumber,
          strength: strengthFor(standing),
        });
      }
    }
  }

  for (const round of bracket.rounds || []) {
    for (const series of round.series || []) {
      const topMt = series.matchupTeams?.find(t => t.seed?.isTop);
      const bottomMt = series.matchupTeams?.find(t => !t.seed?.isTop);
      if (!topMt || !bottomMt) continue;
      const topData = teamsInBracket.get(topMt.team.abbrev);
      const bottomData = teamsInBracket.get(bottomMt.team.abbrev);
      if (!topData || !bottomData) continue;
      const topWins = series.topSeedWins || 0;
      const bottomWins = series.bottomSeedWins || 0;
      if (topWins >= 4 || bottomWins >= 4) {
        topData.currentSeriesWinPct = topWins >= 4 ? 100 : 0;
        bottomData.currentSeriesWinPct = bottomWins >= 4 ? 100 : 0;
      } else {
        const topP = computeSeriesWinProbability(
          topData.ptPctg, bottomData.ptPctg, topWins, bottomWins, true,
          {
            teamGoalDiffPerGame: topData.strength.goalDiffPerGame,
            oppGoalDiffPerGame: bottomData.strength.goalDiffPerGame,
            teamHomeWinPct: topData.strength.homeWinPct,
            teamRoadWinPct: topData.strength.roadWinPct,
            oppHomeWinPct: bottomData.strength.homeWinPct,
            oppRoadWinPct: bottomData.strength.roadWinPct,
          }
        );
        topData.currentSeriesWinPct = topP;
        bottomData.currentSeriesWinPct = 100 - topP;
      }
    }
  }

  for (const [, team] of teamsInBracket) {
    if (team.isEliminated) {
      entries.push({
        abbrev: team.abbrev, name: team.name, logo: team.logo, seed: team.seed,
        conferenceName: team.conferenceName, cupOdds: 0, currentSeriesOdds: 0, isEliminated: true,
        oddsR1: 0, oddsR2: 0, oddsConf: 0, oddsCup: 0,
      });
      continue;
    }

    const currentRoundIdx = 5 - team.roundsToWin;
    const stageOdds: number[] = [0, 0, 0, 0];

    for (let stage = 1; stage < currentRoundIdx; stage++) {
      stageOdds[stage - 1] = 100;
    }
    stageOdds[currentRoundIdx - 1] = team.currentSeriesWinPct;

    // Future rounds: chain vs an average playoff opponent (above-league-average by definition).
    // Bumped slightly above pure playoff averages to compress favorites' chained projections —
    // small per-round adjustments compound over 3 future rounds, and the prior values left top
    // contenders 5-8 pts higher than felt right at a glance.
    const PLAYOFF_OPP_PT_PCTG = 0.640;
    const PLAYOFF_OPP_GOAL_DIFF = 0.25;
    const PLAYOFF_OPP_HOME_WIN_PCT = 0.55;
    const PLAYOFF_OPP_ROAD_WIN_PCT = 0.45;
    let running = team.currentSeriesWinPct / 100;
    for (let stage = currentRoundIdx + 1; stage <= 4; stage++) {
      const p = computeSeriesWinProbability(
        team.ptPctg, PLAYOFF_OPP_PT_PCTG, 0, 0, team.seed <= 4,
        {
          teamGoalDiffPerGame: team.strength.goalDiffPerGame,
          oppGoalDiffPerGame: PLAYOFF_OPP_GOAL_DIFF,
          teamHomeWinPct: team.strength.homeWinPct,
          teamRoadWinPct: team.strength.roadWinPct,
          oppHomeWinPct: PLAYOFF_OPP_HOME_WIN_PCT,
          oppRoadWinPct: PLAYOFF_OPP_ROAD_WIN_PCT,
        }
      );
      running *= p / 100;
      stageOdds[stage - 1] = running * 100;
    }

    // Floor non-eliminated teams at 1% — anything is possible until they're mathematically out.
    const rawCupOdds = Math.round(stageOdds[3] * 10) / 10;
    const cupOdds = Math.max(rawCupOdds, 1);
    entries.push({
      abbrev: team.abbrev, name: team.name, logo: team.logo, seed: team.seed,
      conferenceName: team.conferenceName,
      cupOdds,
      currentSeriesOdds: Math.round(team.currentSeriesWinPct),
      isEliminated: false,
      oddsR1: Math.round(stageOdds[0] * 10) / 10,
      oddsR2: Math.round(stageOdds[1] * 10) / 10,
      oddsConf: Math.round(stageOdds[2] * 10) / 10,
      oddsCup: cupOdds,
    });
  }
  return entries;
}
