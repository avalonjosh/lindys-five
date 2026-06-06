/**
 * Server-side dataset loader for the Perfect Season leaderboard validator.
 * Maps a sport to its data pools, sport config, and canonical daily schedule —
 * the same JSON the client boards import, but loaded only into the API routes
 * (kept out of the client bundle). Used to re-score submissions authoritatively.
 */

import nhlData from '@/data/nhl-data.json';
import mlbData from '@/data/mlb-data.json';
import nhlSchedule from '@/data/nhl-daily-schedule.json';
import mlbSchedule from '@/data/mlb-daily-schedule.json';
import { nhlConfig } from '@/lib/perfectseason/config.nhl';
import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import type { GameData, RoundTree, Sport, SportConfig } from '@/lib/perfectseason/types';

export interface ScheduleJson {
  days: Record<string, { dayNumber: number; rounds: RoundTree[] }>;
}

interface Dataset {
  data: GameData;
  config: SportConfig;
  schedule: ScheduleJson;
}

const DATASETS: Record<Sport, Dataset> = {
  nhl: { data: nhlData as unknown as GameData, config: nhlConfig, schedule: nhlSchedule as unknown as ScheduleJson },
  mlb: { data: mlbData as unknown as GameData, config: mlbConfig, schedule: mlbSchedule as unknown as ScheduleJson },
};

export function getDataset(sport: Sport): Dataset {
  return DATASETS[sport];
}
