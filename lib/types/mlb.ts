export interface MLBGameResult {
  date: string;
  startTime?: string;
  opponent: string;
  opponentLogo: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  outcome: 'W' | 'L' | 'PENDING';
  gameState: string;
  gameId?: number;
  inning?: number;
  inningHalf?: 'Top' | 'Bot';
}

export interface MLBGameChunk {
  chunkNumber: number;
  games: MLBGameResult[];
  totalGames: number;
  wins: number;
  losses: number;
  isComplete: boolean;
}

export interface MLBSeasonStats {
  totalWins: number;
  totalLosses: number;
  gamesPlayed: number;
  gamesRemaining: number;
  totalGames: number;
  winPct: number;
  projectedWins: number;
  playoffTarget: number;
  winsAboveBelow: number;
}

export interface MLBScoreGame {
  gameId: number;
  gameState: string;
  startTime?: string;
  awayTeam: { abbrev: string; name: string; logo: string; score: number; wins?: number; losses?: number };
  homeTeam: { abbrev: string; name: string; logo: string; score: number; wins?: number; losses?: number };
  inning?: number;
  inningHalf?: 'Top' | 'Bot';
  tvNetworks?: string;
}

export interface MLBBoxScoreData {
  gameId: number;
  status: string;
  venue: string;
  dateTime: string;
  awayTeam: { id: number; abbreviation: string; teamName: string; logo: string; probablePitcherId?: number };
  homeTeam: { id: number; abbreviation: string; teamName: string; logo: string; probablePitcherId?: number };
  linescore: {
    innings: { num: number; away: { runs: number }; home: { runs: number } }[];
    away: { runs: number; hits: number; errors: number };
    home: { runs: number; hits: number; errors: number };
  };
  currentInning?: number;
  inningHalf?: string;
  batters: {
    away: MLBBatterLine[];
    home: MLBBatterLine[];
  };
  pitchers: {
    away: MLBPitcherLine[];
    home: MLBPitcherLine[];
  };
  scoringPlays: MLBScoringPlay[];
}

export interface MLBBatterLine {
  name: string;
  position: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  avg: string;
}

export interface MLBPitcherLine {
  name: string;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  era: string;
  decision?: string; // W, L, S, H
}

export interface MLBScoringPlay {
  inning: number;
  halfInning: string;
  description: string;
  awayScore: number;
  homeScore: number;
}

export interface MLBPitcherPreview {
  id: number;
  name: string;
  era: string;
  wins: number;
  losses: number;
  ip: string;
  so: number;
  whip: string;
}

export interface MLBTeamSeasonStats {
  batting: { avg: string; ops: string; hr: number; runsPerGame: string };
  pitching: { era: string; whip: string; soPerNine: string };
}

export interface MLBRecentGame {
  date: string;
  opponent: string;
  won: boolean;
  teamScore: number;
  oppScore: number;
}

export interface MLBSeriesRecord {
  wins: number;
  losses: number;
  games: { date: string; awayScore: number; homeScore: number; awayAbbrev: string; homeAbbrev: string }[];
}

export interface MLBStandingsTeam {
  teamId: number;
  teamAbbrev: string;
  teamName: string;
  teamLogo: string;
  wins: number;
  losses: number;
  winPct: number;
  gamesBack: number;
  streak: string;
  last10: string;
  homeRecord: string;
  awayRecord: string;
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
  wildCardGamesBack: number;
  expectedWins: number;
  expectedLosses: number;
  division: string;
  league: string;
  divisionRank: number;
  wildCardRank?: number;
}
