'use client';

import { nhlConfig } from '@/lib/perfectseason/config.nhl';
import BoardView from './BoardView';
import BoardLoading from './BoardLoading';
import Rink from './nhl/Rink';
import { useGameData } from './useGameData';
import type { ScheduleJson } from './usePerfectSeasonGame';

// Thin client wrapper: the player pools are fetched from the static data
// route instead of being bundled, and only a few days of schedule arrive as props.
export default function NhlBoard({ schedule }: { schedule: ScheduleJson }) {
  const { data, error } = useGameData('nhl');
  if (!data) return <BoardLoading error={error} />;
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
