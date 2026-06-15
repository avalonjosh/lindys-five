import type { Metadata } from 'next';
import ScoresPageClient from '@/components/scores/ScoresPageClient';
import { getCurrentNHLSeason, formatSeasonLabel } from '@/lib/utils/season';
import { getPlayoffsOutcome } from '@/lib/services/nhlOffseason';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const season = getCurrentNHLSeason();
  const label = formatSeasonLabel(season);
  const { complete } = await getPlayoffsOutcome(season);

  const title = complete
    ? `NHL Scores — ${label} Season Complete, Final Results`
    : 'NHL Scores Today — Live Results, Box Scores & Playoff Impact';
  const description = complete
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
      />
    </>
  );
}
