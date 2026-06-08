import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig';
import TeamGearHub, { type HubTeam } from '@/components/affiliate/TeamGearHub';

export const revalidate = 86400;

export function generateStaticParams() {
  return Object.keys(MLB_TEAMS).map((team) => ({ team }));
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const t = MLB_TEAMS[team];
  if (!t) return {};
  const full = `${t.city} ${t.name}`;
  return {
    title: `${full} Gear & Jerseys — Shop MLB Fan Merch`,
    description: `Shop ${full} jerseys, hats, and apparel from Amazon and Fanatics. Officially licensed MLB fan gear.`,
    openGraph: {
      title: `${full} Gear & Jerseys — Shop MLB Fan Merch`,
      description: `Shop ${full} jerseys, hats, and apparel. Officially licensed MLB fan gear.`,
      type: 'website',
      url: `https://www.lindysfive.com/mlb/${team}/gear`,
      siteName: "Lindy's Five",
      images: [{ url: t.logo }],
    },
    twitter: {
      card: 'summary',
      title: `${full} Gear & Jerseys`,
      description: `Shop ${full} jerseys, hats, and apparel. Officially licensed MLB fan gear.`,
      images: [t.logo],
    },
    alternates: { canonical: `https://www.lindysfive.com/mlb/${team}/gear` },
  };
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const t = MLB_TEAMS[team];
  if (!t) notFound();
  const hub: HubTeam = { sport: 'mlb', slug: t.slug, city: t.city, name: t.name, primaryColor: t.colors.primary, accentColor: t.colors.accent };
  return <TeamGearHub team={hub} />;
}
