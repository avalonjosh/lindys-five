import type { Metadata } from 'next';
import MLBScoresPageClient from '@/components/mlb/MLBScoresPageClient';

export const metadata: Metadata = {
  title: "MLB Scores Today — Live Results & Box Scores",
  description: 'Live MLB scores and game results for all 30 teams. Updated in real-time.',
  openGraph: {
    title: "MLB Scores Today — Live Results & Box Scores",
    description: 'Live MLB scores and game results for all 30 teams.',
    type: 'website',
    url: 'https://www.lindysfive.com/mlb/scores',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary',
    title: "MLB Scores Today — Live Results",
    description: 'Live MLB scores for all 30 teams.',
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/mlb/scores',
  },
};

export default function MLBScoresPage() {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com' },
      { '@type': 'ListItem', position: 2, name: 'MLB', item: 'https://www.lindysfive.com/mlb' },
      { '@type': 'ListItem', position: 3, name: 'Scores', item: 'https://www.lindysfive.com/mlb/scores' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <MLBScoresPageClient />
    </>
  );
}
