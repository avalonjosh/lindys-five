import type { Metadata } from 'next';
import SiteFooter from '@/components/SiteFooter';
import ScoresPageClient from '@/components/scores/ScoresPageClient';
import { getCurrentNHLSeason, formatSeasonLabel } from '@/lib/utils/season';
import { getPlayoffsOutcome, getUpcomingSeasonInfo } from '@/lib/services/nhlOffseason';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

interface ServerScoreGame {
  id: number;
  gameState: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayScore?: number;
  homeScore?: number;
  startTimeET?: string;
}

// Today's slate fetched server-side so crawlers see real games and box score
// links — the interactive scoreboard is client-rendered through robots-blocked
// /api/v1 routes, which left this page indexable on its title alone.
async function fetchTodayGamesServer(): Promise<ServerScoreGame[]> {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const data = await fetchJsonWithRetry(`https://api-web.nhle.com/v1/score/${today}`);
    return (data.games || []).map((g: any) => ({
      id: g.id,
      gameState: g.gameState,
      awayAbbrev: g.awayTeam?.abbrev || '',
      homeAbbrev: g.homeTeam?.abbrev || '',
      awayScore: g.awayTeam?.score,
      homeScore: g.homeTeam?.score,
      startTimeET: g.startTimeUTC
        ? new Date(g.startTimeUTC).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
        : undefined,
    }));
  } catch {
    return [];
  }
}

function gameLine(g: ServerScoreGame): string {
  if (g.gameState === 'FINAL' || g.gameState === 'OFF') {
    return `${g.awayAbbrev} ${g.awayScore ?? 0}, ${g.homeAbbrev} ${g.homeScore ?? 0} (Final)`;
  }
  if (g.gameState === 'LIVE' || g.gameState === 'CRIT') {
    return `${g.awayAbbrev} ${g.awayScore ?? 0}, ${g.homeAbbrev} ${g.homeScore ?? 0} (Live)`;
  }
  return `${g.awayAbbrev} at ${g.homeAbbrev}${g.startTimeET ? `, ${g.startTimeET} ET` : ''}`;
}

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const season = getCurrentNHLSeason();
  const label = formatSeasonLabel(season);
  const { complete } = await getPlayoffsOutcome(season);
  const upcoming = complete ? await getUpcomingSeasonInfo(season) : null;
  const preseason = complete && upcoming?.scheduled;

  const title = preseason
    ? `NHL Scores — ${upcoming!.seasonLabel} Season Schedule & Opening Night`
    : complete
      ? `NHL Scores — ${label} Season Complete, Final Results`
      : 'NHL Scores Today — Live Results, Box Scores & Playoff Impact';
  const description = preseason
    ? `The ${upcoming!.seasonLabel} NHL schedule is out. Browse every game and opening-night matchup for all 32 teams. Live scores and box scores return when the puck drops.`
    : complete
      ? `The ${label} NHL season is complete. Browse final game results and box scores; live scores return when next season begins in October.`
      : 'Live NHL scores, box scores, and game results for all 32 teams. See how each game impacts playoff odds and standings. Updated in real-time.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: 'https://www.lindysfive.com/nhl/scores',
      siteName: "Lindy's Five",
      images: [{ url: '/api/og?type=sport-hub&sport=nhl&title=NHL%20Scores&subtitle=Live%20results%2C%20box%20scores%20%26%20playoff%20impact', width: 1200, height: 630, alt: 'NHL Scores' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/api/og?type=sport-hub&sport=nhl&title=NHL%20Scores&subtitle=Live%20results%2C%20box%20scores%20%26%20playoff%20impact'],
    },
    alternates: {
      canonical: 'https://www.lindysfive.com/nhl/scores',
    },
  };
}

export default async function ScoresPageWrapper() {
  const season = getCurrentNHLSeason();
  const seasonLabel = formatSeasonLabel(season);
  const { complete: seasonComplete, championName } = await getPlayoffsOutcome(season);
  // Once the season is over, check whether next season's schedule is out — if so,
  // the scores page opens on Opening Night instead of an empty summer date.
  const upcoming = seasonComplete ? await getUpcomingSeasonInfo(season) : null;
  const preseason = Boolean(seasonComplete && upcoming?.scheduled);
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
        name: 'NHL',
        item: 'https://www.lindysfive.com/nhl',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Scores',
        item: 'https://www.lindysfive.com/nhl/scores',
      },
    ],
  };

  const todayGames = seasonComplete && !preseason ? [] : await fetchTodayGamesServer();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {todayGames.length > 0 && (
        <section className="sr-only">
          <h2>Today&apos;s NHL games</h2>
          <ul>
            {todayGames.map((g) => (
              <li key={g.id}>
                <a href={`/nhl/scores/${g.id}`}>{gameLine(g)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ScoresPageClient
        seasonComplete={seasonComplete}
        championName={championName}
        seasonLabel={seasonLabel}
        preseason={preseason}
        upcomingSeasonLabel={upcoming?.seasonLabel}
        openingDate={upcoming?.openingDate}
        preseasonStartDate={upcoming?.preseasonStartDate}
      />
      <SiteFooter />
    </>
  );
}
