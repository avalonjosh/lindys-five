import type { Metadata } from 'next';
import nhlData from '@/data/nhl-data.json';
import type { GameData } from '@/lib/perfectseason/types';
import Leaderboard from '@/components/perfectseason/Leaderboard';

// Built server-side from the full dataset; only the small {id,name} list is
// serialized to the client.
const data = nhlData as unknown as GameData;
const franchises = data.franchises
  .map((f) => ({ id: f.id, name: Object.values(f.names).at(-1) ?? f.id }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const metadata: Metadata = {
  title: '82-0 Leaderboard — Perfect Season (NHL)',
  description: 'Daily, all-time, tank, and per-franchise leaderboards for the 82-0 Perfect Season NHL roster game.',
  alternates: { canonical: 'https://www.lindysfive.com/82-0/leaderboard' },
};

export default function Page() {
  return <Leaderboard sport="nhl" franchises={franchises} />;
}
