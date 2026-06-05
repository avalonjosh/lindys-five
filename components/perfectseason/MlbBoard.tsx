'use client';

import mlbDataJson from '@/data/mlb-data.json';
import mlbScheduleJson from '@/data/mlb-daily-schedule.json';
import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import type { GameData } from '@/lib/perfectseason/types';
import BoardView from './BoardView';
import Diamond from './mlb/Diamond';
import type { ScheduleJson } from './usePerfectSeasonGame';

// Thin client wrapper: imports only the MLB data/schedule so the /162-0 route
// bundle never pulls in the NHL dataset (and vice versa for NhlBoard).
const data = mlbDataJson as unknown as GameData;
const schedule = mlbScheduleJson as unknown as ScheduleJson;

export default function MlbBoard() {
  return (
    <BoardView
      sport="mlb"
      data={data}
      config={mlbConfig}
      schedule={schedule}
      defaultSpin={{ decade: '1950s', franchise: 'NYY' }}
      Diagram={Diamond}
      surface="field"
    />
  );
}
