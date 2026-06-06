import type { Metadata } from 'next';
import SharePageBody, { shareMetadata } from '@/components/perfectseason/sharePage';

type Props = { searchParams: Promise<{ id?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id } = await searchParams;
  return shareMetadata('mlb', id);
}

export default async function Page({ searchParams }: Props) {
  const { id } = await searchParams;
  return SharePageBody('mlb', id);
}
