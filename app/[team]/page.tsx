import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import TeamTracker from '@/components/TeamTracker';
import TeamPlayoffStatus from '@/components/playoffs/TeamPlayoffStatus';
import NewsletterModal from '@/components/newsletter/NewsletterModal';

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
  const title = `${fullName} Playoff Odds & Standings 2025-26 — Chances & Projections`;
  const description = `${fullName} playoff odds, playoff chances, and Stanley Cup projections for 2025-26. Track ${possessive(fullName)} points pace, playoff picture, and playoff probability updated daily.`;

  return {
    title,
    description,
    openGraph: {
      title: `${fullName} Playoff Odds 2025-26 — Chances, Standings & Projections`,
      description: `${fullName} playoff odds, chances, and Stanley Cup projections for the 2025-26 NHL season. Points pace and playoff picture updated daily.`,
      type: 'website',
      url: `https://www.lindysfive.com/${team.id}`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `${fullName} Playoff Odds 2025-26`,
      description: `${fullName} playoff odds, chances, and Stanley Cup projections. Points pace and playoff picture updated daily.`,
      images: [team.logo],
    },
    alternates: {
      canonical: `https://www.lindysfive.com/${team.id}`,
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
    name: `${fullName} Playoff Odds & Standings 2025-26`,
    description: `${fullName} playoff odds, chances, and Stanley Cup projections for 2025-26. Track playoff probability, points pace, and playoff picture updated daily.`,
    url: `https://www.lindysfive.com/${team.id}`,
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

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Will the ${fullName} make the playoffs in 2026?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Track the ${possessive(fullName)} live playoff odds, points pace, and probability on this page. Updated daily with the latest standings data.`,
        },
      },
      {
        '@type': 'Question',
        name: `What are the ${possessive(fullName)} playoff odds?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `See the ${possessive(fullName)} current playoff probability percentage at the top of this page, based on points pace, division standings, and wild card positioning.`,
        },
      },
      {
        '@type': 'Question',
        name: `What are the ${possessive(fullName)} Stanley Cup odds?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${possessive(fullName)} Stanley Cup chances start with making the playoffs. Track their current playoff probability and points pace projections here.`,
        },
      },
    ],
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
        name: fullName,
        item: `https://www.lindysfive.com/${team.id}`,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      {/* Server-rendered SEO summary for crawlers */}
      <div className="sr-only" aria-hidden="false">
        <h1>{fullName} Playoff Odds &amp; Standings 2025-26</h1>
        <p>
          {fullName} playoff odds, chances, and Stanley Cup projections for the
          2025-26 NHL season. Track {possessive(fullName)} points pace, playoff
          picture, playoff probability, and wild card standings — updated daily.
        </p>
      </div>
      <TeamPlayoffStatus teamAbbrev={team.abbreviation} teamName={team.name} primaryColor={team.colors.primary} />
      <TeamTracker team={team} />
      <NewsletterModal
        team={teamSlug}
        teamDisplayName={team.name}
        primaryColor={team.colors.primary}
        accentColor={team.colors.accent}
      />
    </>
  );
}
