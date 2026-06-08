import MlbBoard from '@/components/perfectseason/MlbBoard';

export default function PerfectSeasonPage() {
  return (
    <>
      <h1 className="sr-only">162-0: The Perfect Season (MLB)</h1>
      <p className="sr-only">
        A free daily MLB roster puzzle from Lindy&apos;s Five. Draft an all-time team from
        decade and franchise spins, then simulate whether your lineup can win all 162 games
        and finish the season undefeated.
      </p>
      <MlbBoard />
    </>
  );
}
