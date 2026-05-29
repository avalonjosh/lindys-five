import type { Metadata } from 'next';
import Link from 'next/link';
import MLBTeamNav from '@/components/mlb/MLBTeamNav';
import MLBPlayoffOddsClient, { type MLBTeamRow } from '@/components/mlb/MLBPlayoffOddsClient';
import { MLB_TEAMS } from '@/lib/teamConfig';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import type { MLBStandingsTeam } from '@/lib/types/mlb';
import {
  getMLBPlayoffProbability,
  isMLBInPlayoffPosition,
} from '@/lib/utils/mlbStandingsCalc';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export const metadata: Metadata = {
  title: 'MLB Playoff Odds 2026 — Standings, Projections & Playoff Picture',
  description:
    'MLB playoff odds, standings, and projections for all 30 teams in 2026. Track playoff probability, World Series odds, win pace, and the wild card race updated daily.',
  openGraph: {
    title: 'MLB Playoff Odds 2026 — Standings, Projections & Playoff Picture',
    description:
      'MLB playoff odds, standings, and playoff picture for all 30 teams. World Series projections and wild card race updated daily.',
    type: 'website',
    url: 'https://www.lindysfive.com/mlb/playoff-odds',
    siteName: "Lindy's Five",
    images: [
      {
        url: '/api/og?type=sport-hub&sport=mlb&title=MLB%20Playoff%20Odds%202026&subtitle=Live%20Standings%2C%20Projections%20%26%20Wild%20Card%20Race',
        width: 1200,
        height: 630,
        alt: 'MLB Playoff Odds 2026 — Lindy\'s Five',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MLB Playoff Odds 2026 — Standings & Playoff Picture',
    description:
      'MLB playoff odds, standings, and projections for all 30 teams. Playoff picture and World Series odds updated daily.',
    images: ['/api/og?type=sport-hub&sport=mlb&title=MLB%20Playoff%20Odds%202026&subtitle=Live%20Standings%2C%20Projections%20%26%20Wild%20Card%20Race'],
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/mlb/playoff-odds',
  },
};

const abbrevToSlug = Object.fromEntries(
  Object.entries(MLB_TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

function buildTeamRows(standings: MLBStandingsTeam[]): MLBTeamRow[] {
  return standings.map(team => {
    const { probability, projectedWins } = getMLBPlayoffProbability(team, standings);
    return {
      team,
      slug: abbrevToSlug[team.teamAbbrev] || '',
      probability,
      projectedWins,
      inPlayoffs: isMLBInPlayoffPosition(team),
    };
  });
}

export default async function MLBPlayoffOddsPage() {
  let standings: MLBStandingsTeam[] = [];
  try {
    standings = await fetchMLBStandings();
  } catch (e) {
    console.error('Failed to fetch MLB standings:', e);
  }

  if (standings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1
            className="text-4xl font-bold mb-4 text-gray-900"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            MLB Standings Unavailable
          </h1>
          <p className="text-gray-600 mb-8">
            Unable to load MLB standings right now. Please try again in a few minutes.
          </p>
          <Link href="/mlb" className="text-blue-600 hover:text-blue-800 underline">
            Back to MLB
          </Link>
        </div>
      </div>
    );
  }

  const rows = buildTeamRows(standings);

  const totalGamesPlayed = standings.reduce((sum, t) => sum + t.wins + t.losses, 0);
  const seasonStarted = totalGamesPlayed > 0;

  // Top World Series contenders for the narrative section: 5 highest projected wins
  const topContenders = [...rows]
    .sort((a, b) => b.projectedWins - a.projectedWins)
    .slice(0, 5);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'MLB Playoff Odds 2026 — Standings, Projections & Playoff Picture',
      description:
        'MLB playoff odds, standings, and playoff picture for all 30 teams in 2026. World Series projections and wild card race updated daily.',
      url: 'https://www.lindysfive.com/mlb/playoff-odds',
      publisher: { '@type': 'Organization', name: 'JRR Apps' },
      about: {
        '@type': 'SportsOrganization',
        name: 'Major League Baseball',
        sport: 'Baseball',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com/' },
        { '@type': 'ListItem', position: 2, name: 'MLB', item: 'https://www.lindysfive.com/mlb' },
        { '@type': 'ListItem', position: 3, name: 'Playoff Odds', item: 'https://www.lindysfive.com/mlb/playoff-odds' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Which MLB teams will make the playoffs in 2026?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Twelve MLB teams qualify for the 2026 playoffs — six per league. The three division winners and the next three teams by record in each league advance. Live playoff probability for all 30 MLB teams is shown on this page, updated daily based on current standings.`,
          },
        },
        {
          '@type': 'Question',
          name: 'How are MLB playoff odds calculated?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Each team's playoff probability is calculated by projecting their current win pace over 162 games, then comparing that projection to two cut lines: the projected division-winner total and the projected third wild card total. A logistic curve converts the gap between projected wins and each cut line into a probability, and the higher of the two paths is shown. Confidence in the projection grows as the season progresses.`,
          },
        },
        {
          '@type': 'Question',
          name: 'How does the MLB playoff format work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `The MLB postseason features 12 teams in a four-round bracket. The three division winners and three wild card teams from each league qualify. The top two seeds in each league earn a first-round bye; the other four teams play a best-of-three Wild Card Series. Winners advance to the best-of-five Division Series, the best-of-seven League Championship Series, and ultimately the World Series.`,
          },
        },
        {
          '@type': 'Question',
          name: 'What is the MLB wild card race?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `The MLB wild card race determines the final three playoff spots in each league for teams that do not win their division. Wild card teams are ranked by total wins regardless of division, with the top three from each league qualifying. The third wild card cut line is the typical bubble that decides who advances and who goes home.`,
          },
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header
          className="shadow-xl border-b-4"
          style={{ background: '#002D72', borderBottomColor: '#041E42' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 text-center relative">
            <div className="absolute top-4 left-4">
              <MLBTeamNav
                currentTeamId=""
                teamColors={{ primary: '#002D72', secondary: '#E31937', accent: '#FFFFFF' }}
              />
            </div>
            <Link href="/" className="inline-block mb-2">
              <p
                className="text-xl md:text-2xl font-bold text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Lindy&apos;s Five
              </p>
            </Link>
            <h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              MLB Playoff Odds &amp; Standings 2026
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              MLB playoff picture, World Series projections, and wild card race for all 30 teams. Updated daily.
            </p>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/mlb" className="hover:text-gray-700 transition-colors">MLB</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">Playoff Odds</span>
        </nav>

        <main className="max-w-7xl mx-auto px-4 pb-16">
          {/* Top contenders summary — server-rendered for crawlers */}
          {seasonStarted && topContenders.length > 0 && (
            <section className="mb-8">
              <h2
                className="text-2xl md:text-3xl font-bold text-gray-900 mb-3"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                2026 World Series Contenders
              </h2>
              <p className="text-gray-700 leading-relaxed">
                The current World Series favorites by projected win total:{' '}
                {topContenders.map((row, i) => (
                  <span key={row.team.teamAbbrev}>
                    {i > 0 && (i === topContenders.length - 1 ? ', and ' : ', ')}
                    {row.slug ? (
                      <Link href={`/mlb/${row.slug}`} className="font-semibold text-blue-700 hover:underline">
                        {row.team.teamName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{row.team.teamName}</span>
                    )}
                    {' '}({row.projectedWins} projected wins, {row.probability}% playoff odds)
                  </span>
                ))}
                .
              </p>
            </section>
          )}

          {/* Tabbed standings views */}
          <section className="mb-10">
            <MLBPlayoffOddsClient rows={rows} />
          </section>

          {/* Narrative — keyword-rich, server-rendered */}
          <section className="mt-12 max-w-3xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900 mb-6"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              2026 MLB Playoff Race
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                The 2026 MLB playoff race features 12 postseason berths split evenly between the American
                League and the National League. Each league sends its three division winners and the next
                three teams by record, with the top two seeds in each league earning a bye through the
                Wild Card Series. Every game in the 162-game season shifts the playoff picture, which is
                why we update probabilities daily.
              </p>
              <p>
                Win pace is the single best predictor of playoff position. Teams projecting for 90 or more
                wins are typically in strong shape; teams in the 85–89 range are squarely in the wild card
                conversation; below 80 wins the playoff path usually requires a hot streak combined with
                collapses ahead. The cut lines move throughout the season — our model projects both the
                division-winner threshold and the third wild card threshold for each league and takes the
                higher of the two paths for each team&apos;s playoff probability.
              </p>
              <p>
                Run differential is the under-appreciated tiebreaker. Teams with strong run differentials
                tend to sustain their record over a long season, while teams overperforming in one-run
                games often regress. Pair the standings above with our team trackers for{' '}
                <Link href="/mlb/yankees" className="text-blue-700 hover:underline">Yankees</Link>,{' '}
                <Link href="/mlb/dodgers" className="text-blue-700 hover:underline">Dodgers</Link>,{' '}
                <Link href="/mlb/braves" className="text-blue-700 hover:underline">Braves</Link>,{' '}
                <Link href="/mlb/astros" className="text-blue-700 hover:underline">Astros</Link>,{' '}
                <Link href="/mlb/phillies" className="text-blue-700 hover:underline">Phillies</Link>, or
                any of the other{' '}
                <Link href="/mlb" className="text-blue-700 hover:underline">30 MLB teams</Link> for
                5-game set analysis, win-pace tracking, and matchup-by-matchup projections.
              </p>
            </div>
          </section>

          {/* FAQ — visible mirror of the FAQPage JSON-LD */}
          <section className="mt-12 max-w-3xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900 mb-6"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              MLB Playoff Odds FAQ
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Which MLB teams will make the playoffs in 2026?</h3>
                <p className="text-gray-700 leading-relaxed">
                  Twelve MLB teams qualify for the 2026 playoffs — six per league. The three division
                  winners and the next three teams by record in each league advance. Live playoff
                  probability for all 30 MLB teams is shown above, updated daily based on current standings.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">How are MLB playoff odds calculated?</h3>
                <p className="text-gray-700 leading-relaxed">
                  Each team&apos;s playoff probability is calculated by projecting their current win pace
                  over 162 games, then comparing that projection to two cut lines: the projected
                  division-winner total and the projected third wild card total. A logistic curve converts
                  the gap between projected wins and each cut line into a probability, and the higher of
                  the two paths is shown. Confidence in the projection grows as the season progresses.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">How does the MLB playoff format work?</h3>
                <p className="text-gray-700 leading-relaxed">
                  The MLB postseason features 12 teams in a four-round bracket. The three division winners
                  and three wild card teams from each league qualify. The top two seeds in each league
                  earn a first-round bye; the other four teams play a best-of-three Wild Card Series.
                  Winners advance to the best-of-five Division Series, the best-of-seven League
                  Championship Series, and ultimately the World Series.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">What is the MLB wild card race?</h3>
                <p className="text-gray-700 leading-relaxed">
                  The MLB wild card race determines the final three playoff spots in each league for teams
                  that do not win their division. Wild card teams are ranked by total wins regardless of
                  division, with the top three from each league qualifying. The third wild card cut line
                  is the typical bubble that decides who advances and who goes home.
                </p>
              </div>
            </div>
          </section>

          <div className="mt-12 text-center">
            <Link
              href="/mlb"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <span>&larr;</span>
              <span>Back to MLB Team Trackers</span>
            </Link>
          </div>
        </main>

        <footer className="mt-auto py-6 text-center text-sm text-gray-500">
          <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
          <p className="mt-1">Data sourced from MLB Stats API. Updated every 5 minutes.</p>
        </footer>
      </div>
    </>
  );
}
