import type { Metadata } from 'next';
import ScoresPageClient from '@/components/scores/ScoresPageClient';
import { getCurrentNHLSeason, formatSeasonLabel } from '@/lib/utils/season';
import { getPlayoffsOutcome, getUpcomingSeasonInfo } from '@/lib/services/nhlOffseason';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const season = getCurrentNHLSeason();
  const label = formatSeasonLabel(season);
  const { complete } = await getPlayoffsOutcome(season);
  const upcoming = complete ? await getUpcomingSeasonInfo(season) : null;
  const preseason = complete && upcoming?.scheduled;

  const title = preseason
    ? `NHL Scores — ${upcoming!.seasonLabel} Season Schedule & Opening Night`
    : complete
      ? `NHL Scores — ${label} Season Complete, Final Results`
      : 'NHL Scores Today — Live Results, Box Scores & Playoff Impact';
  const description = preseason
    ? `The ${upcoming!.seasonLabel} NHL schedule is out. Browse every game and opening-night matchup for all 32 teams. Live scores and box scores return when the puck drops.`
    : complete
      ? `The ${label} NHL season is complete. Browse final game results and box scores; live scores return when next season begins in October.`
      : 'Live NHL scores, box scores, and game results for all 32 teams. See how each game impacts playoff odds and standings. Updated in real-time.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: 'https://www.lindysfive.com/nhl/scores',
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: 'https://www.lindysfive.com/nhl/scores',
    },
  };
}

export default async function ScoresPageWrapper() {
  const season = getCurrentNHLSeason();
  const seasonLabel = formatSeasonLabel(season);
  const { complete: seasonComplete, championName } = await getPlayoffsOutcome(season);
  // Once the season is over, check whether next season's schedule is out — if so,
  // the scores page opens on Opening Night instead of an empty summer date.
  const upcoming = seasonComplete ? await getUpcomingSeasonInfo(season) : null;
  const preseason = Boolean(seasonComplete && upcoming?.scheduled);
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Scores',
        item: 'https://www.lindysfive.com/nhl/scores',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ScoresPageClient
        seasonComplete={seasonComplete}
        championName={championName}
        seasonLabel={seasonLabel}
        preseason={preseason}
        upcomingSeasonLabel={upcoming?.seasonLabel}
        openingDate={upcoming?.openingDate}
        preseasonStartDate={upcoming?.preseasonStartDate}
      />
    </>
  );
}
