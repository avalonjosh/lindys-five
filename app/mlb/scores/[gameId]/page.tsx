import type { Metadata } from 'next';
import MLBBoxScoreClient from '@/components/mlb/boxscore/MLBBoxScoreClient';

interface Props {
  params: Promise<{ gameId: string }>;
}

interface MLBScheduleGame {
  gameDate?: string;
  status?: { abstractGameState?: string };
  venue?: { name?: string };
  teams?: {
    away?: { score?: number; team?: { name?: string } };
    home?: { score?: number; team?: { name?: string } };
  };
}

// Lightweight server-side fetch so the SportsEvent schema (teams, date, venue,
// result) is in the initial HTML for crawlers/AI engines.
async function fetchGameSummary(gameId: string): Promise<MLBScheduleGame | null> {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?gamePk=${gameId}&hydrate=team,linescore,venue`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.dates?.[0]?.games?.[0] ?? null;
  } catch {
    return null;
  }
}

function buildSportsEventLd(gameId: string, g: MLBScheduleGame) {
  const away = g.teams?.away?.team?.name;
  const home = g.teams?.home?.team?.name;
  if (!away || !home) return null;
  const isFinal = g.status?.abstractGameState === 'Final';
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${away} at ${home}`,
    sport: 'Baseball',
    ...(g.gameDate ? { startDate: g.gameDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    ...(isFinal && g.teams?.away?.score != null && g.teams?.home?.score != null
      ? { description: `Final: ${away} ${g.teams.away.score}, ${home} ${g.teams.home.score}.` }
      : {}),
    ...(g.venue?.name ? { location: { '@type': 'Place', name: g.venue.name } } : {}),
    organizer: { '@type': 'Organization', name: 'Major League Baseball', alternateName: 'MLB' },
    url: `https://www.lindysfive.com/mlb/scores/${gameId}`,
    competitor: [
      { '@type': 'SportsTeam', name: away },
      { '@type': 'SportsTeam', name: home },
    ],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  return {
    title: `Game ${gameId} — MLB Box Score`,
    description: `MLB box score, batting stats, pitching stats, and scoring plays.`,
    openGraph: {
      title: `MLB Game Box Score | Lindy's Five`,
      description: 'MLB box score with batting stats, pitching stats, and scoring plays.',
      type: 'website',
      url: `https://www.lindysfive.com/mlb/scores/${gameId}`,
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `MLB Game Box Score | Lindy's Five`,
      description: 'MLB box score with batting stats, pitching stats, and scoring plays.',
    },
    alternates: {
      canonical: `https://www.lindysfive.com/mlb/scores/${gameId}`,
    },
  };
}

export default async function MLBBoxScorePage({ params }: Props) {
  const { gameId } = await params;

  const summary = await fetchGameSummary(gameId);
  const sportsEventLd = summary ? buildSportsEventLd(gameId, summary) : null;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com' },
      { '@type': 'ListItem', position: 2, name: 'MLB Scores', item: 'https://www.lindysfive.com/mlb/scores' },
      { '@type': 'ListItem', position: 3, name: `Game ${gameId}`, item: `https://www.lindysfive.com/mlb/scores/${gameId}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(sportsEventLd ? [breadcrumbLd, sportsEventLd] : breadcrumbLd),
        }}
      />
      <MLBBoxScoreClient gameId={gameId} />
    </>
  );
}
