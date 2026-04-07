import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import TeamTracker from '@/components/TeamTracker';
import TeamPlayoffStatus from '@/components/playoffs/TeamPlayoffStatus';
import NewsletterModal from '@/components/newsletter/NewsletterModal';
import { fetchWithRetry } from '@/lib/services/nhlApi';
import { calculateChunks, calculateSeasonStats } from '@/lib/utils/chunkCalculator';
import { computePositionAwareProbability, getPlayoffStatusMessage } from '@/lib/utils/playoffProbability';
import type { GameResult } from '@/lib/types';

export const revalidate = 300; // ISR: revalidate every 5 minutes for fresh data

interface TeamPageProps {
  params: Promise<{ team: string }>;
}

interface NHLStandingsEntry {
  teamAbbrev: { default: string };
  divisionName: string;
  divisionSequence: number;
  conferenceSequence: number;
  conferenceName: string;
  wildcardSequence: number;
  clinchIndicator?: string;
  points: number;
  wins: number;
  losses: number;
  otLosses: number;
  gamesPlayed: number;
  streakCode: string;
  streakCount: number;
  l10Wins: number;
  l10Losses: number;
  l10OtLosses: number;
  goalDifferential: number;
  goalFor: number;
  goalAgainst: number;
  homeWins: number;
  homeLosses: number;
  homeOtLosses: number;
  roadWins: number;
  roadLosses: number;
  roadOtLosses: number;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getCurrentNHLSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) return `${year}${year + 1}`;
  return `${year - 1}${year}`;
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
      url: `https://www.lindysfive.com/nhl/${team.id}`,
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
      canonical: `https://www.lindysfive.com/nhl/${team.id}`,
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
    url: `https://www.lindysfive.com/nhl/${team.id}`,
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
        name: 'NHL',
        item: 'https://www.lindysfive.com/nhl',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: fullName,
        item: `https://www.lindysfive.com/nhl/${team.id}`,
      },
    ],
  };

  // Fetch live data server-side for SEO (direct NHL API, not proxy)
  let seoContent: string | null = null;
  try {
    const season = getCurrentNHLSeason();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [scheduleRes, standingsRes] = await Promise.all([
      fetchWithRetry(`https://api-web.nhle.com/v1/club-schedule-season/${team.abbreviation}/${season}`, 1),
      fetchWithRetry(`https://api-web.nhle.com/v1/standings/${today}`, 1),
    ]);

    const scheduleData = await scheduleRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regularGames = (scheduleData.games || []).filter((g: any) => g.gameType === 2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games: GameResult[] = regularGames.map((game: any) => {
      const isHome = game.homeTeam.id === team.nhlId;
      const myTeam = isHome ? game.homeTeam : game.awayTeam;
      const oppTeam = isHome ? game.awayTeam : game.homeTeam;
      let outcome: 'W' | 'OTL' | 'L' | 'PENDING' = 'PENDING';
      let points = 0;
      if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
        const won = myTeam.score > oppTeam.score;
        const ot = game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO';
        if (won) { outcome = 'W'; points = 2; }
        else if (ot) { outcome = 'OTL'; points = 1; }
        else { outcome = 'L'; points = 0; }
      }
      const gameDateEST = new Date(game.gameDate + 'T00:00:00-05:00').toLocaleDateString('en-US', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      });
      let startTime: string | undefined;
      if (game.startTimeUTC) {
        startTime = new Date(game.startTimeUTC).toLocaleTimeString('en-US', {
          timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
        });
      }
      return {
        date: gameDateEST, startTime, opponent: oppTeam.abbrev, opponentLogo: oppTeam.logo || '',
        isHome, sabresScore: myTeam.score || 0, opponentScore: oppTeam.score || 0,
        outcome, points, gameState: game.gameState, gameId: game.id,
      };
    });

    const chunks = calculateChunks(games);
    const seasonStats = calculateSeasonStats(chunks);

    // Parse standings for division rank and conference context
    const standingsData = await standingsRes.json();
    const allTeams: NHLStandingsEntry[] = standingsData.standings || [];
    const teamStanding = allTeams.find((t: NHLStandingsEntry) => t.teamAbbrev.default === team.abbreviation);

    if (seasonStats.gamesPlayed > 0 && teamStanding) {
      // Determine division and wildcard cut lines from conference standings
      const confTeams = allTeams.filter((t: NHLStandingsEntry) => t.conferenceName === teamStanding.conferenceName);
      const divTeams = allTeams.filter((t: NHLStandingsEntry) => t.divisionName === teamStanding.divisionName);
      const sortedDiv = divTeams.sort((a: NHLStandingsEntry, b: NHLStandingsEntry) => b.points - a.points);
      const div3Points = sortedDiv[2]?.points || 96;
      const confSorted = confTeams.sort((a: NHLStandingsEntry, b: NHLStandingsEntry) => b.points - a.points);
      // WC cut line: 8th best in conference (approximate)
      const wc8Points = confSorted[7]?.points || 96;

      const divCutLine = Math.max(div3Points, 96);
      const wcCutLine = Math.max(wc8Points, 96);
      const isInPlayoffPosition = teamStanding.divisionSequence <= 3 || (teamStanding.wildcardSequence > 0 && teamStanding.wildcardSequence <= 2);

      const { probability } = computePositionAwareProbability(
        seasonStats.projectedPoints, seasonStats.gamesPlayed,
        divCutLine, wcCutLine, isInPlayoffPosition
      );
      const statusMessage = getPlayoffStatusMessage(probability, seasonStats.gamesPlayed);

      // Find current set, last game, next game
      const currentChunk = chunks.find(c => !c.isComplete && c.games.some(g => g.outcome !== 'PENDING')) || chunks.find(c => !c.isComplete);
      const playedGames = games.filter(g => g.outcome !== 'PENDING');
      const lastGame = playedGames[playedGames.length - 1];
      const nextGame = games.find(g => g.outcome === 'PENDING');

      const lines: string[] = [];
      lines.push(`${fullName} 2025-26 Season: ${teamStanding.wins}-${teamStanding.losses}-${teamStanding.otLosses}, ${teamStanding.points} points through ${teamStanding.gamesPlayed} games.`);
      lines.push(`${ordinal(teamStanding.divisionSequence)} in the ${teamStanding.divisionName} Division, ${ordinal(teamStanding.conferenceSequence)} in the ${teamStanding.conferenceName} Conference.`);
      lines.push(`${Math.round(seasonStats.projectedPoints)} projected points at current pace — ${seasonStats.pointsAboveBelow >= 0 ? seasonStats.pointsAboveBelow + ' above' : Math.abs(seasonStats.pointsAboveBelow) + ' below'} the ${seasonStats.playoffTarget}-point playoff target.`);
      lines.push(`${Math.round(probability)}% playoff probability. ${statusMessage}.`);

      if (teamStanding.clinchIndicator) {
        const clinchMap: Record<string, string> = { x: 'Clinched playoff berth', y: 'Clinched division', z: 'Clinched conference', p: 'Presidents\' Trophy' };
        lines.push(clinchMap[teamStanding.clinchIndicator] || `Clinch indicator: ${teamStanding.clinchIndicator}.`);
      }

      lines.push(`Streak: ${teamStanding.streakCode}${teamStanding.streakCount}. Last 10: ${teamStanding.l10Wins}-${teamStanding.l10Losses}-${teamStanding.l10OtLosses}. Goal differential: ${teamStanding.goalDifferential >= 0 ? '+' : ''}${teamStanding.goalDifferential} (${teamStanding.goalFor} GF, ${teamStanding.goalAgainst} GA).`);
      lines.push(`Home: ${teamStanding.homeWins}-${teamStanding.homeLosses}-${teamStanding.homeOtLosses}. Away: ${teamStanding.roadWins}-${teamStanding.roadLosses}-${teamStanding.roadOtLosses}.`);

      if (currentChunk) {
        const setW = currentChunk.wins;
        const setOTL = currentChunk.otLosses;
        const setL = currentChunk.losses;
        lines.push(`Current 5-game set (Set ${currentChunk.chunkNumber}): ${setW}-${setOTL}-${setL}, ${currentChunk.points} of ${currentChunk.maxPoints} points.`);
      }

      if (lastGame) {
        const lastScore = `${lastGame.sabresScore}-${lastGame.opponentScore}`;
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
        <h1>{fullName} Playoff Odds &amp; Standings 2025-26</h1>
        <p>
          {seoContent || `${fullName} playoff odds, chances, and Stanley Cup projections for the 2025-26 NHL season. Track ${possessive(fullName)} points pace, playoff picture, playoff probability, and wild card standings — updated daily.`}
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
