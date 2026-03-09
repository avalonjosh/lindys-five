import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import TeamTracker from '@/components/TeamTracker';

interface TeamPageProps {
  params: Promise<{ team: string }>;
}

// Helper: possessive form that handles names ending in 's'
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export async function generateStaticParams() {
  return Object.keys(TEAMS).map((slug) => ({
    team: slug,
  }));
}

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];

  if (!team) {
    return { title: 'Team Not Found' };
  }

  const fullName = `${team.city} ${team.name}`;
  const title = `${fullName} Playoff Odds & Tracker 2026`;
  const description = `${fullName} playoff odds, chances, and projections for 2025-26. Track points pace, playoff probability, and 5-game set analysis updated daily.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description: `${fullName} playoff odds, projections, and 5-game set analysis for the 2025-26 NHL season.`,
      type: 'website',
      url: `https://lindysfive.com/${team.id}`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title,
      description: `${fullName} playoff odds, projections, and 5-game set analysis for 2025-26.`,
      images: [team.logo],
    },
    alternates: {
      canonical: `https://lindysfive.com/${team.id}`,
    },
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];

  if (!team) {
    notFound();
  }

  const fullName = `${team.city} ${team.name}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${fullName} Playoff Odds & Tracker 2026`,
    description: `${fullName} playoff odds, chances, and projections for 2025-26. Track points pace, playoff probability, and 5-game set analysis updated daily.`,
    url: `https://lindysfive.com/${team.id}`,
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    about: {
      '@type': 'SportsTeam',
      name: fullName,
      sport: 'Ice Hockey',
      memberOf: {
        '@type': 'SportsOrganization',
        name: 'National Hockey League',
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
        item: 'https://lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: fullName,
        item: `https://lindysfive.com/${team.id}`,
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
      {/* Server-rendered SEO summary for crawlers */}
      <div className="sr-only" aria-hidden="false">
        <h1>{fullName} Playoff Odds &amp; Tracker 2026</h1>
        <p>
          Track the {possessive(fullName)} playoff odds, chances, and projections
          for the 2025-26 NHL season. Follow {possessive(fullName)} points pace,
          playoff probability, and 5-game set analysis — updated daily.
        </p>
      </div>
      <TeamTracker team={team} />
    </>
  );
}
