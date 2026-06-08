import NhlBoard from '@/components/perfectseason/NhlBoard';

export default function PerfectSeasonNhlPage() {
  return (
    <>
      <h1 className="sr-only">82-0: The Perfect Season (NHL)</h1>
      <p className="sr-only">
        A free daily NHL roster puzzle from Lindy&apos;s Five. Draft an all-time team from
        decade and franchise spins, then simulate whether your lineup can win all 82 games
        and finish the season undefeated.
      </p>
      <NhlBoard />
    </>
  );
}
