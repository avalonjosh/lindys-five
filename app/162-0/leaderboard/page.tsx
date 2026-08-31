import type { Metadata } from 'next';
import mlbData from '@/data/mlb-data.json';
import type { GameData } from '@/lib/perfectseason/types';
import Leaderboard from '@/components/perfectseason/Leaderboard';

// Built server-side from the full dataset; only the small {id,name} list is
// serialized to the client.
const data = mlbData as unknown as GameData;
const franchises = data.franchises
  .map((f) => ({ id: f.id, name: Object.values(f.names).at(-1) ?? f.id }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const metadata: Metadata = {
  title: '162-0 Leaderboard — Perfect Season (MLB)',
  description: 'Daily, all-time, tank, and per-franchise leaderboards for the 162-0 Perfect Season MLB roster game.',
  alternates: { canonical: 'https://www.lindysfive.com/162-0/leaderboard' },
  openGraph: {
    title: '162-0 Leaderboard — Perfect Season (MLB)',
    description: 'Daily, all-time, tank, and per-franchise leaderboards for the 162-0 Perfect Season MLB roster game.',
    url: 'https://www.lindysfive.com/162-0/leaderboard',
    type: 'website',
    siteName: "Lindy's Five",
    images: [{ url: '/api/og?type=sport-hub&sport=mlb&title=162-0%20Leaderboard&subtitle=Perfect%20Season%20Daily%20%26%20All-Time%20Rankings', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function Page() {
  return <Leaderboard sport="mlb" franchises={franchises} />;
}
