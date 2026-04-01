import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig';
import MLBTeamTracker from '@/components/mlb/MLBTeamTracker';

interface MLBTeamPageProps {
  params: Promise<{ team: string }>;
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export async function generateStaticParams() {
  return Object.keys(MLB_TEAMS).map((slug) => ({
    team: slug,
  }));
}

export async function generateMetadata({ params }: MLBTeamPageProps): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = MLB_TEAMS[teamSlug];

  if (!team) {
    return { title: 'Team Not Found' };
  }

  const fullName = `${team.city} ${team.name}`;
  const title = `${fullName} Playoff Odds & Standings 2026 — Chances & Projections`;
  const description = `${fullName} playoff odds and projections for 2026. Track ${possessive(fullName)} win pace, playoff picture, and probability updated daily.`;

  return {
    title,
    description,
    openGraph: {
      title: `${fullName} Playoff Odds 2026 — Standings & Projections`,
      description: `${fullName} playoff odds and projections for the 2026 MLB season. Win pace and playoff picture updated daily.`,
      type: 'website',
      url: `https://www.lindysfive.com/mlb/${team.id}`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `${fullName} Playoff Odds 2026`,
      description: `${fullName} playoff odds and projections. Win pace and playoff picture updated daily.`,
      images: [team.logo],
    },
    alternates: {
      canonical: `https://www.lindysfive.com/mlb/${team.id}`,
    },
  };
}

export default async function MLBTeamPage({ params }: MLBTeamPageProps) {
  const { team: teamSlug } = await params;
  const team = MLB_TEAMS[teamSlug];

  if (!team) {
    notFound();
  }

  const fullName = `${team.city} ${team.name}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${fullName} Playoff Odds & Standings 2026`,
    description: `${fullName} playoff odds and projections for 2026. Track win pace, playoff picture, and probability updated daily.`,
    url: `https://www.lindysfive.com/mlb/${team.id}`,
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    about: {
      '@type': 'SportsTeam',
      name: fullName,
      sport: 'Baseball',
      memberOf: {
        '@type': 'SportsOrganization',
        name: 'Major League Baseball',
      },
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'MLB',
        item: 'https://www.lindysfive.com/mlb',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: fullName,
        item: `https://www.lindysfive.com/mlb/${team.id}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="sr-only" aria-hidden="false">
        <h1>{fullName} Playoff Odds &amp; Standings 2026</h1>
        <p>
          {fullName} playoff odds and projections for the
          2026 MLB season. Track {possessive(fullName)} win pace, playoff
          picture, and probability — updated daily.
        </p>
      </div>
      <MLBTeamTracker team={team} />
    </>
  );
}
