import NhlBoard from '@/components/perfectseason/NhlBoard';
import { getScheduleWindow } from '@/lib/perfectseason/server/datasets';

// Re-rendered hourly so the schedule window (and the daily date in the layout
// metadata) tracks the Eastern calendar day.
export const revalidate = 3600;

export default function PerfectSeasonNhlPage() {
  const schedule = getScheduleWindow('nhl');
  return (
    <>
      <h1 className="sr-only">82-0: The Perfect Season (NHL)</h1>
      <p className="sr-only">
        A free daily NHL roster puzzle from Lindy&apos;s Five. Draft an all-time team from
        decade and franchise spins, then simulate whether your lineup can win all 82 games
        and finish the season undefeated.
      </p>
      <NhlBoard schedule={schedule} />
    </>
  );
}
