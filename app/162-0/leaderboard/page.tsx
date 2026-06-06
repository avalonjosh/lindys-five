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
};

export default function Page() {
  return <Leaderboard sport="mlb" franchises={franchises} />;
}
