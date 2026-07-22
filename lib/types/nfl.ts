export interface NFLGameResult {
  gameId: number; // ESPN event id
  week: number; // 1-18
  date: string; // display, e.g. "Sep 13"
  /** YYYY-MM-DD Eastern, for saved What-If picks. */
  isoDate: string;
  startTime: string;
  opponent: string; // ESPN abbrev
  opponentName: string;
  opponentLogo: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  outcome: 'W' | 'L' | 'PENDING';
  isLive: boolean;
  gameState: string; // ESPN status name, e.g. STATUS_SCHEDULED / STATUS_FINAL
  /** 2 = regular season, 3 = postseason (postseason only present when requested). */
  seasonType: number;
}

export interface NFLScheduleData {
  games: NFLGameResult[]; // regular season, sorted by week
  byeWeek: number | null;
}
