export interface NHLGame {
  id: number;
  gameDate: string;
  startTimeUTC?: string;
  gameState: string; // "FINAL", "LIVE", "FUT", "OFF"
  gameScheduleState?: string; // "OK", "TBD", "PPD", etc. — "TBD" means time not set yet
  gameType: number; // 1 = preseason, 2 = regular, 3 = playoffs
  awayTeam: {
    id: number;
    abbrev: string;
    score: number;
    logo: string;
    // Team record (from standings API)
    wins?: number;
    losses?: number;
    otLosses?: number;
    // Shots on goal (from boxscore API for live/finished games)
    sog?: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    score: number;
    logo: string;
    // Team record (from standings API)
    wins?: number;
    losses?: number;
    otLosses?: number;
    // Shots on goal (from boxscore API for live/finished games)
    sog?: number;
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
  // Playoff series context (enriched for gameType 3)
  seriesStatus?: string; // e.g., "TOR leads 3-2"
  // TV broadcast info
  tvBroadcasts?: Array<{
    id: number;
    market: string; // 'N' = National, 'H' = Home, 'A' = Away
    countryCode: string; // 'US', 'CA'
    network: string; // 'NHLN', 'ESPN', 'TNT', etc.
  }>;
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

export interface CutLineData {
  cutLine: number;           // Projected points for WC2 team (pace × 82)
  userPoints: number;
  userGamesPlayed: number;
  pointsNeeded: number;      // cutLine - userPoints
  gamesRemaining: number;    // 82 - userGamesPlayed
  paceNeeded: number;        // pointsNeeded / gamesRemaining
  wc2Team: {
    abbrev: string;
    points: number;
    gamesPlayed: number;
    pace: number;
  };
  isInPlayoffPosition: boolean;
  playoffRank?: string;      // e.g., "1st in Atlantic" or "Wild Card 1"
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

  // Analytics (admin only)
  views?: number;
}

// Newsletter System Types
export interface NewsletterSubscriber {
  id: string;
  email: string;
  teams: string[];           // Team slugs (e.g., ['sabres', 'bruins'])
  createdAt: string;         // ISO date
  verified: boolean;
  verifiedAt?: string;       // ISO date
  unsubscribedAt?: string;   // ISO date (soft delete)
  source?: string;           // Where they signed up (blog-post, landing, team-page)
}

export interface EmailVerificationToken {
  subscriberId: string;
  expiresAt: string;         // ISO date
}

export interface EmailSendRecord {
  id: string;
  postId: string;
  postSlug: string;
  team: string;
  sentAt: string;            // ISO date
  recipientCount: number;
  subject: string;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  complained?: number;
}
