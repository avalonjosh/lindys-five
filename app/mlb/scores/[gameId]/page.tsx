import type { Metadata } from 'next';
import MLBBoxScoreClient from '@/components/mlb/boxscore/MLBBoxScoreClient';

interface Props {
  params: Promise<{ gameId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  return {
    title: `Game ${gameId} — MLB Box Score`,
    description: `MLB box score, batting stats, pitching stats, and scoring plays.`,
    openGraph: {
      title: `MLB Game Box Score | Lindy's Five`,
      description: 'MLB box score with batting stats, pitching stats, and scoring plays.',
      type: 'website',
      url: `https://www.lindysfive.com/mlb/scores/${gameId}`,
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `MLB Game Box Score | Lindy's Five`,
      description: 'MLB box score with batting stats, pitching stats, and scoring plays.',
    },
    alternates: {
      canonical: `https://www.lindysfive.com/mlb/scores/${gameId}`,
    },
  };
}

export default async function MLBBoxScorePage({ params }: Props) {
  const { gameId } = await params;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com' },
              { '@type': 'ListItem', position: 2, name: 'MLB Scores', item: 'https://www.lindysfive.com/mlb/scores' },
              { '@type': 'ListItem', position: 3, name: `Game ${gameId}`, item: `https://www.lindysfive.com/mlb/scores/${gameId}` },
            ],
          }),
        }}
      />
      <MLBBoxScoreClient gameId={gameId} />
    </>
  );
}
