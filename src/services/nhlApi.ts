import type { NHLGame, GameResult, DetailedGameStats } from '../types';

const SABRES_ID = 7;
const SABRES_ABBREV = 'BUF';
const API_BASE = '/api/v1';

export async function fetchSabresSchedule(season: string = '20252026'): Promise<GameResult[]> {
  console.log('🏒 fetchSabresSchedule called with season:', season);
  try {
    const url = `${API_BASE}/club-schedule-season/${SABRES_ABBREV}/${season}`;
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
      const isHome = game.homeTeam.id === SABRES_ID;
      const sabresTeam = isHome ? game.homeTeam : game.awayTeam;
      const opponentTeam = isHome ? game.awayTeam : game.homeTeam;

      let outcome: 'W' | 'OTL' | 'L' | 'PENDING' = 'PENDING';
      let points = 0;

      if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
        const sabresWon = sabresTeam.score > opponentTeam.score;
        const wentToOvertime = game.gameOutcome?.lastPeriodType === 'OT' ||
                               game.gameOutcome?.lastPeriodType === 'SO';

        if (sabresWon) {
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
        isHome,
        sabresScore: sabresTeam.score || 0,
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

export async function fetchDetailedGameStats(gameId: number, isHome: boolean): Promise<DetailedGameStats | null> {
  try {
    const url = `${API_BASE}/gamecenter/${gameId}/boxscore`;
    const response = await fetch(url);
    const data = await response.json();

    const sabresTeam = isHome ? data.homeTeam : data.awayTeam;
    const opponentTeam = isHome ? data.awayTeam : data.homeTeam;

    // Get shots from team data
    const shotsFor = sabresTeam.sog || 0;
    const shotsAgainst = opponentTeam.sog || 0;

    // Calculate PP and PK stats from player data
    let powerPlayGoals = 0;
    let powerPlayGoalsAgainst = 0;

    const sabresPlayerData = data.playerByGameStats[isHome ? 'homeTeam' : 'awayTeam'];
    const opponentPlayerData = data.playerByGameStats[isHome ? 'awayTeam' : 'homeTeam'];

    // Aggregate PP goals from Sabres players
    ['forwards', 'defense'].forEach(position => {
      if (sabresPlayerData[position]) {
        sabresPlayerData[position].forEach((player: any) => {
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

    let sabresPenalties = 0;
    let opponentPenalties = 0;

    if (pbpData.plays) {
      pbpData.plays.forEach((play: any) => {
        if (play.typeDescKey === 'penalty' && play.details) {
          const penaltyTeam = play.details.eventOwnerTeamId;
          if (penaltyTeam === SABRES_ID) {
            sabresPenalties++;
          } else {
            opponentPenalties++;
          }
        }
      });
    }

    // PP opportunities = opponent's penalties (when we get PP)
    // PK opportunities = our penalties (when opponent gets PP)
    const powerPlayOpportunities = opponentPenalties;
    const penaltyKillOpportunities = sabresPenalties;

    // Get goalie stats for save percentage
    let saves = 0;
    let shotsAgainstGoalie = 0;

    if (sabresPlayerData.goalies && sabresPlayerData.goalies.length > 0) {
      sabresPlayerData.goalies.forEach((goalie: any) => {
        saves += goalie.saves || 0;
        shotsAgainstGoalie += goalie.shotsAgainst || 0;
      });
    }

    return {
      goalsFor: sabresTeam.score || 0,
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
