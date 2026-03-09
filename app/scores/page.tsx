import type { Metadata } from 'next';
import ScoresPageClient from '@/components/scores/ScoresPageClient';

export const metadata: Metadata = {
  title: "NHL Scores Today — Live Game Results",
  description: 'Live NHL scores and game results for all teams. Updated in real-time during games.',
  openGraph: {
    title: "NHL Scores Today — Live Game Results",
    description: 'Live NHL scores and game results for all teams. Updated in real-time.',
    type: 'website',
    url: 'https://lindysfive.com/scores',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary',
    title: "NHL Scores Today — Live Game Results",
    description: 'Live NHL scores and game results for all teams.',
  },
  alternates: {
    canonical: 'https://lindysfive.com/scores',
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
        item: 'https://lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Scores',
        item: 'https://lindysfive.com/scores',
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
