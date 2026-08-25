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
import { easternDateString } from '@/lib/perfectseason/seed';
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

/**
 * The canonical daily schedule trimmed to a window around today (Eastern), so
 * the board page only serializes a few days instead of the full ~235KB season.
 */
export function getScheduleWindow(sport: Sport, days = 2): ScheduleJson {
  const all = getDataset(sport).schedule.days;
  const out: ScheduleJson['days'] = {};
  const now = new Date();
  for (let offset = -days; offset <= days; offset++) {
    const key = easternDateString(new Date(now.getTime() + offset * 86_400_000));
    if (all[key]) out[key] = all[key];
  }
  return { days: out };
}
