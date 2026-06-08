import type { Metadata } from 'next';
import type { LandingResponse } from '@/lib/types/boxscore';
import BoxScoreClient from '@/components/scores/boxscore/BoxScoreClient';

interface PageProps {
  params: Promise<{ gameId: string }>;
}

// Lightweight server-side fetch of the game's landing summary so the SportsEvent
// schema (teams, date, venue, result) is in the initial HTML for crawlers/AI engines.
async function fetchGameSummary(gameId: string): Promise<LandingResponse | null> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as LandingResponse;
  } catch {
    return null;
  }
}

function buildSportsEventLd(gameId: string, g: LandingResponse) {
  const away = `${g.awayTeam.placeName.default} ${g.awayTeam.commonName.default}`.trim();
  const home = `${g.homeTeam.placeName.default} ${g.homeTeam.commonName.default}`.trim();
  const isFinal = ['FINAL', 'OFF'].includes(g.gameState);
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${away} at ${home}`,
    sport: 'Ice Hockey',
    startDate: g.startTimeUTC || g.gameDate,
    eventStatus: 'https://schema.org/EventScheduled',
    ...(isFinal
      ? { description: `Final: ${away} ${g.awayTeam.score}, ${home} ${g.homeTeam.score}.` }
      : {}),
    ...(g.venue?.default ? { location: { '@type': 'Place', name: g.venue.default } } : {}),
    organizer: { '@type': 'Organization', name: 'National Hockey League', alternateName: 'NHL' },
    url: `https://www.lindysfive.com/nhl/scores/${gameId}`,
    competitor: [
      { '@type': 'SportsTeam', name: away },
      { '@type': 'SportsTeam', name: home },
    ],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameId } = await params;
  return {
    title: `Game ${gameId} — Box Score | Lindy's Five`,
    description: `Full box score, scoring summary, player stats, and playoff impact for NHL game ${gameId}.`,
    openGraph: {
      title: `Game Box Score | Lindy's Five`,
      description: 'Full NHL box score with player stats, scoring summary, and playoff probability impact.',
      type: 'website',
      url: `https://www.lindysfive.com/nhl/scores/${gameId}`,
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `Game Box Score | Lindy's Five`,
      description: 'Full NHL box score with player stats and playoff impact.',
    },
    alternates: {
      canonical: `https://www.lindysfive.com/nhl/scores/${gameId}`,
    },
  };
}

export default async function BoxScorePage({ params }: PageProps) {
  const { gameId } = await params;

  const summary = await fetchGameSummary(gameId);
  const sportsEventLd = summary ? buildSportsEventLd(gameId, summary) : null;

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
        name: 'Scores',
        item: 'https://www.lindysfive.com/nhl/scores',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Box Score',
        item: `https://www.lindysfive.com/nhl/scores/${gameId}`,
      },
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
      <BoxScoreClient gameId={gameId} />
    </>
  );
}
