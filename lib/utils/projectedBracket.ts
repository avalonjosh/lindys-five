import type { StandingsTeam } from '@/lib/types/boxscore';
import type { PlayoffMatchupTeam, PlayoffSeries } from '@/lib/types/playoffs';

// Projects the first round of the Stanley Cup Playoffs from regular-season
// standings, in the same shape the live bracket uses (PlayoffSeries with
// letters A-H), so the bracket page and the odds page can run the same series
// and Cup odds code before the real bracket exists.
//
// NHL format, per conference: the division winner with the better record (1)
// hosts the second wild card; the other division winner (2) hosts the first
// wild card; 2nd hosts 3rd within each division. Letters pair A+B and C+D so
// each division's winner meets its own 2-vs-3 winner in round 2, matching the
// NHL's bracket lettering (A+B → I, C+D → J, and so on).

function toMatchupTeam(st: StandingsTeam, rank: number, type: string, isTop: boolean): PlayoffMatchupTeam {
  const name = st.teamName.default;
  const common = st.teamCommonName?.default || name;
  return {
    seed: { type, rank, isTop },
    team: {
      id: 0,
      abbrev: st.teamAbbrev.default,
      name: { default: name },
      commonName: { default: common },
      placeName: { default: name.replace(common, '').trim() || name },
      logo: st.teamLogo,
    },
  };
}

function makeSeries(
  letter: string,
  home: StandingsTeam,
  away: StandingsTeam,
  homeRank: number,
  homeType: string,
  awayRank: number,
  awayType: string
): PlayoffSeries {
  return {
    seriesLetter: letter,
    round: { number: 1 },
    matchupTeams: [
      toMatchupTeam(home, homeRank, homeType, true),
      toMatchupTeam(away, awayRank, awayType, false),
    ],
    topSeedWins: 0,
    bottomSeedWins: 0,
    games: [],
  };
}

export interface ProjectedFirstRound {
  eastern: PlayoffSeries[];
  western: PlayoffSeries[];
  /** All eight series, A-H (East A-D, West E-H). */
  series: PlayoffSeries[];
}

export function buildProjectedFirstRound(standings: StandingsTeam[]): ProjectedFirstRound | null {
  if (standings.length === 0) return null;

  const letters = 'ABCDEFGH';
  let letterIdx = 0;
  const byConference: Record<string, PlayoffSeries[]> = { Eastern: [], Western: [] };

  for (const confName of ['Eastern', 'Western'] as const) {
    const confTeams = standings.filter(t => t.conferenceName === confName);
    if (confTeams.length < 8) return null;

    const divOrder = confName === 'Eastern' ? ['Atlantic', 'Metropolitan'] : ['Central', 'Pacific'];
    const divisionData = divOrder.map(divName => ({
      name: divName,
      teams: confTeams
        .filter(t => t.divisionName === divName)
        .sort((a, b) => a.divisionSequence - b.divisionSequence || b.pointPctg - a.pointPctg),
    }));

    // Better division leader = conference 1 seed
    divisionData.sort((a, b) =>
      (b.teams[0]?.points || 0) - (a.teams[0]?.points || 0) ||
      (b.teams[0]?.pointPctg || 0) - (a.teams[0]?.pointPctg || 0)
    );
    const [divA, divB] = divisionData;

    const wildcards = confTeams
      .filter(t => t.divisionSequence > 3)
      .sort((a, b) => a.wildcardSequence - b.wildcardSequence || b.points - a.points || b.pointPctg - a.pointPctg)
      .slice(0, 2);
    const [wc1, wc2] = wildcards;

    if (!divA?.teams[2] || !divB?.teams[2] || !wc1 || !wc2) return null;

    const series = [
      makeSeries(letters[letterIdx++], divA.teams[0], wc2, 1, 'D1', 4, 'WC2'),
      makeSeries(letters[letterIdx++], divA.teams[1], divA.teams[2], 2, 'D2', 3, 'D3'),
      makeSeries(letters[letterIdx++], divB.teams[0], wc1, 1, 'D1', 4, 'WC1'),
      makeSeries(letters[letterIdx++], divB.teams[1], divB.teams[2], 2, 'D2', 3, 'D3'),
    ];
    byConference[confName] = series;
  }

  return {
    eastern: byConference.Eastern,
    western: byConference.Western,
    series: [...byConference.Eastern, ...byConference.Western],
  };
}
