import type { Metadata } from 'next';
import ScoresPageClient from '@/components/scores/ScoresPageClient';

export const metadata: Metadata = {
  title: "NHL Scores",
  description: 'Live NHL scores and game results for all teams. Updated in real-time during games.',
  openGraph: {
    title: "NHL Scores",
    description: 'Live NHL scores and game results for all teams.',
    type: 'website',
    url: 'https://lindysfive.com/scores',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary',
    title: "NHL Scores",
    description: 'Live NHL scores and game results for all teams.',
  },
  alternates: {
    canonical: 'https://lindysfive.com/scores',
  },
};

export default function ScoresPageWrapper() {
  return <ScoresPageClient />;
}
