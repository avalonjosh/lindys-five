// Types for the NHL Playoff Bracket API (/playoff-bracket/20252026)

export interface PlayoffBracketResponse {
  // The bracket API returns rounds with series matchups
  rounds: PlayoffRound[];
  // Season identifier
  seasonId?: number;
}

export interface PlayoffRound {
  roundNumber: number; // 1 = first round, 2 = second, 3 = conference finals, 4 = Stanley Cup Final
  roundLabel?: string; // "First Round", "Second Round", etc.
  series: PlayoffSeries[];
}

export interface PlayoffSeries {
  seriesLetter: string; // A-H for round 1, I-L for round 2, etc.
  round: { number: number };
  matchupTeams: PlayoffMatchupTeam[];
  // Series status
  topSeedWins: number;
  bottomSeedWins: number;
  // Game results within the series
  games: PlayoffGame[];
}

export interface PlayoffMatchupTeam {
  seed: { type: string; rank: number; isTop: boolean };
  team: {
    id: number;
    abbrev: string;
    name: { default: string };
    commonName: { default: string };
    placeName: { default: string };
    logo: string;
  };
  seriesRecord?: { wins: number; losses: number };
}

export interface PlayoffGame {
  gameId: number;
  gameNumber: number; // 1-7
  gameDate: string;
  gameState: string; // FUT, PRE, LIVE, CRIT, FINAL, OFF
  gameScheduleState?: string; // OK, TBD, PPD
  startTimeUTC?: string;
  ifNecessary?: boolean;
  homeTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
  awayTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
  gameOutcome?: {
    lastPeriodType: string; // REG, OT, 2OT, etc.
  };
}

// Computed types used in the UI
export interface SeriesWithOdds {
  seriesLetter: string;
  roundNumber: number;
  topSeed: SeriesTeam;
  bottomSeed: SeriesTeam;
  topSeedWins: number;
  bottomSeedWins: number;
  games: PlayoffGame[];
  // Computed probability
  topSeedSeriesWinPct: number;
  bottomSeedSeriesWinPct: number;
  isComplete: boolean;
  winningSeed: 'top' | 'bottom' | null;
}

export interface SeriesTeam {
  id: number;
  abbrev: string;
  name: string;
  logo: string;
  seed: number;
  pointPctg: number; // Regular season point percentage (used for strength)
}

export interface StanleyCupOddsEntry {
  abbrev: string;
  name: string;
  logo: string;
  seed: number;
  conferenceName: string;
  cupOdds: number; // 0-100 (alias of oddsCup, kept for backward compat)
  currentSeriesOdds: number; // odds to win current series
  isEliminated: boolean;
  // Cumulative odds of reaching/winning each stage (0-100)
  oddsR1?: number;   // chance of winning Round 1
  oddsR2?: number;   // cumulative: chance of also winning Round 2
  oddsConf?: number; // cumulative: chance of also winning Conference Final
  oddsCup?: number;  // cumulative: chance of winning the Cup (same as cupOdds)
}

export type SeasonPhase = 'regular' | 'postseason-gap' | 'playoffs' | 'offseason';

export interface BracketMatchup {
  seriesLetter: string;
  topSeed: SeriesTeam | null;
  bottomSeed: SeriesTeam | null;
  topSeedWins: number;
  bottomSeedWins: number;
  isComplete: boolean;
  winningSeed: 'top' | 'bottom' | null;
  topSeedSeriesWinPct: number;
  bottomSeedSeriesWinPct: number;
  games: PlayoffGame[];
}

export interface ConferenceBracket {
  conferenceName: string;
  rounds: {
    roundNumber: number;
    matchups: BracketMatchup[];
  }[];
}
