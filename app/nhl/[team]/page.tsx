import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import TeamTracker from '@/components/TeamTracker';
import NewsletterModal from '@/components/newsletter/NewsletterModal';
import SiteFooter from '@/components/SiteFooter';
import { isRateLimitError } from '@/lib/services/nhlApi';
import { getFinalStandings } from '@/lib/services/nhlOffseason';
import { fetchTeamScheduleServer, fetchStandingsServer, ordinal, possessive } from '@/lib/services/nhlTeamPageData';
import { calculateChunks, calculateSeasonStats } from '@/lib/utils/chunkCalculator';
import { computePositionAwareProbability, getPlayoffStatusMessage } from '@/lib/utils/playoffProbability';
import { playoffResultText } from '@/lib/utils/seasonSummary';
import { formatSeasonEndYear, getRegularSeasonGameCount, previousNHLSeason } from '@/lib/utils/season';
import { resolveSeasonContext } from '@/lib/utils/seasonContext';
import type { GameResult } from '@/lib/types';
import type { StandingsTeam } from '@/lib/types/boxscore';

export const revalidate = 300; // ISR: revalidate every 5 minutes for fresh data

interface TeamPageProps {
  params: Promise<{ team: string }>;
}

export async function generateStaticParams() {
  return Object.keys(TEAMS).map((slug) => ({ team: slug }));
}

function openerSentence(fullName: string, seasonLabel: string, opener: { date: string; opponent: string; isHome: boolean } | null): string {
  if (!opener) return `The ${fullName} ${seasonLabel} schedule has been released.`;
  const opponentName = Object.values(TEAMS).find((t) => t.abbreviation === opener.opponent)?.name ?? opener.opponent;
  const when = new Date(`${opener.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `The ${fullName} open the ${seasonLabel} season ${opener.isHome ? 'at home against' : 'on the road against'} the ${opponentName} on ${when}.`;
}

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];
  if (!team) return { title: 'Team Not Found' };

  const fullName = `${team.city} ${team.name}`;
  const { seasonLabel, seasonComplete, isPreseason, preseason, summary } = await resolveSeasonContext(team.abbreviation);
  const odds = preseason?.odds ?? null;
  const record = summary?.finalRecord;

  // Titles stay under ~60 characters before the " | Lindy's Five" suffix and
  // lead with the phrases people search: "{team} playoff odds", "{team} standings",
  // "{team} schedule".
  const title = seasonComplete
    ? `${fullName} ${seasonLabel} Season: Record & Playoff Result`
    : isPreseason
      ? `${fullName} ${seasonLabel} Schedule & Playoff Odds`
      : `${fullName} Playoff Odds & Standings ${seasonLabel}`;

  const description = seasonComplete
    ? `${fullName} ${seasonLabel} recap: ${record ? `${record.wins}-${record.losses}-${record.otLosses}, ${record.points} points` : 'final record'}, division and conference finish, playoff result, and the full 5-game set breakdown.`
    : isPreseason
      ? `${fullName} ${seasonLabel} schedule: every game, opening night, and 5-game sets.${odds ? ` Way-too-early odds: ${odds.playoffProbability}% to make the playoffs, ${odds.projectedPoints} projected points.` : ''} Live odds all season.`
      : `Are the ${fullName} going to make the playoffs? Live ${seasonLabel} playoff odds, division standings, points pace, and 5-game set tracking, updated after every game.`;

  const ogTitle = seasonComplete
    ? `${fullName} ${seasonLabel} Season Recap`
    : isPreseason
      ? `${fullName} ${seasonLabel} Schedule & Odds`
      : `${fullName} Playoff Odds ${seasonLabel}`;

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      type: 'website',
      url: `https://www.lindysfive.com/nhl/${team.id}`,
      images: [{ url: team.logo }],
      siteName: "Lindy's Five",
    },
    twitter: { card: 'summary', title: ogTitle, description, images: [team.logo] },
    alternates: { canonical: `https://www.lindysfive.com/nhl/${team.id}` },
  };
}

/** Division standings table with links to rival team pages (crawlable internal links). */
function DivisionTable({ rows, currentAbbrev, primaryColor, heading }: { rows: StandingsTeam[]; currentAbbrev: string; primaryColor: string; heading: string }) {
  const slugByAbbrev = new Map(Object.values(TEAMS).map((t) => [t.abbreviation, t.id]));
  return (
    <>
      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">{heading}</h3>
      <div className="overflow-hidden rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <th className="px-3 py-2 font-bold">Team</th>
              <th className="w-12 px-2 py-2 text-right font-bold">GP</th>
              <th className="w-12 px-2 py-2 text-right font-bold">W</th>
              <th className="w-12 px-2 py-2 text-right font-bold">L</th>
              <th className="w-12 px-2 py-2 text-right font-bold">OTL</th>
              <th className="w-14 px-3 py-2 text-right font-bold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const abbrev = row.teamAbbrev.default;
              const slug = slugByAbbrev.get(abbrev);
              const isCurrent = abbrev === currentAbbrev;
              const name = row.teamCommonName?.default || row.teamName.default;
              return (
                <tr key={abbrev} className={isCurrent ? 'bg-blue-50/60' : 'even:bg-gray-50'}>
                  <td className={`px-3 py-2 ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                    {slug && !isCurrent ? (
                      <Link href={`/nhl/${slug}`} className="hover:underline" style={{ color: primaryColor }}>{name}</Link>
                    ) : name}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700">{row.gamesPlayed}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{row.wins}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{row.losses}</td>
                  <td className="px-2 py-2 text-right text-gray-700">{row.otLosses}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { team: teamSlug } = await params;
  const team = TEAMS[teamSlug];
  if (!team) notFound();

  const fullName = `${team.city} ${team.name}`;

  // Resolve which season to show and in what phase (live / complete / preseason)
  // from the NHL API, so the page flips modes on its own as the schedule changes.
  const { season, seasonLabel, seasonComplete, isPreseason, summary: seasonSummary, preseason, lastSeasonSummary } =
    await resolveSeasonContext(team.abbreviation);
  const endYear = formatSeasonEndYear(season);
  const seasonGames = getRegularSeasonGameCount(season);
  const openerText = openerSentence(fullName, seasonLabel, preseason?.opener ?? null);
  const preseasonOdds = preseason?.odds ?? null;
  const oddsText = preseasonOdds
    ? `Way-too-early ${seasonLabel} projection: the ${fullName} have roughly a ${preseasonOdds.playoffProbability}% chance to make the playoffs, projected for about ${preseasonOdds.projectedPoints} points (${preseasonOdds.tier.toLowerCase()}).`
    : '';

  // ---------------------------------------------------------------------------
  // Server-side data: schedule (seeds the tracker HTML) + standings (summary,
  // division table, and data-driven FAQ answers).
  // ---------------------------------------------------------------------------
  let initialGames: GameResult[] | undefined;
  let summaryText = '';
  let divisionRows: StandingsTeam[] = [];
  let divisionHeading = '';
  let liveFaq: { will: string; odds: string; cup: string } | null = null;
  let lastNext = '';

  try {
    if (!seasonComplete) {
      const games = await fetchTeamScheduleServer(team, season);
      if (games.length > 0) initialGames = games;
    }

    if (!seasonComplete && !isPreseason && initialGames) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const allTeams = await fetchStandingsServer(today);
      const teamStanding = allTeams.find((t) => t.teamAbbrev.default === team.abbreviation);
      const totalGames = initialGames.length || seasonGames;
      const chunks = calculateChunks(initialGames, totalGames);
      const seasonStats = calculateSeasonStats(chunks, totalGames);

      if (seasonStats.gamesPlayed > 0 && teamStanding) {
        const confTeams = allTeams.filter((t) => t.conferenceName === teamStanding.conferenceName);
        const divTeams = allTeams.filter((t) => t.divisionName === teamStanding.divisionName);
        const sortedDiv = [...divTeams].sort((a, b) => b.points - a.points);
        const confSorted = [...confTeams].sort((a, b) => b.points - a.points);
        const divCutLine = Math.max(sortedDiv[2]?.points || 96, 96);
        const wcCutLine = Math.max(confSorted[7]?.points || 96, 96);
        const isInPlayoffPosition = teamStanding.divisionSequence <= 3 || (teamStanding.wildcardSequence > 0 && teamStanding.wildcardSequence <= 2);
        const { probability } = computePositionAwareProbability(
          seasonStats.projectedPoints, seasonStats.gamesPlayed, divCutLine, wcCutLine, isInPlayoffPosition, teamStanding.clinchIndicator,
        );
        const statusMessage = getPlayoffStatusMessage(probability, seasonStats.gamesPlayed);
        const pct = Math.round(probability);
        const rec = `${teamStanding.wins}-${teamStanding.losses}-${teamStanding.otLosses}`;
        const clinchMap: Record<string, string> = { x: 'They have clinched a playoff berth.', y: 'They have clinched the division.', z: 'They have clinched the conference.', p: "They have clinched the Presidents' Trophy." };
        const clinchText = teamStanding.clinchIndicator ? clinchMap[teamStanding.clinchIndicator] || '' : '';

        summaryText = [
          `The ${fullName} are ${rec} with ${teamStanding.points} points through ${teamStanding.gamesPlayed} games of the ${seasonLabel} season, ${ordinal(teamStanding.divisionSequence)} in the ${teamStanding.divisionName} Division and ${ordinal(teamStanding.conferenceSequence)} in the ${teamStanding.conferenceName} Conference${teamStanding.wildcardSequence > 0 ? ` (${ordinal(teamStanding.wildcardSequence)} wild card spot)` : ''}.`,
          `At their current pace they project to ${Math.round(seasonStats.projectedPoints)} points, ${seasonStats.pointsAboveBelow >= 0 ? `${seasonStats.pointsAboveBelow} above` : `${Math.abs(seasonStats.pointsAboveBelow)} below`} the ${seasonStats.playoffTarget}-point playoff target, which gives them a ${pct}% chance to make the playoffs. ${statusMessage}.`,
          clinchText,
          `They're on a ${teamStanding.streakCode}${teamStanding.streakCount} streak, ${teamStanding.l10Wins}-${teamStanding.l10Losses}-${teamStanding.l10OtLosses} over their last 10, with a ${teamStanding.goalDifferential >= 0 ? '+' : ''}${teamStanding.goalDifferential} goal differential (${teamStanding.goalFor} for, ${teamStanding.goalAgainst} against), ${teamStanding.homeWins}-${teamStanding.homeLosses}-${teamStanding.homeOtLosses} at home and ${teamStanding.roadWins}-${teamStanding.roadLosses}-${teamStanding.roadOtLosses} on the road.`,
        ].filter(Boolean).join(' ');

        const currentChunk = chunks.find((c) => !c.isComplete && c.games.some((g) => g.outcome !== 'PENDING')) || chunks.find((c) => !c.isComplete);
        const played = initialGames.filter((g) => g.outcome !== 'PENDING');
        const lastGame = played[played.length - 1];
        const nextGame = initialGames.find((g) => g.outcome === 'PENDING');
        lastNext = [
          currentChunk ? `Current 5-game set (Set ${currentChunk.chunkNumber}): ${currentChunk.wins}-${currentChunk.otLosses}-${currentChunk.losses}, ${currentChunk.points} of ${currentChunk.maxPoints} points.` : '',
          lastGame ? `Last game: ${lastGame.outcome} ${lastGame.sabresScore}-${lastGame.opponentScore} ${lastGame.isHome ? 'vs' : 'at'} ${lastGame.opponent} (${lastGame.date}).` : '',
          nextGame ? `Next game: ${nextGame.isHome ? 'vs' : 'at'} ${nextGame.opponent}, ${nextGame.date}${nextGame.startTime ? ` at ${nextGame.startTime}` : ''}.` : '',
        ].filter(Boolean).join(' ');

        divisionRows = [...divTeams].sort((a, b) => a.divisionSequence - b.divisionSequence);
        divisionHeading = `${teamStanding.divisionName} Division Standings`;
        liveFaq = {
          will: `As of today the ${fullName} have a ${pct}% chance to make the ${endYear} playoffs. They are ${rec} (${teamStanding.points} points), ${ordinal(teamStanding.divisionSequence)} in the ${teamStanding.divisionName}, projecting to ${Math.round(seasonStats.projectedPoints)} points against a ${seasonStats.playoffTarget}-point playoff target.${clinchText ? ` ${clinchText}` : ''}`,
          odds: `The ${possessive(fullName)} playoff odds are ${pct}%, based on their ${Math.round(seasonStats.projectedPoints)}-point pace through ${teamStanding.gamesPlayed} games, their ${ordinal(teamStanding.divisionSequence)}-place division position, and the current wild card cut line. The number updates after every game.`,
          cup: `Stanley Cup odds start with making the playoffs, which the ${fullName} currently have a ${pct}% chance to do. Once the bracket is set, this page shows their series-by-series Cup odds and playoff journey.`,
        };
      }
    } else if (isPreseason) {
      const lastSeason = previousNHLSeason(season);
      const finalStandings = await getFinalStandings(lastSeason);
      const mine = finalStandings.find((t) => t.teamAbbrev.default === team.abbreviation);
      if (mine) {
        divisionRows = finalStandings.filter((t) => t.divisionName === mine.divisionName).sort((a, b) => a.divisionSequence - b.divisionSequence);
        divisionHeading = `${mine.divisionName} Division: Final ${lastSeasonSummary?.seasonLabel ?? 'Last Season'} Standings`;
      }
      const parts = [
        `${fullName} ${seasonLabel} season preview: full schedule, ${seasonGames}-game regular season, and ${Math.ceil(seasonGames / 5)} five-game sets.`,
        openerText,
      ];
      if (lastSeasonSummary?.finalRecord) {
        const r = lastSeasonSummary.finalRecord;
        const outcome = playoffResultText(lastSeasonSummary);
        parts.push(`Last season the ${fullName} finished ${r.wins}-${r.losses}-${r.otLosses} with ${r.points} points${lastSeasonSummary.divisionFinish && lastSeasonSummary.divisionName ? `, ${ordinal(lastSeasonSummary.divisionFinish)} in the ${lastSeasonSummary.divisionName} Division` : ''}; ${outcome.charAt(0).toLowerCase() + outcome.slice(1)}.`);
      }
      if (oddsText) parts.push(oddsText);
      parts.push(`Live playoff probability updates daily once the season begins.`);
      summaryText = parts.join(' ');
      if (initialGames) {
        const home = initialGames.filter((g) => g.isHome).length;
        lastNext = `${initialGames.length} regular-season games: ${home} at home, ${initialGames.length - home} on the road.`;
      }
    } else if (seasonComplete && seasonSummary) {
      const finalStandings = await getFinalStandings(season);
      const mine = finalStandings.find((t) => t.teamAbbrev.default === team.abbreviation);
      if (mine) {
        divisionRows = finalStandings.filter((t) => t.divisionName === mine.divisionName).sort((a, b) => a.divisionSequence - b.divisionSequence);
        divisionHeading = `${mine.divisionName} Division: Final ${seasonLabel} Standings`;
      }
      const r = seasonSummary.finalRecord;
      summaryText = [
        r ? `The ${fullName} finished the ${seasonLabel} season ${r.wins}-${r.losses}-${r.otLosses} with ${r.points} points in ${r.gamesPlayed} games.` : `${fullName} ${seasonLabel} season recap.`,
        seasonSummary.divisionFinish && seasonSummary.divisionName
          ? `They finished ${ordinal(seasonSummary.divisionFinish)} in the ${seasonSummary.divisionName} Division${seasonSummary.conferenceFinish && seasonSummary.conferenceName ? ` and ${ordinal(seasonSummary.conferenceFinish)} in the ${seasonSummary.conferenceName} Conference` : ''}.`
          : '',
        `${playoffResultText(seasonSummary)}.`,
        `${possessive(fullName)} schedule and playoff odds for next season will be tracked here once the new NHL schedule is released.`,
      ].filter(Boolean).join(' ');
    }
  } catch (e) {
    if (isRateLimitError(e)) console.warn(`SEO data fetch rate-limited for ${team.abbreviation}`);
    else console.error(`SEO data fetch failed for ${team.abbreviation}:`, e);
  }

  const summaryHeading = seasonComplete
    ? `${team.name} ${seasonLabel} Season Recap`
    : isPreseason
      ? `${team.name} ${seasonLabel} Season Preview`
      : `${team.name} Season So Far`;

  const serverSummary: ReactNode = summaryText ? (
    <section className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl md:p-6">
      <h2 className="mb-2 text-lg font-bold md:text-2xl" style={{ color: team.colors.primary }}>{summaryHeading}</h2>
      <p className="text-sm leading-relaxed text-gray-700">{summaryText}</p>
      {divisionRows.length > 0 && (
        <DivisionTable rows={divisionRows} currentAbbrev={team.abbreviation} primaryColor={team.colors.primary} heading={divisionHeading} />
      )}
      {lastNext && <p className="mt-3 text-xs text-gray-500">{lastNext}</p>}
      <p className="mt-4 text-xs text-gray-500">
        More: <Link href="/nhl-playoff-odds" className="font-semibold hover:underline" style={{ color: team.colors.primary }}>NHL playoff odds for all 32 teams</Link>
        {' · '}<Link href="/nhl/scores" className="font-semibold hover:underline" style={{ color: team.colors.primary }}>NHL scores</Link>
        {' · '}<Link href={`/nhl/${team.id}/tickets`} className="font-semibold hover:underline" style={{ color: team.colors.primary }}>{team.name} tickets</Link>
        {' · '}<Link href={`/nhl/${team.id}/gear`} className="font-semibold hover:underline" style={{ color: team.colors.primary }}>{team.name} gear</Link>
      </p>
    </section>
  ) : null;

  // ---------------------------------------------------------------------------
  // Structured data
  // ---------------------------------------------------------------------------
  const pageName = seasonComplete
    ? `${fullName} ${seasonLabel} Season: Record & Playoff Result`
    : isPreseason
      ? `${fullName} ${seasonLabel} Schedule & Playoff Odds`
      : `${fullName} Playoff Odds & Standings ${seasonLabel}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageName,
    description: summaryText || `${fullName} playoff odds, schedule, and standings for the ${seasonLabel} NHL season.`,
    url: `https://www.lindysfive.com/nhl/${team.id}`,
    dateModified: new Date().toISOString(),
    publisher: { '@type': 'Organization', name: "Lindy's Five", url: 'https://www.lindysfive.com' },
    about: {
      '@type': 'SportsTeam',
      name: fullName,
      sport: 'Ice Hockey',
      memberOf: { '@type': 'SportsOrganization', name: 'National Hockey League' },
    },
  };

  const playoffResultAnswer = seasonComplete && seasonSummary ? playoffResultText(seasonSummary) : null;
  const faqEntries: { q: string; a: string }[] = seasonComplete
    ? [
        { q: `Did the ${fullName} make the playoffs in ${endYear}?`, a: playoffResultAnswer ? `${playoffResultAnswer} in the ${seasonLabel} season.` : `See the ${possessive(fullName)} ${seasonLabel} playoff result and final standings on this page.` },
        { q: `How did the ${fullName} finish the ${seasonLabel} season?`, a: seasonSummary?.finalRecord ? `The ${fullName} finished ${seasonSummary.finalRecord.wins}-${seasonSummary.finalRecord.losses}-${seasonSummary.finalRecord.otLosses} with ${seasonSummary.finalRecord.points} points${seasonSummary.divisionName && seasonSummary.divisionFinish ? `, ${ordinal(seasonSummary.divisionFinish)} in the ${seasonSummary.divisionName} Division` : ''}.` : `See the ${possessive(fullName)} final record and standings for ${seasonLabel} above.` },
        { q: `When does the ${fullName} next season start?`, a: `The NHL regular season typically opens in early October. The ${possessive(fullName)} schedule and playoff odds for next season will be tracked here once the schedule is released.` },
      ]
    : isPreseason
      ? [
          { q: `When do the ${fullName} play their first game in ${seasonLabel}?`, a: `${openerText} The full ${seasonLabel} schedule and 5-game sets are on this page.` },
          { q: `How many games are in the ${fullName} ${seasonLabel} season?`, a: `The ${fullName} play a ${seasonGames}-game regular season in ${seasonLabel}, tracked here in ${Math.ceil(seasonGames / 5)} five-game sets.` },
          { q: `What are the ${possessive(fullName)} ${seasonLabel} playoff odds?`, a: preseasonOdds ? `${oddsText} This is a preseason estimate projected from last season's results; live playoff odds update daily once the season begins.` : `Live ${seasonLabel} playoff odds for the ${fullName} update daily once the season begins.` },
        ]
      : [
          { q: `Will the ${fullName} make the playoffs in ${endYear}?`, a: liveFaq?.will ?? `The ${possessive(fullName)} live ${seasonLabel} playoff probability, record, and points pace are on this page and update after every game.` },
          { q: `What are the ${possessive(fullName)} playoff odds?`, a: liveFaq?.odds ?? `The ${possessive(fullName)} playoff odds are computed from their points pace, division standing, and the wild card cut line, and update after every game.` },
          { q: `What are the ${possessive(fullName)} Stanley Cup odds?`, a: liveFaq?.cup ?? `Stanley Cup odds start with making the playoffs. This page tracks the ${possessive(fullName)} playoff probability and, once the bracket is set, their series-by-series Cup odds.` },
        ];

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map((e) => ({ '@type': 'Question', name: e.q, acceptedAnswer: { '@type': 'Answer', text: e.a } })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com/' },
      { '@type': 'ListItem', position: 2, name: 'NHL', item: 'https://www.lindysfive.com/nhl' },
      { '@type': 'ListItem', position: 3, name: fullName, item: `https://www.lindysfive.com/nhl/${team.id}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {/* The visible serverSummary carries the crawlable content; this fallback
          line only renders when live data was unavailable (fetch error). */}
      {!serverSummary && (
        <p className="sr-only">
          {`${fullName} playoff odds, schedule, and standings for the ${seasonLabel} NHL season. Track ${possessive(fullName)} points pace, playoff picture, and playoff probability, updated daily.`}
        </p>
      )}
      <TeamTracker
        team={team}
        season={season}
        seasonComplete={seasonComplete}
        seasonSummary={seasonSummary}
        isPreseason={isPreseason}
        preseason={preseason}
        lastSeasonSummary={lastSeasonSummary}
        initialGames={initialGames}
        serverSummary={serverSummary}
        faq={faqEntries}
      />
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
