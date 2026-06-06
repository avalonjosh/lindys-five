import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NHL_TEAMS } from '@/lib/teamConfig';
import TeamTicketsHub from '@/components/affiliate/TeamTicketsHub';
import type { HubTeam } from '@/components/affiliate/TeamGearHub';

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
    title: `${full} Tickets — NHL Schedule & Seats on StubHub`,
    description: `Find ${full} tickets for every home and away game on StubHub. Verified resale with seat maps and live pricing.`,
    alternates: { canonical: `https://www.lindysfive.com/nhl/${team}/tickets` },
  };
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const t = NHL_TEAMS[team];
  if (!t) notFound();
  const hub: HubTeam = { sport: 'nhl', slug: t.slug, city: t.city, name: t.name, primaryColor: t.colors.primary, accentColor: t.colors.accent };
  return <TeamTicketsHub team={hub} stubhubId={t.stubhubId} />;
}
