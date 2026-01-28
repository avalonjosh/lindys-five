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
  // Live game data (only present when gameState === "LIVE")
  period?: number;
  periodDescriptor?: {
    number: number;
    periodType: string; // "REG", "OT", "SO"
  };
  clock?: {
    timeRemaining: string; // "MM:SS" format
    inIntermission: boolean;
    running: boolean;
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
  // Live game data
  period?: number;
  periodDescriptor?: {
    number: number;
    periodType: string; // "REG", "OT", "SO"
  };
  clock?: {
    timeRemaining: string; // "MM:SS" format
    inIntermission: boolean;
    running: boolean;
  };
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

// Blog System Types
export type PostType = 'game-recap' | 'set-recap' | 'custom' | 'weekly-roundup' | 'news-analysis';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;           // Markdown content
  excerpt: string;           // First 200 chars for previews
  team: 'sabres' | 'bills';
  type: PostType;
  status: 'draft' | 'published';

  createdAt: string;         // ISO date string
  publishedAt: string | null;
  updatedAt: string;         // ISO date string

  // For game/set recaps
  gameId?: number;           // NHL API game ID
  opponent?: string;
  gameDate?: string;
  setNumber?: number;        // For set recaps

  // For weekly roundup
  weekStartDate?: string;    // ISO date - Monday of the week covered
  weekEndDate?: string;      // ISO date - Sunday of the week covered

  // For news-analysis
  newsTopics?: string[];     // Topics covered (e.g., ["trade rumor", "injury update"])
  sourceHeadlines?: string[]; // Headlines that triggered the article (for reference)

  // AI generation tracking
  aiGenerated: boolean;
  aiModel?: string;

  // SEO
  metaDescription?: string;
  ogImage?: string;

  // Featured/pinned
  pinned?: boolean;
}
