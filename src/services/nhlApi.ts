import type { NHLGame, GameResult } from '../types';

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

      return {
        date: game.gameDate,
        opponent: opponentTeam.abbrev,
        opponentLogo: opponentTeam.logo,
        isHome,
        sabresScore: sabresTeam.score || 0,
        opponentScore: opponentTeam.score || 0,
        outcome,
        points,
        gameState: game.gameState,
      };
    });

    console.log('First 3 games processed:', results.slice(0, 3));
    return results;
  } catch (error) {
    console.error('Error fetching Sabres schedule:', error);
    return [];
  }
}
