import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig';
import MLBTeamTracker from '@/components/mlb/MLBTeamTracker';
import { fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { calculateMLBChunks, calculateMLBSeasonStats } from '@/lib/utils/mlbChunkCalculator';

export const revalidate = 300; // ISR: revalidate every 5 minutes for fresh data

interface MLBTeamPageProps {
  params: Promise<{ team: string }>;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Will the ${fullName} make the playoffs in 2026?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Track the ${possessive(fullName)} live playoff odds, win pace, and probability on this page. Updated daily with the latest standings data.`,
        },
      },
      {
        '@type': 'Question',
        name: `What are the ${possessive(fullName)} playoff odds?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `See the ${possessive(fullName)} current playoff probability percentage at the top of this page, based on win pace, division standings, and wild card positioning.`,
        },
      },
      {
        '@type': 'Question',
        name: `What are the ${possessive(fullName)} World Series odds?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${possessive(fullName)} World Series chances start with making the playoffs. Track their current playoff probability and win pace projections here.`,
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

  // Fetch live data server-side for SEO
  let seoContent: string | null = null;
  try {
    const season = new Date().getFullYear();
    const [games, standings] = await Promise.all([
      fetchMLBSchedule(team.mlbId, season),
      fetchMLBStandings(season),
    ]);

    const chunks = calculateMLBChunks(games);
    const seasonStats = calculateMLBSeasonStats(chunks);
    const teamStanding = standings.find(t => t.teamId === team.mlbId);

    if (seasonStats.gamesPlayed > 0 && teamStanding) {
      const currentChunk = chunks.find(c => !c.isComplete && c.games.some(g => g.outcome !== 'PENDING')) || chunks.find(c => !c.isComplete);
      const playedGames = games.filter(g => g.outcome !== 'PENDING');
      const lastGame = playedGames[playedGames.length - 1];
      const nextGame = games.find(g => g.outcome === 'PENDING');

      const lines: string[] = [];
      lines.push(`${fullName} ${season} Season: ${teamStanding.wins}-${teamStanding.losses} (${teamStanding.winPct.toFixed(3)}) through ${seasonStats.gamesPlayed} games.`);
      lines.push(`${ordinal(teamStanding.divisionRank)} in the ${teamStanding.division}. ${teamStanding.gamesBack === 0 ? 'Leading the division.' : teamStanding.gamesBack + ' games back.'}`);

      if (teamStanding.wildCardRank) {
        lines.push(`Wild card rank: ${ordinal(teamStanding.wildCardRank)}${teamStanding.wildCardGamesBack > 0 ? ', ' + teamStanding.wildCardGamesBack + ' GB' : ''}.`);
      }

      lines.push(`${Math.round(seasonStats.projectedWins)} projected wins at current pace — ${seasonStats.winsAboveBelow >= 0 ? seasonStats.winsAboveBelow + ' above' : Math.abs(seasonStats.winsAboveBelow) + ' below'} the ${seasonStats.playoffTarget}-win playoff target.`);

      lines.push(`Streak: ${teamStanding.streak}. Last 10: ${teamStanding.last10}. Run differential: ${teamStanding.runDifferential >= 0 ? '+' : ''}${teamStanding.runDifferential} (${teamStanding.runsScored} RS, ${teamStanding.runsAllowed} RA).`);
      lines.push(`Home: ${teamStanding.homeRecord}. Away: ${teamStanding.awayRecord}.`);

      if (currentChunk) {
        lines.push(`Current 5-game set (Set ${currentChunk.chunkNumber}): ${currentChunk.wins}-${currentChunk.losses}.`);
      }

      if (lastGame) {
        const lastScore = `${lastGame.teamScore}-${lastGame.opponentScore}`;
        lines.push(`Last game: ${lastGame.outcome} ${lastScore} ${lastGame.isHome ? 'vs' : 'at'} ${lastGame.opponent} (${lastGame.date}).`);
      }
      if (nextGame) {
        lines.push(`Next game: ${nextGame.isHome ? 'vs' : 'at'} ${nextGame.opponent}, ${nextGame.date}${nextGame.startTime ? ' at ' + nextGame.startTime : ''}.`);
      }

      seoContent = lines.join(' ');
    }
  } catch (e) {
    console.error(`SEO data fetch failed for ${team.abbreviation}:`, e);
  }

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
      {/* Server-rendered SEO summary for crawlers — live data refreshed via ISR */}
      <div className="sr-only" aria-hidden="false">
        <h1>{fullName} Playoff Odds &amp; Standings 2026</h1>
        <p>
          {seoContent || `${fullName} playoff odds and projections for the 2026 MLB season. Track ${possessive(fullName)} win pace, playoff picture, and probability — updated daily.`}
        </p>
      </div>
      <MLBTeamTracker team={team} />
    </>
  );
}
