export type Sport = 'nhl' | 'mlb';
export type SeriesResult = 'won' | 'lost';
export type GameLocation = 'home' | 'away' | 'neutral';

export interface PlayoffGame {
  gameNumber: number;
  date: string;
  teamScore: number;
  opponentScore: number;
  location: GameLocation;
  overtime?: boolean;
  /** Number of OT periods played (2 = 2OT, 3 = 3OT, 4 = 4OT). Omit or set to 1 for a single-OT game. */
  overtimePeriods?: number;
  notes?: string;
  youtubeId?: string;
  youtubePlaylistId?: string;
  gameId?: string;
}

export interface PlayoffSeries {
  round: number;
  roundLabel: string;
  opponent: {
    abbreviation: string;
    name: string;
  };
  result: SeriesResult;
  wins: number;
  losses: number;
  games: PlayoffGame[];
  notes?: string;
}

export interface PlayoffAppearance {
  season: string;
  seasonLabel: string;
  finalRoundReached: number;
  madeStanleyCupFinal: boolean;
  series: PlayoffSeries[];
}

export type FranchiseEventCategory =
  | 'founding'
  | 'arena'
  | 'ownership'
  | 'era'
  | 'player'
  | 'championship'
  | 'other';

export interface FranchiseEvent {
  date: string;
  category: FranchiseEventCategory;
  title: string;
  body?: string;
  youtubeId?: string;
}

export interface TeamHistory {
  sport: Sport;
  slug: string;
  founded: number;
  playoffAppearances: PlayoffAppearance[];
  franchiseTimeline: FranchiseEvent[];
}
