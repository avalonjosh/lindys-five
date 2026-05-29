import type { Metadata } from 'next';
import PickTheBillsClient from '@/components/pickthebills/PickTheBillsClient';

export const metadata: Metadata = {
  title: 'Pick the Bills — Predict Every Game & Climb the Leaderboard',
  description:
    'Predict whether the Buffalo Bills win or lose every game this season, revise as the year unfolds, and see how your accuracy ranks against other fans.',
  alternates: { canonical: 'https://lindysfive.com/pickthebills' },
};

export default function PickTheBillsPage() {
  return <PickTheBillsClient />;
}
