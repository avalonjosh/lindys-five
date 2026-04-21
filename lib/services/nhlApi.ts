import type { NHLGame, GameResult, DetailedGameStats } from '../types';
import type { PlayoffBracketResponse } from '../types/playoffs';

const API_BASE = '/api/v1';

interface NHLSeriesStatusRaw {
  round?: number;
  seriesAbbrev?: string;
  seriesTitle?: string;
  seriesLetter?: string;
  neededToWin?: number;
  topSeedTeamAbbrev?: string;
  topSeedWins?: number;
  bottomSeedTeamAbbrev?: string;
  bottomSeedWins?: number;
  gameNumberOfSeries?: number;
}

function normalizeSeriesStatus(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') return raw;
  if (typeof raw !== 'object') return undefined;

  const s = raw as NHLSeriesStatusRaw;
  const topAbbrev = s.topSeedTeamAbbrev;
  const botAbbrev = s.bottomSeedTeamAbbrev;
  const topWins = s.topSeedWins ?? 0;
  const botWins = s.bottomSeedWins ?? 0;
  const needed = s.neededToWin ?? 4;
  const gameNum = s.gameNumberOfSeries;

  if (topWins >= needed && topAbbrev) return `${topAbbrev} wins ${topWins}-${botWins}`;
  if (botWins >= needed && botAbbrev) return `${botAbbrev} wins ${botWins}-${topWins}`;

  let status: string;
  if (topWins === 0 && botWins === 0) {
    status = gameNum ? `Game ${gameNum}` : 'Game 1';
  } else if (topWins === botWins) {
    status = `Series tied ${topWins}-${botWins}`;
  } else if (topWins > botWins && topAbbrev) {
    status = `${topAbbrev} leads ${topWins}-${botWins}`;
  } else if (botAbbrev) {
    status = `${botAbbrev} leads ${botWins}-${topWins}`;
  } else {
    return undefined;
  }

  if (gameNum && !status.startsWith('Game ')) {
    status += ` \u2022 Game ${gameNum}`;
  }
  return status;
}

// Rate limiter to avoid overwhelming the NHL API
// Serializes requests with minimum delay between them
const MAX_CONCURRENT = 4;
const MIN_REQUEST_GAP_MS = 100; // minimum 100ms between requests (~10 req/sec)
let activeRequests = 0;
let lastRequestTime = 0;
const requestQueue: Array<{ resolve: () => void }> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    // Enforce minimum gap between requests
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_GAP_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_GAP_MS - elapsed));
    }
    lastRequestTime = Date.now();
    return;
  }
  return new Promise<void>((resolve) => {
    requestQueue.push({ resolve });
  });
}

function releaseSlot(): void {
  activeRequests--;
  if (requestQueue.length > 0) {
    // Delay before giving the slot to the next queued request
    setTimeout(() => {
      const next = requestQueue.shift();
      if (next) {
        activeRequests++;
        lastRequestTime = Date.now();
        next.resolve();
      }
    }, MIN_REQUEST_GAP_MS);
  }
}

// Custom Error used when NHL rate-limits us (429) and we exhaust retries.
// Callers can check `isRateLimitError(err)` to log quietly instead of treating it as a real failure.
export class RateLimitError extends Error {
  isRateLimit = true as const;
  constructor(message = 'NHL rate limit — retries exhausted') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof RateLimitError) return true;
  if (typeof err === 'object' && err && (err as { isRateLimit?: boolean }).isRateLimit) return true;
  const msg = (err as Error)?.message || '';
  return msg.includes('429');
}

// Helper function to retry failed requests with exponential backoff.
// Accepts an optional AbortSignal so callers can cancel stale requests (e.g. user navigated to another game).
export async function fetchWithRetry(url: string, maxRetries: number = 3, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await acquireSlot();
  let lastError: Error | null = null;

  try {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const response = await fetch(url, { signal });
        if (response.ok) {
          return response;
        }

        // Retry on 429 (rate limit) or 5xx (server error)
        if (response.status === 429 || response.status >= 500) {
          lastError = response.status === 429 ? new RateLimitError() : new Error(`Server error: ${response.status}`);
          if (attempt < maxRetries - 1) {
            const delay = response.status === 429
              ? Math.pow(2, attempt) * 2000  // 2s, 4s, 8s for rate limits
              : Math.pow(2, attempt) * 1000; // 1s, 2s, 4s for server errors
            await new Promise((resolve, reject) => {
              const t = setTimeout(resolve, delay);
              signal?.addEventListener('abort', () => {
                clearTimeout(t);
                reject(new DOMException('Aborted', 'AbortError'));
              }, { once: true });
            });
            continue;
          }
        } else {
          // For other errors (4xx), don't retry
          throw new Error(`API returned status ${response.status}`);
        }
      } catch (error) {
        // Preserve AbortError so callers can distinguish cancellation from failure
        if ((error as Error)?.name === 'AbortError') throw error;
        lastError = error as Error;
        // Network error or fetch failed, retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }

    throw lastError || new Error('Failed to fetch after retries');
  } finally {
    releaseSlot();
  }
}

export interface TeamStandings {
  teamId: number;
  teamAbbrev: string;
  points: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  divisionSequence?: number;
}

export async function fetchSabresSchedule(season: string = '20252026', teamAbbrev: string = 'BUF', teamId: number = 7): Promise<GameResult[]> {
  // Check cache first
  const cacheKey = `${teamAbbrev}-${season}`;
  const cached = scheduleCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SCHEDULE_CACHE_TTL) {
    console.log(`🏒 Using cached schedule for ${teamAbbrev} ${season}`);
    return cached.data;
  }

  console.log(`🏒 fetchSchedule called for ${teamAbbrev} with season:`, season);
  try {
    const url = `${API_BASE}/club-schedule-season/${teamAbbrev}/${season}`;
    console.log('🏒 Fetching from URL:', url);
    const response = await fetchWithRetry(url);
    console.log('🏒 Response status:', response.status);

    const data = await response.json();

    if (!data.games || !Array.isArray(data.games)) {
      console.error('⚠️ Invalid API response: missing games array');
      throw new Error('Invalid API response: missing games array');
    }

    // Include regular season (2) and playoff (3) games
    const regularSeasonGames: NHLGame[] = data.games.filter((game: NHLGame) => game.gameType === 2 || game.gameType === 3);

    console.log(`🏒 ${teamAbbrev} ${season}: ${regularSeasonGames.length} games (regular + playoffs)`);

    if (regularSeasonGames.length === 0) {
      console.error('⚠️ No regular season games found in API response');
      throw new Error('No regular season games found');
    }

    const results = regularSeasonGames.map((game): GameResult => {
      const isHome = game.homeTeam.id === teamId;
      const myTeam = isHome ? game.homeTeam : game.awayTeam;
      const opponentTeam = isHome ? game.awayTeam : game.homeTeam;

      let outcome: 'W' | 'OTL' | 'L' | 'PENDING' = 'PENDING';
      let points = 0;

      if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
        const teamWon = myTeam.score > opponentTeam.score;
        const wentToOvertime = game.gameOutcome?.lastPeriodType === 'OT' ||
                               game.gameOutcome?.lastPeriodType === 'SO';

        if (teamWon) {
          outcome = 'W';
          points = 2;
        } else if (wentToOvertime) {
          outcome = 'OTL';
          points = 1;
        } else {
          outcome = 'L';
          points = 0;
        }
      }

      // Convert game date to EST/EDT (America/New_York timezone)
      // The API returns dates in YYYY-MM-DD format, we need to ensure it displays in Eastern Time
      const gameDateEST = new Date(game.gameDate + 'T00:00:00-05:00').toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      // Extract and format start time in Eastern Time
      let startTime: string | undefined;
      if (game.startTimeUTC) {
        const startDate = new Date(game.startTimeUTC);
        startTime = startDate.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }

      return {
        date: gameDateEST,
        startTime,
        opponent: opponentTeam.abbrev,
        opponentLogo: opponentTeam.logo,
        opponentAbbreviation: opponentTeam.abbrev,
        isHome,
        sabresScore: myTeam.score || 0,
        opponentScore: opponentTeam.score || 0,
        outcome,
        points,
        gameState: game.gameState,
        gameId: game.id,
        // Pass through live game data if available
        period: game.period,
        periodDescriptor: game.periodDescriptor,
        clock: game.clock,
      };
    });

    // Enrich LIVE and CRIT games with real-time period and clock data
    const liveGames = results.filter(game => (game.gameState === 'LIVE' || game.gameState === 'CRIT') && game.gameId);

    if (liveGames.length > 0) {
      console.log(`🔴 Fetching live data for ${liveGames.length} LIVE game(s)...`);

      // Fetch live data for all live games in parallel
      const liveDataPromises = liveGames.map(async (game) => {
        try {
          const url = `${API_BASE}/gamecenter/${game.gameId}/landing`;
          const response = await fetchWithRetry(url);
          const liveData = await response.json();

          return {
            gameId: game.gameId,
            period: liveData.periodDescriptor?.number || null,
            periodDescriptor: liveData.periodDescriptor || null,
            clock: liveData.clock || null
          };
        } catch (error) {
          console.error(`Failed to fetch live data for game ${game.gameId}:`, error);
          return null; // Return null on error, will be filtered out
        }
      });

      const liveDataResults = await Promise.all(liveDataPromises);

      // Merge live data back into results
      liveDataResults.forEach((liveData) => {
        if (!liveData) return; // Skip failed fetches

        const gameIndex = results.findIndex(g => g.gameId === liveData.gameId);
        if (gameIndex !== -1) {
          results[gameIndex].period = liveData.period;
          results[gameIndex].periodDescriptor = liveData.periodDescriptor;
          results[gameIndex].clock = liveData.clock;
        }
      });

      console.log('✅ Live game data enriched');
    }

    console.log('✅ Successfully processed', results.length, 'games');
    // Cache the schedule
    scheduleCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('NHL rate-limited schedule fetch');
    } else {
      console.error('❌ Error fetching schedule:', error);
    }
    // Re-throw the error so the caller knows the fetch failed
    // This allows App.tsx to keep existing data instead of clearing it
    throw error;
  }
}

export async function fetchLastSeasonComparison(currentGamesPlayed: number, teamAbbrev: string = 'BUF', teamId: number = 7): Promise<{ pointsLastYear: number; recordLastYear: string } | null> {
  try {
    // Fetch 2024-2025 season data
    const lastSeasonGames = await fetchSabresSchedule('20242025', teamAbbrev, teamId);

    // Get the first N games from last season (matching current games played)
    const gamesAtSamePoint = lastSeasonGames.slice(0, currentGamesPlayed);

    // Calculate total points at that point last season
    const pointsLastYear = gamesAtSamePoint.reduce((sum, game) => sum + game.points, 0);

    // Calculate record (W-OTL-L)
    const wins = gamesAtSamePoint.filter(g => g.outcome === 'W').length;
    const otLosses = gamesAtSamePoint.filter(g => g.outcome === 'OTL').length;
    const losses = gamesAtSamePoint.filter(g => g.outcome === 'L').length;
    const recordLastYear = `${wins}-${otLosses}-${losses}`;

    return { pointsLastYear, recordLastYear };
  } catch (error) {
    console.error('Error fetching last season comparison:', error);
    return null;
  }
}

// In-memory caches — completed game data never changes
const gameStatsCache = new Map<string, DetailedGameStats>();
const scheduleCache = new Map<string, { data: GameResult[]; timestamp: number }>();
const SCHEDULE_CACHE_TTL = 60_000; // 1 minute for schedule data

// Hydrate gameStatsCache from localStorage on module load
const GAME_STATS_STORAGE_KEY = 'nhl-game-stats-cache';
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(GAME_STATS_STORAGE_KEY);
    if (stored) {
      const entries: [string, DetailedGameStats][] = JSON.parse(stored);
      entries.forEach(([key, value]) => gameStatsCache.set(key, value));
      console.log(`📦 Loaded ${entries.length} cached game stats from localStorage`);
    }
  } catch {
    // Corrupted data — clear it
    localStorage.removeItem(GAME_STATS_STORAGE_KEY);
  }
}

function persistGameStatsCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(gameStatsCache.entries());
    localStorage.setItem(GAME_STATS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

export async function fetchDetailedGameStats(gameId: number, isHome: boolean, teamId: number = 7): Promise<DetailedGameStats | null> {
  const cacheKey = `${gameId}-${isHome}-${teamId}`;
  const cached = gameStatsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/gamecenter/${gameId}/boxscore`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    // Validate response structure
    if (!data.homeTeam || !data.awayTeam) {
      throw new Error('Invalid API response: missing team data');
    }

    const myTeam = isHome ? data.homeTeam : data.awayTeam;
    const opponentTeam = isHome ? data.awayTeam : data.homeTeam;

    // Get shots from team data
    const shotsFor = myTeam.sog || 0;
    const shotsAgainst = opponentTeam.sog || 0;

    // Calculate PP and PK stats from player data
    let powerPlayGoals = 0;
    let powerPlayGoalsAgainst = 0;

    const myTeamPlayerData = data.playerByGameStats[isHome ? 'homeTeam' : 'awayTeam'];
    const opponentPlayerData = data.playerByGameStats[isHome ? 'awayTeam' : 'homeTeam'];

    // Aggregate PP goals from my team's players
    ['forwards', 'defense'].forEach(position => {
      if (myTeamPlayerData[position]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        myTeamPlayerData[position].forEach((player: any) => {
          powerPlayGoals += player.powerPlayGoals || 0;
        });
      }
    });

    // Aggregate PP goals against (opponent's PP goals)
    ['forwards', 'defense'].forEach(position => {
      if (opponentPlayerData[position]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opponentPlayerData[position].forEach((player: any) => {
          powerPlayGoalsAgainst += player.powerPlayGoals || 0;
        });
      }
    });

    // Get penalty data from play-by-play to calculate opportunities
    const playByPlayUrl = `${API_BASE}/gamecenter/${gameId}/play-by-play`;
    const pbpResponse = await fetchWithRetry(playByPlayUrl);
    const pbpData = await pbpResponse.json();

    let myTeamPenalties = 0;
    let opponentPenalties = 0;

    if (pbpData.plays) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pbpData.plays.forEach((play: any) => {
        if (play.typeDescKey === 'penalty' && play.details) {
          const penaltyTeam = play.details.eventOwnerTeamId;
          if (penaltyTeam === teamId) {
            myTeamPenalties++;
          } else {
            opponentPenalties++;
          }
        }
      });
    }

    // PP opportunities = opponent's penalties (when we get PP)
    // PK opportunities = our penalties (when opponent gets PP)
    const powerPlayOpportunities = opponentPenalties;
    const penaltyKillOpportunities = myTeamPenalties;

    // Get goalie stats for save percentage
    let saves = 0;
    let shotsAgainstGoalie = 0;

    if (myTeamPlayerData.goalies && myTeamPlayerData.goalies.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      myTeamPlayerData.goalies.forEach((goalie: any) => {
        saves += goalie.saves || 0;
        shotsAgainstGoalie += goalie.shotsAgainst || 0;
      });
    }

    const result: DetailedGameStats = {
      goalsFor: myTeam.score || 0,
      goalsAgainst: opponentTeam.score || 0,
      shotsFor,
      shotsAgainst,
      powerPlayGoals,
      powerPlayOpportunities,
      penaltyKillOpportunities,
      powerPlayGoalsAgainst,
      saves,
      shotsAgainstGoalie,
    };

    // Cache the result — completed game stats never change
    gameStatsCache.set(cacheKey, result);
    persistGameStatsCache();
    return result;
  } catch (error) {
    console.error(`Error fetching detailed stats for game ${gameId}:`, error);
    return null;
  }
}

export async function fetchTeamStandings(teamAbbrev: string, teamId: number): Promise<TeamStandings | null> {
  try {
    const schedule = await fetchSabresSchedule('20252026', teamAbbrev, teamId);

    // Calculate current points and record from played games
    const playedGames = schedule.filter(game => game.outcome !== 'PENDING');
    const points = playedGames.reduce((sum, game) => sum + game.points, 0);
    const wins = playedGames.filter(g => g.outcome === 'W').length;
    const otLosses = playedGames.filter(g => g.outcome === 'OTL').length;
    const losses = playedGames.filter(g => g.outcome === 'L').length;

    return {
      teamId,
      teamAbbrev,
      points,
      gamesPlayed: playedGames.length,
      wins,
      losses,
      otLosses
    };
  } catch (error) {
    console.error(`Error fetching standings for ${teamAbbrev}:`, error);
    return null;
  }
}

// Fetch current standings for all teams (returns map of teamAbbrev -> record)
async function fetchStandingsMap(): Promise<Map<string, { wins: number; losses: number; otLosses: number }>> {
  const standingsMap = new Map<string, { wins: number; losses: number; otLosses: number }>();

  try {
    // Use today's date in Eastern Time (same format as StandingsCard)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const url = `${API_BASE}/standings/${today}`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (data.standings && Array.isArray(data.standings)) {
      data.standings.forEach((team: { teamAbbrev: { default: string }; wins: number; losses: number; otLosses: number }) => {
        standingsMap.set(team.teamAbbrev.default, {
          wins: team.wins,
          losses: team.losses,
          otLosses: team.otLosses
        });
      });
    }

    console.log(`📊 Loaded standings for ${standingsMap.size} teams`);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('NHL rate-limited standings fetch — continuing without records');
    } else {
      console.error('Failed to fetch standings:', error);
    }
  }

  return standingsMap;
}

// Fetch all NHL games for a specific date (league-wide scores)
export async function fetchScoresByDate(date: string): Promise<NHLGame[]> {
  try {
    // Fetch schedule and standings in parallel
    const [scheduleResponse, standingsMap] = await Promise.all([
      fetchWithRetry(`${API_BASE}/schedule/${date}`),
      fetchStandingsMap()
    ]);

    const data = await scheduleResponse.json();

    console.log('📅 Schedule API response:', data);

    // The API returns gameWeek array with dates and games
    if (!data.gameWeek || !Array.isArray(data.gameWeek)) {
      console.warn('⚠️ No gameWeek in response');
      return [];
    }

    // Find games for the requested date
    const dayData = data.gameWeek.find((day: { date: string; games: NHLGame[] }) => day.date === date);
    if (!dayData || !dayData.games) {
      console.warn('⚠️ No games found for date:', date);
      return [];
    }

    // Include regular season (2) and playoff (3) games
    const regularSeasonGames = dayData.games.filter((game: NHLGame) => game.gameType === 2 || game.gameType === 3);

    // NHL API returns seriesStatus as an object for playoff games; normalize to string
    regularSeasonGames.forEach((game: NHLGame) => {
      if (game.gameType === 3) {
        game.seriesStatus = normalizeSeriesStatus((game as unknown as { seriesStatus?: unknown }).seriesStatus);
      }
    });

    console.log(`✅ Found ${regularSeasonGames.length} games for ${date}`);

    // Enrich all games with team records from standings
    regularSeasonGames.forEach((game: NHLGame) => {
      const homeRecord = standingsMap.get(game.homeTeam.abbrev);
      const awayRecord = standingsMap.get(game.awayTeam.abbrev);

      if (homeRecord) {
        game.homeTeam.wins = homeRecord.wins;
        game.homeTeam.losses = homeRecord.losses;
        game.homeTeam.otLosses = homeRecord.otLosses;
      }
      if (awayRecord) {
        game.awayTeam.wins = awayRecord.wins;
        game.awayTeam.losses = awayRecord.losses;
        game.awayTeam.otLosses = awayRecord.otLosses;
      }
    });

    // Identify games that need additional data
    const liveGames = regularSeasonGames.filter(
      (game: NHLGame) => (game.gameState === 'LIVE' || game.gameState === 'CRIT') && game.id
    );
    const finishedGames = regularSeasonGames.filter(
      (game: NHLGame) => (game.gameState === 'FINAL' || game.gameState === 'OFF') && game.id
    );

    // Fetch boxscore for live and finished games (for SOG)
    const gamesNeedingBoxscore = [...liveGames, ...finishedGames];

    if (gamesNeedingBoxscore.length > 0) {
      console.log(`📊 Fetching boxscore data for ${gamesNeedingBoxscore.length} game(s)...`);

      const boxscorePromises = gamesNeedingBoxscore.map(async (game: NHLGame) => {
        try {
          const url = `${API_BASE}/gamecenter/${game.id}/boxscore`;
          const response = await fetchWithRetry(url);
          const boxscoreData = await response.json();

          return {
            gameId: game.id,
            homeSog: boxscoreData.homeTeam?.sog || null,
            awaySog: boxscoreData.awayTeam?.sog || null
          };
        } catch (error) {
          console.error(`Failed to fetch boxscore for game ${game.id}:`, error);
          return null;
        }
      });

      const boxscoreResults = await Promise.all(boxscorePromises);

      // Merge SOG data back into games
      boxscoreResults.forEach((boxscore) => {
        if (!boxscore) return;

        const game = regularSeasonGames.find((g: NHLGame) => g.id === boxscore.gameId);
        if (game) {
          game.homeTeam.sog = boxscore.homeSog;
          game.awayTeam.sog = boxscore.awaySog;
        }
      });

      console.log('✅ Boxscore data enriched');
    }

    // Fetch landing page data for live games (for clock/period)
    if (liveGames.length > 0) {
      console.log(`🔴 Fetching live data for ${liveGames.length} LIVE game(s)...`);

      const liveDataPromises = liveGames.map(async (game: NHLGame) => {
        try {
          const url = `${API_BASE}/gamecenter/${game.id}/landing`;
          const response = await fetchWithRetry(url);
          const liveData = await response.json();

          return {
            gameId: game.id,
            period: liveData.periodDescriptor?.number || null,
            periodDescriptor: liveData.periodDescriptor || null,
            clock: liveData.clock || null
          };
        } catch (error) {
          console.error(`Failed to fetch live data for game ${game.id}:`, error);
          return null;
        }
      });

      const liveDataResults = await Promise.all(liveDataPromises);

      // Merge live data back into games
      liveDataResults.forEach((liveData) => {
        if (!liveData) return;

        const game = regularSeasonGames.find((g: NHLGame) => g.id === liveData.gameId);
        if (game) {
          game.period = liveData.period;
          game.periodDescriptor = liveData.periodDescriptor;
          game.clock = liveData.clock;
        }
      });

      console.log('✅ Live game data enriched');
    }

    // Sort games: live first, then by start time
    return regularSeasonGames.sort((a: NHLGame, b: NHLGame) => {
      const aIsLive = a.gameState === 'LIVE' || a.gameState === 'CRIT';
      const bIsLive = b.gameState === 'LIVE' || b.gameState === 'CRIT';

      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;

      // Then sort by start time
      const aTime = a.startTimeUTC || '';
      const bTime = b.startTimeUTC || '';
      return aTime.localeCompare(bTime);
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('NHL rate-limited scores fetch for', date);
    } else {
      console.error('❌ Error fetching scores for date:', date, error);
    }
    throw error;
  }
}

// Fetch the NHL playoff bracket
export async function fetchPlayoffBracket(season: string = '20252026'): Promise<PlayoffBracketResponse | null> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/playoff-bracket/${season}`);
    const data = await response.json();
    return data as PlayoffBracketResponse;
  } catch (error) {
    console.error('Failed to fetch playoff bracket:', error);
    return null;
  }
}

// Lightweight poll: only refresh live/in-progress game data without re-fetching schedule/standings
export async function pollLiveGames(existingGames: NHLGame[]): Promise<NHLGame[]> {
  const liveGames = existingGames.filter(
    g => g.gameState === 'LIVE' || g.gameState === 'CRIT'
  );

  // Also check games that were FUT/PRE — they may have started
  const pendingGames = existingGames.filter(
    g => g.gameState === 'FUT' || g.gameState === 'PRE'
  );

  if (liveGames.length === 0 && pendingGames.length === 0) {
    return existingGames;
  }

  const updatedGames = [...existingGames];

  // For pending games, do a quick schedule check to see if any started
  if (pendingGames.length > 0) {
    try {
      const date = pendingGames[0].gameDate || new Date().toISOString().split('T')[0];
      const scheduleResponse = await fetchWithRetry(`${API_BASE}/schedule/${date}`);
      const data = await scheduleResponse.json();
      const dayData = data.gameWeek?.find((day: { date: string; games: NHLGame[] }) => day.date === date);
      if (dayData?.games) {
        for (const freshGame of dayData.games) {
          const idx = updatedGames.findIndex((g: NHLGame) => g.id === freshGame.id);
          if (idx !== -1) {
            // NHL returns seriesStatus as an object for playoff games; keep it a string
            if (freshGame.gameType === 3) {
              freshGame.seriesStatus = normalizeSeriesStatus((freshGame as unknown as { seriesStatus?: unknown }).seriesStatus);
            }
            // Update game state and scores from schedule
            updatedGames[idx] = { ...updatedGames[idx], ...freshGame, homeTeam: { ...updatedGames[idx].homeTeam, ...freshGame.homeTeam }, awayTeam: { ...updatedGames[idx].awayTeam, ...freshGame.awayTeam } };
          }
        }
      }
    } catch (error) {
      console.error('Failed to check pending games:', error);
    }
  }

  // Re-identify live games after schedule update
  const currentLiveGames = updatedGames.filter(
    (g: NHLGame) => (g.gameState === 'LIVE' || g.gameState === 'CRIT') && g.id
  );

  if (currentLiveGames.length === 0) {
    return updatedGames;
  }

  // Fetch boxscore + landing for live games only
  const liveDataPromises = currentLiveGames.map(async (game: NHLGame) => {
    try {
      const [boxscoreRes, landingRes] = await Promise.all([
        fetchWithRetry(`${API_BASE}/gamecenter/${game.id}/boxscore`),
        fetchWithRetry(`${API_BASE}/gamecenter/${game.id}/landing`)
      ]);
      const [boxscore, landing] = await Promise.all([
        boxscoreRes.json(),
        landingRes.json()
      ]);

      return {
        gameId: game.id,
        homeScore: boxscore.homeTeam?.score ?? game.homeTeam.score,
        awayScore: boxscore.awayTeam?.score ?? game.awayTeam.score,
        homeSog: boxscore.homeTeam?.sog || null,
        awaySog: boxscore.awayTeam?.sog || null,
        period: landing.periodDescriptor?.number || null,
        periodDescriptor: landing.periodDescriptor || null,
        clock: landing.clock || null,
        gameState: boxscore.gameState || game.gameState,
      };
    } catch (error) {
      console.error(`Failed to poll live data for game ${game.id}:`, error);
      return null;
    }
  });

  const results = await Promise.all(liveDataPromises);

  results.forEach((result) => {
    if (!result) return;
    const idx = updatedGames.findIndex((g: NHLGame) => g.id === result.gameId);
    if (idx !== -1) {
      updatedGames[idx] = {
        ...updatedGames[idx],
        gameState: result.gameState,
        homeTeam: { ...updatedGames[idx].homeTeam, score: result.homeScore, sog: result.homeSog },
        awayTeam: { ...updatedGames[idx].awayTeam, score: result.awayScore, sog: result.awaySog },
        period: result.period,
        periodDescriptor: result.periodDescriptor,
        clock: result.clock,
      };
    }
  });

  // Re-sort: live first, then by start time
  return updatedGames.sort((a: NHLGame, b: NHLGame) => {
    const aIsLive = a.gameState === 'LIVE' || a.gameState === 'CRIT';
    const bIsLive = b.gameState === 'LIVE' || b.gameState === 'CRIT';
    if (aIsLive && !bIsLive) return -1;
    if (!aIsLive && bIsLive) return 1;
    const aTime = a.startTimeUTC || '';
    const bTime = b.startTimeUTC || '';
    return aTime.localeCompare(bTime);
  });
}
