import type { Metadata } from 'next';
import BoxScoreClient from '@/components/scores/boxscore/BoxScoreClient';

interface PageProps {
  params: Promise<{ gameId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameId } = await params;
  return {
    title: `Game ${gameId} — Box Score | Lindy's Five`,
    description: `Full box score, scoring summary, player stats, and playoff impact for NHL game ${gameId}.`,
    openGraph: {
      title: `Game Box Score | Lindy's Five`,
      description: 'Full NHL box score with player stats, scoring summary, and playoff probability impact.',
      type: 'website',
      url: `https://www.lindysfive.com/nhl/scores/${gameId}`,
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `Game Box Score | Lindy's Five`,
      description: 'Full NHL box score with player stats and playoff impact.',
    },
    alternates: {
      canonical: `https://www.lindysfive.com/nhl/scores/${gameId}`,
    },
  };
}

export default async function BoxScorePage({ params }: PageProps) {
  const { gameId } = await params;

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
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Box Score',
        item: `https://www.lindysfive.com/nhl/scores/${gameId}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <BoxScoreClient gameId={gameId} />
    </>
  );
}
