export interface NHLGame {
  id: number;
  gameDate: string;
  startTimeUTC?: string;
  gameState: string; // "FINAL", "LIVE", "FUT", "OFF"
  gameType: number; // 1 = preseason, 2 = regular, 3 = playoffs
  awayTeam: {
    id: number;
    abbrev: string;
    score: number;
    logo: string;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    score: number;
    logo: string;
  };
  gameOutcome?: {
    lastPeriodType: string; // "REG", "OT", "SO"
  };
}

export interface GameResult {
  date: string;
  startTime?: string;
  opponent: string;
  opponentLogo: string;
  opponentAbbreviation?: string; // Opponent team abbreviation for affiliate links
  isHome: boolean;
  sabresScore: number;
  opponentScore: number;
  outcome: 'W' | 'OTL' | 'L' | 'PENDING';
  points: number;
  gameState: string;
  gameId?: number;
}

export interface DetailedGameStats {
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  powerPlayGoals: number;
  powerPlayOpportunities: number;
  penaltyKillOpportunities: number;
  powerPlayGoalsAgainst: number;
  saves: number;
  shotsAgainstGoalie: number;
}

export interface GameChunk {
  chunkNumber: number;
  games: GameResult[];
  totalGames: number;
  wins: number;
  otLosses: number;
  losses: number;
  points: number;
  maxPoints: number;
  isComplete: boolean;
}

export interface ChunkStats {
  goalsPerGame: number;
  goalsAgainstPerGame: number;
  shotsPerGame: number;
  shotsAgainstPerGame: number;
  powerPlayPct: number;
  penaltyKillPct: number;
  savePct: number;
  gamesPlayed: number;
}

export interface SeasonStats {
  totalPoints: number;
  totalGames: number;
  gamesPlayed: number;
  gamesRemaining: number;
  currentPace: number;
  projectedPoints: number;
  playoffTarget: number;
  pointsAboveBelow: number;
}
