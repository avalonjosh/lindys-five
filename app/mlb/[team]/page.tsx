import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig';
import MLBTeamTracker from '@/components/mlb/MLBTeamTracker';
import NewsletterModal from '@/components/newsletter/NewsletterModal';
import SiteFooter from '@/components/SiteFooter';
import { fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { calculateMLBChunks, calculateMLBSeasonStats } from '@/lib/utils/mlbChunkCalculator';
import type { MLBGameResult } from '@/lib/types/mlb';

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
    dateModified: new Date().toISOString(),
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

  // Fetch live data server-side: the schedule seeds the tracker's SSR HTML, and
  // the standings power a visible per-team summary + division table. This is
  // the crawlable content that differentiates the 30 MLB pages.
  let initialGames: MLBGameResult[] | undefined;
  let serverSummary: ReactNode = null;
  try {
    const season = new Date().getFullYear();
    const [games, standings] = await Promise.all([
      fetchMLBSchedule(team.mlbId, season),
      fetchMLBStandings(season),
    ]);
    if (games.length > 0) initialGames = games;

    const chunks = calculateMLBChunks(games);
    const seasonStats = calculateMLBSeasonStats(chunks);
    const teamStanding = standings.find(t => t.teamId === team.mlbId);

    if (seasonStats.gamesPlayed > 0 && teamStanding) {
      const currentChunk = chunks.find(c => !c.isComplete && c.games.some(g => g.outcome !== 'PENDING')) || chunks.find(c => !c.isComplete);
      const playedGames = games.filter(g => g.outcome !== 'PENDING');
      const lastGame = playedGames[playedGames.length - 1];
      const nextGame = games.find(g => g.outcome === 'PENDING');

      const summaryText = [
        `The ${fullName} are ${teamStanding.wins}-${teamStanding.losses} (${teamStanding.winPct.toFixed(3).replace(/^0/, '')}) through ${seasonStats.gamesPlayed} games of the ${season} season — ${ordinal(teamStanding.divisionRank)} in the ${teamStanding.division}${teamStanding.gamesBack === 0 ? ', leading the division' : `, ${teamStanding.gamesBack} games back`}${teamStanding.wildCardRank ? `, and ${ordinal(teamStanding.wildCardRank)} in the wild card race${teamStanding.wildCardGamesBack > 0 ? ` (${teamStanding.wildCardGamesBack} GB)` : ''}` : ''}.`,
        `At their current pace they project to ${Math.round(seasonStats.projectedWins)} wins, ${seasonStats.winsAboveBelow >= 0 ? `${seasonStats.winsAboveBelow} above` : `${Math.abs(seasonStats.winsAboveBelow)} below`} the ${seasonStats.playoffTarget}-win playoff target.`,
        `They're ${teamStanding.streak.startsWith('W') ? 'riding' : 'on'} a ${teamStanding.streak} streak, ${teamStanding.last10} over their last 10, with a ${teamStanding.runDifferential >= 0 ? '+' : ''}${teamStanding.runDifferential} run differential (${teamStanding.runsScored} scored, ${teamStanding.runsAllowed} allowed) — ${teamStanding.homeRecord} at home, ${teamStanding.awayRecord} on the road.`,
        currentChunk ? `Current 5-game set (Set ${currentChunk.chunkNumber}): ${currentChunk.wins}-${currentChunk.losses}.` : '',
      ].filter(Boolean).join(' ');

      const divisionRows = standings
        .filter(t => t.division === teamStanding.division)
        .sort((a, b) => a.divisionRank - b.divisionRank);
      const slugByMlbId = new Map(Object.values(MLB_TEAMS).map(t => [t.mlbId, t.id]));

      serverSummary = (
        <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl md:p-6">
          <h2 className="mb-2 text-lg font-bold md:text-2xl" style={{ color: team.colors.primary }}>
            {team.name} Season So Far
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">{summaryText}</p>

          <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">
            {teamStanding.division} Standings
          </h3>
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2 font-bold">Team</th>
                  <th className="w-14 px-2 py-2 text-right font-bold">W</th>
                  <th className="w-14 px-2 py-2 text-right font-bold">L</th>
                  <th className="w-16 px-2 py-2 text-right font-bold">PCT</th>
                  <th className="w-14 px-3 py-2 text-right font-bold">GB</th>
                </tr>
              </thead>
              <tbody>
                {divisionRows.map(row => {
                  const slug = slugByMlbId.get(row.teamId);
                  const isCurrent = row.teamId === team.mlbId;
                  return (
                    <tr key={row.teamId} className={isCurrent ? 'bg-blue-50/60' : 'even:bg-gray-50'}>
                      <td className={`px-3 py-2 ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                        {slug && !isCurrent ? (
                          <Link href={`/mlb/${slug}`} className="hover:underline" style={{ color: team.colors.primary }}>
                            {row.teamName}
                          </Link>
                        ) : (
                          row.teamName
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-700">{row.wins}</td>
                      <td className="px-2 py-2 text-right text-gray-700">{row.losses}</td>
                      <td className="px-2 py-2 text-right text-gray-700">{row.winPct.toFixed(3).replace(/^0/, '')}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{row.gamesBack === 0 ? '—' : row.gamesBack}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(lastGame || nextGame) && (
            <p className="mt-3 text-xs text-gray-500">
              {lastGame && `Last game: ${lastGame.outcome} ${lastGame.teamScore}-${lastGame.opponentScore} ${lastGame.isHome ? 'vs' : 'at'} ${lastGame.opponent} (${lastGame.date}).`}
              {lastGame && nextGame && ' '}
              {nextGame && `Next game: ${nextGame.isHome ? 'vs' : 'at'} ${nextGame.opponent}, ${nextGame.date}${nextGame.startTime ? ` at ${nextGame.startTime}` : ''}.`}
            </p>
          )}
        </section>
      );
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
      {/* Fallback crawler line only when live data was unavailable (offseason/
          fetch error) — otherwise the visible serverSummary carries the content. */}
      {!serverSummary && (
        <p className="sr-only">
          {`${fullName} playoff odds and projections for the 2026 MLB season. Track ${possessive(fullName)} win pace, playoff picture, and probability — updated daily.`}
        </p>
      )}
      <MLBTeamTracker team={team} initialGames={initialGames} serverSummary={serverSummary} />
      <SiteFooter />
      <NewsletterModal
        team={teamSlug}
        teamDisplayName={team.name}
        primaryColor={team.colors.primary}
        accentColor={team.colors.accent}
      />
    </>
  );
}
