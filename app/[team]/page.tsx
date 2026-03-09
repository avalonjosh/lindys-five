import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import TeamTracker from '@/components/TeamTracker';

interface TeamPageProps {
  params: Promise<{ team: string }>;
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

  const title = `${team.city} ${team.name} Playoff Tracker`;
  const description = `Track the ${team.city} ${team.name}'s road to the playoffs with 5-game set analysis. Live standings, schedule, point projections, and playoff scenarios updated daily.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description: `Track the ${team.city} ${team.name}'s road to the playoffs with 5-game set analysis, live standings, and playoff projections.`,
      type: 'website',
      url: `https://lindysfive.com/${team.id}`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title,
      description: `Track the ${team.city} ${team.name}'s road to the playoffs with 5-game set analysis and playoff projections.`,
      images: [team.logo],
    },
    alternates: {
      canonical: `https://lindysfive.com/${team.id}`,
    },
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${team.city} ${team.name} Playoff Tracker`,
        description: `Track the ${team.city} ${team.name}'s road to the playoffs with 5-game set analysis`,
        url: `https://lindysfive.com/${team.id}`,
        publisher: {
          '@type': 'Organization',
          name: "Lindy's Five",
        },
        about: {
          '@type': 'SportsTeam',
          name: `${team.city} ${team.name}`,
          sport: 'Ice Hockey',
          memberOf: {
            '@type': 'SportsOrganization',
            name: 'National Hockey League',
          },
        },
      }),
    },
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];

  if (!team) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${team.city} ${team.name} Playoff Tracker`,
            description: `Track the ${team.city} ${team.name}'s road to the playoffs with 5-game set analysis`,
            url: `https://lindysfive.com/${team.id}`,
            publisher: {
              '@type': 'Organization',
              name: "Lindy's Five",
            },
            about: {
              '@type': 'SportsTeam',
              name: `${team.city} ${team.name}`,
              sport: 'Ice Hockey',
              memberOf: {
                '@type': 'SportsOrganization',
                name: 'National Hockey League',
              },
            },
          }),
        }}
      />
      <TeamTracker team={team} />
    </>
  );
}
