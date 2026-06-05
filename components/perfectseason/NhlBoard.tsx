'use client';

import nhlDataJson from '@/data/nhl-data.json';
import { nhlConfig } from '@/lib/perfectseason/config.nhl';
import type { GameData } from '@/lib/perfectseason/types';
import PlayClient, { type ScheduleJson } from './PlayClient';

// Thin client wrapper: imports only the NHL dataset for the /82-0 route bundle.
const data = nhlDataJson as unknown as GameData;
// The committed NHL daily schedule lands in Phase 7d; until then the Daily tab
// gracefully falls back to Free Play (dailyToday returns null on an empty map).
const schedule: ScheduleJson = { days: {} };

export default function NhlBoard() {
  return (
    <PlayClient
      sport="nhl"
      data={data}
      config={nhlConfig}
      schedule={schedule}
      defaultSpin={{ decade: '1950s', franchise: 'MTL' }}
    />
  );
}
