import type { NHLGame, GameResult, DetailedGameStats } from '../types';

const API_BASE = '/api/v1';

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
  console.log(`🏒 fetchSchedule called for ${teamAbbrev} with season:`, season);
  try {
    const url = `${API_BASE}/club-schedule-season/${teamAbbrev}/${season}`;
    console.log('🏒 Fetching from URL:', url);
    const response = await fetch(url);
    console.log('🏒 Response status:', response.status);
    const data = await response.json();

    console.log('🏒 API Response:', data);
    console.log('🏒 Total games:', data.games?.length);

    // Filter for regular season games only (gameType === 2)
    const regularSeasonGames: NHLGame[] = data.games.filter((game: NHLGame) => game.gameType === 2);

    console.log('Regular season games:', regularSeasonGames.length);

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
      };
    });

    console.log('First 3 games processed:', results.slice(0, 3));
    return results;
  } catch (error) {
    console.error('Error fetching Sabres schedule:', error);
    return [];
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

export async function fetchDetailedGameStats(gameId: number, isHome: boolean, teamId: number = 7): Promise<DetailedGameStats | null> {
  try {
    const url = `${API_BASE}/gamecenter/${gameId}/boxscore`;
    const response = await fetch(url);
    const data = await response.json();

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
        myTeamPlayerData[position].forEach((player: any) => {
          powerPlayGoals += player.powerPlayGoals || 0;
        });
      }
    });

    // Aggregate PP goals against (opponent's PP goals)
    ['forwards', 'defense'].forEach(position => {
      if (opponentPlayerData[position]) {
        opponentPlayerData[position].forEach((player: any) => {
          powerPlayGoalsAgainst += player.powerPlayGoals || 0;
        });
      }
    });

    // Get penalty data from play-by-play to calculate opportunities
    const playByPlayUrl = `${API_BASE}/gamecenter/${gameId}/play-by-play`;
    const pbpResponse = await fetch(playByPlayUrl);
    const pbpData = await pbpResponse.json();

    let myTeamPenalties = 0;
    let opponentPenalties = 0;

    if (pbpData.plays) {
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
      myTeamPlayerData.goalies.forEach((goalie: any) => {
        saves += goalie.saves || 0;
        shotsAgainstGoalie += goalie.shotsAgainst || 0;
      });
    }

    return {
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
