import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NHL_TEAMS } from '@/lib/teamConfig';
import TeamGearHub, { type HubTeam } from '@/components/affiliate/TeamGearHub';

export const revalidate = 86400;

export function generateStaticParams() {
  return Object.keys(NHL_TEAMS).map((team) => ({ team }));
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const t = NHL_TEAMS[team];
  if (!t) return {};
  const full = `${t.city} ${t.name}`;
  return {
    title: `${full} Gear & Jerseys — Shop NHL Fan Merch`,
    description: `Shop ${full} jerseys, hats, and apparel from Amazon and Fanatics. Officially licensed NHL fan gear.`,
    alternates: { canonical: `https://www.lindysfive.com/nhl/${team}/gear` },
  };
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const t = NHL_TEAMS[team];
  if (!t) notFound();
  const hub: HubTeam = { sport: 'nhl', slug: t.slug, city: t.city, name: t.name, primaryColor: t.colors.primary, accentColor: t.colors.accent };
  return <TeamGearHub team={hub} />;
}
