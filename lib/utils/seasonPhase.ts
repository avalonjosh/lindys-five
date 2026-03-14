import type { SeasonPhase } from '@/lib/types/playoffs';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

/**
 * Detect current season phase by checking the bracket API and standings.
 * Called server-side with ISR caching.
 */
export async function detectSeasonPhase(season: string = '20252026'): Promise<{
  phase: SeasonPhase;
  playoffsStartDate?: string;
}> {
  try {
    // Try fetching the playoff bracket - if it has data, we're in or past playoffs
    const bracketRes = await fetch(`${NHL_API_BASE}/playoff-bracket/${season}`, {
      next: { revalidate: 300 },
    });

    if (bracketRes.ok) {
      const bracket = await bracketRes.json();

      // Check if bracket has any rounds with series data
      const hasSeriesData = bracket.rounds?.some(
        (round: { series?: unknown[] }) => round.series && round.series.length > 0
      );

      if (hasSeriesData) {
        // Check if the final round is complete (Stanley Cup Final decided)
        const finalRound = bracket.rounds?.find(
          (r: { roundNumber: number }) => r.roundNumber === 4
        );
        const finalComplete = finalRound?.series?.some(
          (s: { topSeedWins: number; bottomSeedWins: number }) =>
            s.topSeedWins === 4 || s.bottomSeedWins === 4
        );

        if (finalComplete) {
          return { phase: 'offseason' };
        }

        return { phase: 'playoffs' };
      }
    }

    // No bracket data — check if regular season is complete
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const standingsRes = await fetch(`${NHL_API_BASE}/standings/${today}`, {
      next: { revalidate: 300 },
    });

    if (standingsRes.ok) {
      const data = await standingsRes.json();
      const standings = data.standings || [];

      // If most teams have played 82 games, regular season is over
      const teamsWithFullSeason = standings.filter(
        (t: { gamesPlayed: number }) => t.gamesPlayed >= 82
      );

      if (teamsWithFullSeason.length >= 28) {
        return { phase: 'postseason-gap' };
      }
    }

    return { phase: 'regular' };
  } catch {
    // Default to regular season on error
    return { phase: 'regular' };
  }
}
