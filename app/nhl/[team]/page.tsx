import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import TeamTracker from '@/components/TeamTracker';
import NewsletterModal from '@/components/newsletter/NewsletterModal';
import { fetchWithRetry, isRateLimitError } from '@/lib/services/nhlApi';
import { calculateChunks, calculateSeasonStats } from '@/lib/utils/chunkCalculator';
import { computePositionAwareProbability, getPlayoffStatusMessage } from '@/lib/utils/playoffProbability';
import { playoffResultText } from '@/lib/utils/seasonSummary';
import { formatSeasonEndYear, getRegularSeasonGameCount } from '@/lib/utils/season';
import { resolveSeasonContext } from '@/lib/utils/seasonContext';
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
  const { seasonLabel, seasonComplete, isPreseason } = await resolveSeasonContext(team.abbreviation);

  const title = seasonComplete
    ? `${fullName} ${seasonLabel} Season: Final Record, Standings & Playoff Results`
    : isPreseason
      ? `${fullName} ${seasonLabel} Schedule & Playoff Odds — Full Season Preview`
      : `${fullName} Playoff Odds & Standings ${seasonLabel} — Chances & Projections`;
  const description = seasonComplete
    ? `${fullName} ${seasonLabel} season recap: final record, division and conference finish, and playoff result. See how the ${possessive(fullName)} season ended.`
    : isPreseason
      ? `${fullName} ${seasonLabel} schedule, 5-game sets, opening night, and way-too-early playoff odds. Preview the ${possessive(fullName)} full ${seasonLabel} season.`
      : `${fullName} playoff odds, playoff chances, and Stanley Cup projections for ${seasonLabel}. Track ${possessive(fullName)} points pace, playoff picture, and playoff probability updated daily.`;

  const ogTitle = seasonComplete
    ? `${fullName} ${seasonLabel} Season Recap — Final Record & Playoff Result`
    : isPreseason
      ? `${fullName} ${seasonLabel} Schedule & Season Preview`
      : `${fullName} Playoff Odds ${seasonLabel} — Chances, Standings & Projections`;
  const ogDescription = seasonComplete
    ? `${fullName} ${seasonLabel} final record, standings finish, and playoff result.`
    : isPreseason
      ? `${fullName} ${seasonLabel} schedule, opening night, 5-game sets, and way-too-early playoff odds.`
      : `${fullName} playoff odds, chances, and Stanley Cup projections for the ${seasonLabel} NHL season. Points pace and playoff picture updated daily.`;

  const twitterTitle = seasonComplete
    ? `${fullName} ${seasonLabel} Season Recap`
    : isPreseason
      ? `${fullName} ${seasonLabel} Schedule & Preview`
      : `${fullName} Playoff Odds ${seasonLabel}`;

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      url: `https://www.lindysfive.com/nhl/${team.id}`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: twitterTitle,
      description: ogDescription,
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

  // Resolve which season to show and in what phase (live / complete / preseason)
  // from the NHL API, so the page flips modes on its own as the schedule changes.
  const {
    season,
    seasonLabel,
    seasonComplete,
    isPreseason,
    summary: seasonSummary,
    preseason,
    lastSeasonSummary,
  } = await resolveSeasonContext(team.abbreviation);
  const endYear = formatSeasonEndYear(season);
  const seasonGames = getRegularSeasonGameCount(season);

  // Human-readable opening-night sentence for preseason metadata/FAQ/SEO copy.
  const opener = preseason?.opener ?? null;
  const openerOpponentName = opener
    ? (Object.values(TEAMS).find((t) => t.abbreviation === opener.opponent)?.name ?? opener.opponent)
    : '';
  const openerText = opener
    ? `The ${fullName} open the ${seasonLabel} season ${opener.isHome ? 'at home against' : 'on the road against'} the ${openerOpponentName} on ${new Date(`${opener.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`
    : `The ${fullName} ${seasonLabel} schedule has been released.`;

  // Way-too-early playoff odds sentence for preseason metadata/FAQ/SEO copy.
  const preseasonOdds = preseason?.odds ?? null;
  const oddsText = preseasonOdds
    ? `Way-too-early ${seasonLabel} projection: the ${fullName} have roughly a ${preseasonOdds.playoffProbability}% chance to make the playoffs, projected for about ${preseasonOdds.projectedPoints} points (${preseasonOdds.tier.toLowerCase()}).`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seasonComplete
      ? `${fullName} ${seasonLabel} Season: Final Record, Standings & Playoff Results`
      : isPreseason
        ? `${fullName} ${seasonLabel} Schedule & Season Preview`
        : `${fullName} Playoff Odds & Standings ${seasonLabel}`,
    description: seasonComplete
      ? `${fullName} ${seasonLabel} season recap: final record, division and conference finish, and playoff result.`
      : isPreseason
        ? `${fullName} ${seasonLabel} schedule, 5-game sets, opening night, and way-too-early playoff odds for the upcoming NHL season.`
        : `${fullName} playoff odds, chances, and Stanley Cup projections for ${seasonLabel}. Track playoff probability, points pace, and playoff picture updated daily.`,
    url: `https://www.lindysfive.com/nhl/${team.id}`,
    dateModified: new Date().toISOString(),
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

  const playoffResultAnswer =
    seasonComplete && seasonSummary ? playoffResultText(seasonSummary) : null;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seasonComplete
      ? [
          {
            '@type': 'Question',
            name: `Did the ${fullName} make the playoffs in ${endYear}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: playoffResultAnswer
                ? `${playoffResultAnswer} in the ${seasonLabel} season. See the full ${possessive(fullName)} season recap above.`
                : `See the ${possessive(fullName)} ${seasonLabel} playoff result and final standings above.`,
            },
          },
          {
            '@type': 'Question',
            name: `How did the ${fullName} finish the ${seasonLabel} season?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                seasonSummary?.finalRecord
                  ? `The ${fullName} finished ${seasonSummary.finalRecord.wins}-${seasonSummary.finalRecord.losses}-${seasonSummary.finalRecord.otLosses} with ${seasonSummary.finalRecord.points} points${seasonSummary.divisionName && seasonSummary.divisionFinish ? `, ${ordinal(seasonSummary.divisionFinish)} in the ${seasonSummary.divisionName} Division` : ''}.`
                  : `See the ${possessive(fullName)} final record and standings for the ${seasonLabel} season above.`,
            },
          },
          {
            '@type': 'Question',
            name: `When does the ${fullName} next season start?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `The NHL regular season typically opens in early October. ${possessive(fullName)} schedule and playoff odds for next season will be tracked here once the schedule is released.`,
            },
          },
        ]
      : isPreseason
      ? [
          {
            '@type': 'Question',
            name: `When do the ${fullName} play their first game in ${seasonLabel}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${openerText} See the full ${seasonLabel} schedule and 5-game sets on this page.`,
            },
          },
          {
            '@type': 'Question',
            name: `How many games are in the ${fullName} ${seasonLabel} season?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `The ${fullName} play a ${seasonGames}-game regular season in ${seasonLabel}, tracked here in ${Math.ceil(seasonGames / 5)} five-game sets.`,
            },
          },
          {
            '@type': 'Question',
            name: `What are the ${possessive(fullName)} ${seasonLabel} playoff odds?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: preseasonOdds
                ? `${oddsText} This is a preseason estimate projected from last season's results; live playoff odds update daily once the season begins.`
                : `See the ${possessive(fullName)} way-too-early ${seasonLabel} playoff outlook on this page. Live playoff odds update daily once the season starts.`,
            },
          },
        ]
      : [
          {
            '@type': 'Question',
            name: `Will the ${fullName} make the playoffs in ${endYear}?`,
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

  // Server-rendered SEO summary for crawlers — past-tense in the offseason,
  // live stats during the season.
  let seoContent: string | null = null;

  if (seasonComplete && seasonSummary) {
    const r = seasonSummary.finalRecord;
    const parts: string[] = [];
    parts.push(
      r
        ? `${fullName} finished the ${seasonLabel} season ${r.wins}-${r.losses}-${r.otLosses} with ${r.points} points in ${r.gamesPlayed} games.`
        : `${fullName} ${seasonLabel} season recap.`
    );
    if (seasonSummary.divisionFinish && seasonSummary.divisionName) {
      parts.push(
        `Finished ${ordinal(seasonSummary.divisionFinish)} in the ${seasonSummary.divisionName} Division${
          seasonSummary.conferenceFinish && seasonSummary.conferenceName
            ? `, ${ordinal(seasonSummary.conferenceFinish)} in the ${seasonSummary.conferenceName} Conference`
            : ''
        }.`
      );
    }
    parts.push(`${playoffResultText(seasonSummary)}.`);
    parts.push(
      `${possessive(fullName)} schedule and playoff odds for next season will be tracked here once the new NHL schedule is released.`
    );
    seoContent = parts.join(' ');
  } else if (isPreseason) {
    const parts: string[] = [];
    parts.push(
      `${fullName} ${seasonLabel} season preview: full schedule, ${seasonGames}-game regular season, and ${Math.ceil(seasonGames / 5)} five-game sets.`
    );
    parts.push(openerText);
    if (lastSeasonSummary?.finalRecord) {
      const r = lastSeasonSummary.finalRecord;
      // Lowercase only the leading verb so opponent/round names stay capitalized
      // ("...eliminated in the First Round by the Ducks", not "...the ducks").
      const outcome = playoffResultText(lastSeasonSummary);
      const outcomeLower = outcome.charAt(0).toLowerCase() + outcome.slice(1);
      parts.push(
        `Last season the ${fullName} finished ${r.wins}-${r.losses}-${r.otLosses} with ${r.points} points; ${outcomeLower}.`
      );
    }
    if (oddsText) {
      parts.push(oddsText);
    }
    parts.push(
      `Full ${seasonLabel} schedule and 5-game set tracking are on this page, with live playoff probability updating daily once the season begins.`
    );
    seoContent = parts.join(' ');
  }

  // Fetch live data server-side for SEO (direct NHL API, not proxy).
  // Skipped in preseason (no games played, standings feed is empty).
  if (!seasonComplete && !isPreseason) try {
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
        divCutLine, wcCutLine, isInPlayoffPosition, teamStanding.clinchIndicator
      );
      const statusMessage = getPlayoffStatusMessage(probability, seasonStats.gamesPlayed);

      // Find current set, last game, next game
      const currentChunk = chunks.find(c => !c.isComplete && c.games.some(g => g.outcome !== 'PENDING')) || chunks.find(c => !c.isComplete);
      const playedGames = games.filter(g => g.outcome !== 'PENDING');
      const lastGame = playedGames[playedGames.length - 1];
      const nextGame = games.find(g => g.outcome === 'PENDING');

      const lines: string[] = [];
      lines.push(`${fullName} ${seasonLabel} Season: ${teamStanding.wins}-${teamStanding.losses}-${teamStanding.otLosses}, ${teamStanding.points} points through ${teamStanding.gamesPlayed} games.`);
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
    if (isRateLimitError(e)) {
      console.warn(`SEO data fetch rate-limited for ${team.abbreviation} — falling back to default meta`);
    } else {
      console.error(`SEO data fetch failed for ${team.abbreviation}:`, e);
    }
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
        <h1>
          {seasonComplete
            ? `${fullName} ${seasonLabel} Season: Final Record, Standings & Playoff Results`
            : isPreseason
              ? `${fullName} ${seasonLabel} Schedule, 5-Game Sets & Season Preview`
              : `${fullName} Playoff Odds & Standings ${seasonLabel}`}
        </h1>
        <p>
          {seoContent ||
            (seasonComplete
              ? `${fullName} ${seasonLabel} season recap: final record, division and conference finish, and playoff result. Next season's schedule and playoff odds will be tracked here once released.`
              : isPreseason
                ? `${fullName} ${seasonLabel} schedule and season preview: opening night, ${seasonGames}-game regular season, ${Math.ceil(seasonGames / 5)} five-game sets, and way-too-early playoff odds.`
                : `${fullName} playoff odds, chances, and Stanley Cup projections for the ${seasonLabel} NHL season. Track ${possessive(fullName)} points pace, playoff picture, playoff probability, and wild card standings — updated daily.`)}
        </p>
      </div>
      <TeamTracker
        team={team}
        season={season}
        seasonComplete={seasonComplete}
        seasonSummary={seasonSummary}
        isPreseason={isPreseason}
        preseason={preseason}
        lastSeasonSummary={lastSeasonSummary}
      />
      <NewsletterModal
        team={teamSlug}
        teamDisplayName={team.name}
        primaryColor={team.colors.primary}
        accentColor={team.colors.accent}
      />
    </>
  );
}
