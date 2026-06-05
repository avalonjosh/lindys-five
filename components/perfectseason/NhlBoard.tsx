'use client';

import nhlDataJson from '@/data/nhl-data.json';
import nhlScheduleJson from '@/data/nhl-daily-schedule.json';
import { nhlConfig } from '@/lib/perfectseason/config.nhl';
import type { GameData } from '@/lib/perfectseason/types';
import BoardView from './BoardView';
import Rink from './nhl/Rink';
import type { ScheduleJson } from './usePerfectSeasonGame';

// Thin client wrapper: imports only the NHL dataset for the /82-0 route bundle.
const data = nhlDataJson as unknown as GameData;
const schedule = nhlScheduleJson as unknown as ScheduleJson;

export default function NhlBoard() {
  return (
    <BoardView
      sport="nhl"
      data={data}
      config={nhlConfig}
      schedule={schedule}
      defaultSpin={{ decade: '1970s', franchise: 'BUF' }}
      Diagram={Rink}
      surface="ice"
    />
  );
}
