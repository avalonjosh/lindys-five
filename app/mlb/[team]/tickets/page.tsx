import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig';
import TeamTicketsHub from '@/components/affiliate/TeamTicketsHub';
import { TICKET_AFFILIATE_ACTIVE } from '@/lib/utils/affiliateLinks';
import type { HubTeam } from '@/components/affiliate/TeamGearHub';

export const revalidate = 86400;

export function generateStaticParams() {
  return Object.keys(MLB_TEAMS).map((team) => ({ team }));
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const t = MLB_TEAMS[team];
  if (!t) return {};
  const full = `${t.city} ${t.name}`;
  const onStubHub = TICKET_AFFILIATE_ACTIVE ? ' on StubHub' : '';
  const desc = TICKET_AFFILIATE_ACTIVE
    ? `Find ${full} tickets for every home and away game on StubHub. Verified resale with seat maps and live pricing.`
    : `Find ${full} tickets for every home and away game this season, with links to each game's seats and prices.`;
  return {
    title: `${full} Tickets — MLB Schedule & Seats${onStubHub}`,
    description: desc,
    openGraph: {
      title: `${full} Tickets — MLB Schedule & Seats${onStubHub}`,
      description: desc,
      type: 'website',
      url: `https://www.lindysfive.com/mlb/${team}/tickets`,
      siteName: "Lindy's Five",
      images: [{ url: t.logo }],
    },
    twitter: {
      card: 'summary',
      title: `${full} Tickets${onStubHub}`,
      description: `Find ${full} tickets for every home and away game. Verified resale with seat maps and live pricing.`,
      images: [t.logo],
    },
    alternates: { canonical: `https://www.lindysfive.com/mlb/${team}/tickets` },
  };
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const t = MLB_TEAMS[team];
  if (!t) notFound();
  const hub: HubTeam = { sport: 'mlb', slug: t.slug, city: t.city, name: t.name, primaryColor: t.colors.primary, accentColor: t.colors.accent };
  return <TeamTicketsHub team={hub} stubhubId={t.stubhubId} />;
}
