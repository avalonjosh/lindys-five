import type { Metadata } from 'next';
import SiteFooter from '@/components/SiteFooter';
import MLBScoresPageClient from '@/components/mlb/MLBScoresPageClient';
import { fetchMLBScores } from '@/lib/services/mlbApi';
import type { MLBScoreGame } from '@/lib/types/mlb';

export const revalidate = 300;

function gameLine(g: MLBScoreGame): string {
  if (g.gameState === 'Final' || g.gameState === 'Game Over' || g.gameState === 'Completed Early') {
    return `${g.awayTeam.abbrev} ${g.awayTeam.score}, ${g.homeTeam.abbrev} ${g.homeTeam.score} (Final)`;
  }
  if (g.gameState === 'In Progress') {
    return `${g.awayTeam.abbrev} ${g.awayTeam.score}, ${g.homeTeam.abbrev} ${g.homeTeam.score} (Live)`;
  }
  return `${g.awayTeam.abbrev} at ${g.homeTeam.abbrev}${g.startTime ? `, ${g.startTime} ET` : ''}`;
}

export const metadata: Metadata = {
  title: "MLB Scores Today — Live Results & Box Scores",
  description: 'Live MLB scores and game results for all 30 teams. Updated in real-time.',
  openGraph: {
    title: "MLB Scores Today — Live Results & Box Scores",
    description: 'Live MLB scores and game results for all 30 teams.',
    type: 'website',
    url: 'https://www.lindysfive.com/mlb/scores',
    siteName: "Lindy's Five",
    images: [{ url: '/api/og?type=sport-hub&sport=mlb&title=MLB%20Scores&subtitle=Live%20results%2C%20box%20scores%20%26%20playoff%20impact', width: 1200, height: 630, alt: 'MLB Scores' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og?type=sport-hub&sport=mlb&title=MLB%20Scores&subtitle=Live%20results%2C%20box%20scores%20%26%20playoff%20impact'],
    title: "MLB Scores Today — Live Results",
    description: 'Live MLB scores for all 30 teams.',
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/mlb/scores',
  },
};

export default async function MLBScoresPage() {
  // Today's slate server-side so crawlers see real games and box score links —
  // the interactive scoreboard is client-rendered via robots-blocked API routes.
  let todayGames: MLBScoreGame[] = [];
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    todayGames = await fetchMLBScores(today);
  } catch {
    // render without the crawler block
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com' },
      { '@type': 'ListItem', position: 2, name: 'MLB', item: 'https://www.lindysfive.com/mlb' },
      { '@type': 'ListItem', position: 3, name: 'Scores', item: 'https://www.lindysfive.com/mlb/scores' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {todayGames.length > 0 && (
        <section className="sr-only">
          <h2>Today&apos;s MLB games</h2>
          <ul>
            {todayGames.map((g) => (
              <li key={g.gameId}>
                <a href={`/mlb/scores/${g.gameId}`}>{gameLine(g)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <MLBScoresPageClient />
      <SiteFooter />
    </>
  );
}
