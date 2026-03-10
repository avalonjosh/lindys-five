import { fetchWithRetry } from './nhlApi';
import type { BoxscoreResponse, LandingResponse, StandingsTeam, RightRailResponse } from '../types/boxscore';

const API_BASE = '/api/v1';

export async function fetchBoxScoreData(gameId: string): Promise<{
  boxscore: BoxscoreResponse;
  landing: LandingResponse;
}> {
  const [boxscoreRes, landingRes] = await Promise.all([
    fetchWithRetry(`${API_BASE}/gamecenter/${gameId}/boxscore`),
    fetchWithRetry(`${API_BASE}/gamecenter/${gameId}/landing`),
  ]);

  const [boxscore, landing] = await Promise.all([
    boxscoreRes.json(),
    landingRes.json(),
  ]);

  return { boxscore, landing };
}

export async function fetchRightRail(gameId: string): Promise<RightRailResponse | null> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/gamecenter/${gameId}/right-rail`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch right rail:', error);
    return null;
  }
}

export async function fetchStandingsForDate(date: string): Promise<StandingsTeam[]> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/standings/${date}`);
    const data = await response.json();
    return data.standings || [];
  } catch (error) {
    console.error('Failed to fetch standings:', error);
    return [];
  }
}
