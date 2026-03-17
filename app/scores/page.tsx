import type { Metadata } from 'next';
import ScoresPageClient from '@/components/scores/ScoresPageClient';

export const metadata: Metadata = {
  title: "NHL Scores Today — Live Results, Box Scores & Playoff Impact",
  description: 'Live NHL scores, box scores, and game results for all 32 teams. See how each game impacts playoff odds and standings. Updated in real-time.',
  openGraph: {
    title: "NHL Scores Today — Live Results, Box Scores & Playoff Impact",
    description: 'Live NHL scores and box scores for all 32 teams. See how each game impacts playoff odds and standings.',
    type: 'website',
    url: 'https://www.lindysfive.com/scores',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary',
    title: "NHL Scores Today — Live Results & Playoff Impact",
    description: 'Live NHL scores for all 32 teams. See how each game impacts playoff odds.',
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/scores',
  },
};

export default function ScoresPageWrapper() {
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
        item: 'https://www.lindysfive.com/scores',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ScoresPageClient />
    </>
  );
}
