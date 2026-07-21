import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findNFLTeamByPickSlug, NFL_TEAMS } from '@/lib/teamConfig';
import PickSeasonTracker from '@/components/nfl/PickSeasonTracker';

// Served publicly as /pick-the-{team} via a next.config rewrite.
export const revalidate = 300;

interface PickPageProps {
  params: Promise<{ team: string }>;
}

const SEASON = new Date().getFullYear();

export async function generateStaticParams() {
  return Object.values(NFL_TEAMS).map((team) => ({ team: team.pickSlug }));
}

export async function generateMetadata({ params }: PickPageProps): Promise<Metadata> {
  const { team: pickSlug } = await params;
  const team = findNFLTeamByPickSlug(pickSlug);
  if (!team) return { title: 'Team Not Found' };

  const fullName = `${team.city} ${team.name}`;
  const title = `Pick the ${team.name} ${SEASON} — Predict Every ${fullName} Game`;
  const description = `Pick every ${fullName} game of the ${SEASON} NFL season, save your predictions, and track your accuracy as the results come in. Free on Lindy's Five.`;
  const url = `https://www.lindysfive.com/pick-the-${team.pickSlug}`;

  return {
    title,
    description,
    openGraph: {
      title: `Pick the ${team.name} ${SEASON}`,
      description,
      type: 'website',
      url,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `Pick the ${team.name} ${SEASON}`,
      description: `Predict every ${fullName} game and track your accuracy all season.`,
      images: [team.logo],
    },
    alternates: { canonical: url },
  };
}

export default async function PickTeamPage({ params }: PickPageProps) {
  const { team: pickSlug } = await params;
  const team = findNFLTeamByPickSlug(pickSlug);
  if (!team) notFound();

  const fullName = `${team.city} ${team.name}`;
  const url = `https://www.lindysfive.com/pick-the-${team.pickSlug}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Pick the ${team.name} ${SEASON}`,
      description: `Predict every ${fullName} game of the ${SEASON} NFL season and track your accuracy.`,
      url,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      name: fullName,
      sport: 'American Football',
      memberOf: { '@type': 'SportsOrganization', name: 'National Football League' },
      logo: team.logo,
      url,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com' },
        { '@type': 'ListItem', position: 2, name: `Pick the ${team.name}`, item: url },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Server-rendered summary for crawlers/AI engines (the tracker is client-rendered). */}
      <div className="sr-only">
        <p>
          Pick the {team.name}: predict the winner of every {fullName} game in the {SEASON} NFL
          regular season — all 17 games, week by week. Save your picks with a free Lindy&apos;s Five
          account, name each set of picks, and watch your accuracy grade automatically as real
          results come in. You can also log picks you made earlier in the season.
        </p>
      </div>
      <PickSeasonTracker team={team} />
    </>
  );
}
