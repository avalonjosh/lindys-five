import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import { getTeamHistory, hasTeamHistory } from '@/lib/data/teamHistory';
import HistoryTabs from './HistoryTabs';

interface HistoryPageProps {
  params: Promise<{ team: string }>;
}

export async function generateStaticParams() {
  return Object.keys(TEAMS)
    .filter((slug) => hasTeamHistory(slug))
    .map((slug) => ({ team: slug }));
}

export async function generateMetadata({ params }: HistoryPageProps): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];
  if (!team || !hasTeamHistory(teamSlug)) {
    return { title: 'Team History Not Found' };
  }

  const fullName = `${team.city} ${team.name}`;
  const title = `${fullName} Playoff History — Every Series, Every Game`;
  const description = `Complete ${fullName} playoff history: every series since ${team.city === 'Buffalo' ? '1970' : 'franchise founding'}, game-by-game results, and curated highlight videos.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://www.lindysfive.com/nhl/${team.id}/history`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [team.logo],
    },
    alternates: {
      canonical: `https://www.lindysfive.com/nhl/${team.id}/history`,
    },
  };
}

export default async function TeamHistoryPage({ params }: HistoryPageProps) {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];
  const history = getTeamHistory(teamSlug);

  if (!team || !history) {
    notFound();
  }

  const fullName = `${team.city} ${team.name}`;
  const teamUrl = `https://www.lindysfive.com/nhl/${team.id}`;
  const historyUrl = `${teamUrl}/history`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${fullName} Playoff History`,
      description: `Complete ${fullName} playoff history with series results, game-by-game breakdowns, and highlight videos.`,
      url: historyUrl,
      publisher: { '@type': 'Organization', name: 'JRR Apps' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com/' },
        { '@type': 'ListItem', position: 2, name: fullName, item: teamUrl },
        { '@type': 'ListItem', position: 3, name: 'History', item: historyUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      name: fullName,
      sport: 'Ice Hockey',
      memberOf: { '@type': 'SportsOrganization', name: 'National Hockey League' },
      url: teamUrl,
      logo: team.logo,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <header
          className="shadow-xl border-b-4"
          style={{
            background: team.colors.primary,
            borderBottomColor: team.colors.secondary,
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 text-center">
            <Link href="/" className="inline-block mb-2">
              <p
                className="text-lg sm:text-xl font-bold text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Lindy&apos;s Five
              </p>
            </Link>
            <h1
              className="text-3xl sm:text-5xl font-bold text-white mb-2"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {fullName} History
            </h1>
            <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto">
              Every playoff series. Every game. Highlights.
            </p>
            <div className="mt-4">
              <Link
                href={`/nhl/${team.id}`}
                className="inline-block text-xs sm:text-sm text-white/70 hover:text-white underline underline-offset-4 transition-colors"
              >
                ← Back to {team.name} Tracker
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
          <HistoryTabs history={history} teamColors={team.colors} />
        </main>

        <footer className="mt-auto py-6 text-center text-sm text-gray-500">
          <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </>
  );
}
