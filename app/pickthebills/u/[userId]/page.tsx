import PickHistoryClient from '@/components/pickthebills/PickHistoryClient';

export default async function PickHistoryPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <PickHistoryClient userId={userId} />;
}
