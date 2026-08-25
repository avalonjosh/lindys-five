'use client';

import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import BoardView from './BoardView';
import BoardLoading from './BoardLoading';
import Diamond from './mlb/Diamond';
import { useGameData } from './useGameData';
import type { ScheduleJson } from './usePerfectSeasonGame';

// Thin client wrapper: the player pools are fetched from the static data
// route instead of being bundled, and only a few days of schedule arrive as props.
export default function MlbBoard({ schedule }: { schedule: ScheduleJson }) {
  const { data, error } = useGameData('mlb');
  if (!data) return <BoardLoading error={error} />;
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
