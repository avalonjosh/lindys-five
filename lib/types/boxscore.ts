// Types for NHL Boxscore and Landing API responses

export interface BoxscorePlayer {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: string; // "C", "L", "R", "D", "G"
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  sog: number;
  hits: number;
  blockedShots: number;
  powerPlayGoals: number;
  shorthandedGoals?: number;
  faceoffWinningPctg?: number;
  toi: string; // "MM:SS"
}

export interface BoxscoreGoalie {
  playerId: number;
  sweaterNumber: number;
  name: { default: string };
  position: string;
  evenStrengthShotsAgainst: string; // "SA-SV"
  powerPlayShotsAgainst: string;
  shorthandedShotsAgainst: string;
  saveShotsAgainst: string; // "SV-SA" total
  savePctg?: number;
  goalsAgainst: number;
  shotsAgainst?: number;
  saves?: number;
  toi: string;
  decision?: string; // "W", "L", "O"
}

export interface BoxscoreTeam {
  id: number;
  abbrev: string;
  score: number;
  sog: number;
  logo: string;
  commonName: { default: string };
  placeName: { default: string };
}

export interface BoxscoreResponse {
  id: number;
  gameType: number;
  gameState: string;
  gameScheduleState?: string;
  gameDate: string;
  startTimeUTC: string;
  venue: { default: string };
  homeTeam: BoxscoreTeam;
  awayTeam: BoxscoreTeam;
  periodDescriptor?: {
    number: number;
    periodType: string;
  };
  clock?: {
    timeRemaining: string;
    inIntermission: boolean;
    running: boolean;
  };
  gameOutcome?: {
    lastPeriodType: string;
  };
  playerByGameStats: {
    homeTeam: {
      forwards: BoxscorePlayer[];
      defense: BoxscorePlayer[];
      goalies: BoxscoreGoalie[];
    };
    awayTeam: {
      forwards: BoxscorePlayer[];
      defense: BoxscorePlayer[];
      goalies: BoxscoreGoalie[];
    };
  };
  tvBroadcasts?: Array<{
    id: number;
    market: string;
    countryCode: string;
    network: string;
  }>;
}

export interface ScoringGoal {
  situationCode: string; // e.g., "PP", "SH", "EN"
  strength: string; // "pp", "sh", "ev", "en"
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  teamAbbrev: { default: string };
  headshot: string;
  highlightClipSharingUrl?: string;
  highlightClip?: number;
  goalsToDate: number;
  assistsToDate: number;
  homeScore: number;
  awayScore: number;
  timeInPeriod: string; // "MM:SS"
  assists: Array<{
    playerId: number;
    firstName: { default: string };
    lastName: { default: string };
    assistsToDate: number;
  }>;
}

export interface ScoringPeriod {
  periodDescriptor: {
    number: number;
    periodType: string;
  };
  goals: ScoringGoal[];
}

export interface Penalty {
  timeInPeriod: string;
  type: string;
  duration: number;
  committedByPlayer: {
    firstName: { default: string };
    lastName: { default: string };
    sweaterNumber: number;
  };
  teamAbbrev: { default: string };
  drawnBy?: {
    firstName: { default: string };
    lastName: { default: string };
    sweaterNumber: number;
  };
  descKey: string;
}

export interface PenaltyPeriod {
  periodDescriptor: {
    number: number;
    periodType: string;
  };
  penalties: Penalty[];
}

export interface ThreeStar {
  star: number; // 1, 2, 3
  playerId: number;
  teamAbbrev: string | { default: string };
  headshot: string;
  sweaterNo: number;
  name: { default: string };
  firstName: { default: string };
  lastName: { default: string };
  position: string;
  goals: number;
  assists: number;
  points: number;
}

export interface TeamGameStat {
  category: string;
  awayValue: string;
  homeValue: string;
}

export interface Linescore {
  byPeriod: Array<{
    periodDescriptor: {
      number: number;
      periodType: string;
    };
    away: number;
    home: number;
  }>;
  totals: {
    away: number;
    home: number;
  };
}

export interface LandingResponse {
  id: number;
  gameType?: number; // 1=preseason, 2=regular, 3=playoffs
  gameState: string;
  gameDate: string;
  startTimeUTC: string;
  venue: { default: string };
  homeTeam: {
    id: number;
    abbrev: string;
    score: number;
    logo: string;
    commonName: { default: string };
    placeName: { default: string };
  };
  awayTeam: {
    id: number;
    abbrev: string;
    score: number;
    logo: string;
    commonName: { default: string };
    placeName: { default: string };
  };
  periodDescriptor?: {
    number: number;
    periodType: string;
  };
  clock?: {
    timeRemaining: string;
    inIntermission: boolean;
    running: boolean;
  };
  gameOutcome?: {
    lastPeriodType: string;
  };
  summary?: {
    scoring: ScoringPeriod[];
    penalties: PenaltyPeriod[];
    threeStars?: ThreeStar[];
    teamGameStats?: TeamGameStat[];
  };
  matchup?: Matchup;
  tvBroadcasts?: Array<{
    id: number;
    market: string;
    countryCode: string;
    network: string;
  }>;
}

export interface StandingsTeam {
  teamAbbrev: { default: string };
  teamName: { default: string };
  teamCommonName?: { default: string };
  teamLogo: string;
  points: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  conferenceName: string;
  divisionName: string;
  divisionSequence: number;
  conferenceSequence: number;
  wildcardSequence: number;
  pointPctg: number;
  streakCode: string;
  streakCount: number;
  l10Wins: number;
  l10Losses: number;
  l10OtLosses: number;
  regulationWins: number;
  regulationPlusOtWins: number;
  goalFor: number;
  goalAgainst: number;
  goalDifferential: number;
  homeWins: number;
  homeLosses: number;
  homeOtLosses: number;
  roadWins: number;
  roadLosses: number;
  roadOtLosses: number;
  clinchIndicator?: string;
}

export interface BoxScoreData {
  boxscore: BoxscoreResponse;
  landing: LandingResponse;
}

// Right-rail API types
export interface SeasonSeriesGame {
  id: number;
  gameDate: string;
  gameState: string;
  awayTeam: { id: number; abbrev: string; logo: string; score?: number };
  homeTeam: { id: number; abbrev: string; logo: string; score?: number };
  periodDescriptor?: { number: number; periodType: string };
  gameOutcome?: { lastPeriodType: string };
}

export interface TeamSeasonStats {
  ppPctg: number;
  pkPctg: number;
  faceoffWinningPctg: number;
  goalsForPerGamePlayed: number;
  goalsAgainstPerGamePlayed: number;
  ppPctgRank: number;
  pkPctgRank: number;
  faceoffWinningPctgRank: number;
  goalsForPerGamePlayedRank: number;
  goalsAgainstPerGamePlayedRank: number;
}

export interface Last10Record {
  record: string;
  streakType: string;
  streak: number;
  pastGameResults: Array<{ opponentAbbrev: string; gameResult: string }>;
}

export interface RightRailResponse {
  seasonSeries: SeasonSeriesGame[];
  seasonSeriesWins: { awayTeamWins: number; homeTeamWins: number };
  gameInfo: {
    referees: Array<{ default: string }>;
    linesmen: Array<{ default: string }>;
    awayTeam: { headCoach: { default: string }; scratches: unknown[] };
    homeTeam: { headCoach: { default: string }; scratches: unknown[] };
  };
  teamSeasonStats: {
    awayTeam: TeamSeasonStats;
    homeTeam: TeamSeasonStats;
  };
  last10Record: {
    awayTeam: Last10Record;
    homeTeam: Last10Record;
  };
}

// Matchup types (from landing response)
export interface SkaterComparisonLeader {
  playerId: number;
  name: { default: string };
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber: number;
  positionCode: string;
  headshot: string;
  value: number;
}

export interface SkaterComparison {
  leaders: Array<{
    category: string;
    awayLeader: SkaterComparisonLeader;
    homeLeader: SkaterComparisonLeader;
  }>;
}

export interface GoalieComparisonLeader {
  playerId: number;
  name: { default: string };
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber: number;
  headshot: string;
  positionCode: string;
  gamesPlayed: number;
  record: string;
  gaa: number;
  savePctg: number;
  shutouts: number;
}

export interface GoalieComparison {
  homeTeam: {
    teamTotals: { record: string; gaa: number; savePctg: number; shutouts: number; gamesPlayed: number };
    leaders: GoalieComparisonLeader[];
  };
  awayTeam: {
    teamTotals: { record: string; gaa: number; savePctg: number; shutouts: number; gamesPlayed: number };
    leaders: GoalieComparisonLeader[];
  };
}

export interface Matchup {
  skaterComparison: SkaterComparison;
  goalieComparison: GoalieComparison;
}
