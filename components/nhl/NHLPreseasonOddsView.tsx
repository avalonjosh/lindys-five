import Link from 'next/link';
import MLBTeamNav from '@/components/mlb/MLBTeamNav';
import GameTicker from '@/components/landing/GameTicker';
import GamePromo from '@/components/perfectseason/GamePromo';
import NewsletterModal from '@/components/newsletter/NewsletterModal';
import PreseasonOddsClient, { type PreseasonTeamData } from '@/components/PreseasonOddsClient';
import { TEAMS } from '@/lib/teamConfig';
import { previousNHLSeason, formatSeasonLabel } from '@/lib/utils/season';
import { computePreseasonOdds } from '@/lib/utils/preseasonOdds';
import { getFinalStandings } from '@/lib/services/nhlOffseason';

// Reverse lookup: NHL abbreviation -> our slug
const abbrevToSlug = Object.fromEntries(
  Object.entries(TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

const DIVISIONS_BY_CONF: Record<string, string[]> = {
  Eastern: ['Atlantic', 'Metropolitan'],
  Western: ['Central', 'Pacific'],
};

// Build the league-wide way-too-early odds from last season's final standings.
function buildPreseasonTeams(
  standings: Awaited<ReturnType<typeof getFinalStandings>>,
  totalGames: number
): PreseasonTeamData[] {
  const teams: PreseasonTeamData[] = standings.map(t => {
    const odds = computePreseasonOdds(t.points, t.gamesPlayed, totalGames);
    const abbrev = t.teamAbbrev.default;
    return {
      abbrev,
      name: t.teamCommonName?.default || t.teamName.default,
      logo: t.teamLogo,
      slug: abbrevToSlug[abbrev] || '',
      lastWins: t.wins,
      lastLosses: t.losses,
      lastOtLosses: t.otLosses,
      lastPoints: t.points,
      projectedPoints: odds.projectedPoints,
      odds: odds.playoffProbability,
      tier: odds.tier,
      divisionName: t.divisionName,
      conferenceName: t.conferenceName,
      projectedInPlayoffs: false,
    };
  });

  // Project the playoff field: top 3 by projected points in each division, plus
  // the two best remaining teams per conference as wild cards.
  for (const conf of ['Eastern', 'Western']) {
    const confTeams = teams.filter(t => t.conferenceName === conf);
    for (const div of DIVISIONS_BY_CONF[conf]) {
      confTeams
        .filter(t => t.divisionName === div)
        .sort((a, b) => b.projectedPoints - a.projectedPoints)
        .slice(0, 3)
        .forEach(t => { t.projectedInPlayoffs = true; });
    }
    confTeams
      .filter(t => !t.projectedInPlayoffs)
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .slice(0, 2)
      .forEach(t => { t.projectedInPlayoffs = true; });
  }

  return teams;
}

export default async function NHLPreseasonOddsView({
  season,
  seasonLabel,
  totalGames,
}: {
  season: string;
  seasonLabel: string;
  totalGames: number;
}) {
  const prevSeason = previousNHLSeason(season);
  const lastSeasonLabel = formatSeasonLabel(prevSeason);
  const finalStandings = await getFinalStandings(prevSeason);
  const teams = buildPreseasonTeams(finalStandings, totalGames);
  const leagueRanked = [...teams].sort(
    (a, b) => b.projectedPoints - a.projectedPoints || b.odds - a.odds
  );

  return (
    <>
      <GameTicker />
      <NewsletterModal />

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: `NHL Playoff Odds ${seasonLabel} — Way-Too-Early Projections`,
              description: `Way-too-early ${seasonLabel} NHL playoff odds for all 32 teams, projected from ${lastSeasonLabel} results ahead of opening night.`,
              url: 'https://www.lindysfive.com/nhl-playoff-odds',
              dateModified: new Date().toISOString(),
              publisher: { '@type': 'Organization', name: 'JRR Apps' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'Dataset',
              name: `NHL Way-Too-Early Playoff Odds ${seasonLabel}`,
              description: `Way-too-early playoff probability and projected points for all 32 NHL teams for the ${seasonLabel} season, projected from ${lastSeasonLabel} results. Each team row includes last season's record, projected ${totalGames}-game point total, and a preseason playoff probability.`,
              url: 'https://www.lindysfive.com/nhl-playoff-odds',
              keywords: [
                'NHL playoff odds',
                'way too early playoff odds',
                'NHL projections',
                'playoff probability',
                'projected points',
              ],
              creator: { '@type': 'Organization', name: 'JRR Apps' },
              publisher: { '@type': 'Organization', name: "Lindy's Five" },
              isAccessibleForFree: true,
              dateModified: new Date().toISOString(),
              measurementTechnique:
                "Last season's points pace regressed toward the league average, projected over the coming season's game count, then fed into a logistic curve against the projected playoff cut line.",
              variableMeasured: [
                { '@type': 'PropertyValue', name: 'Way-too-early playoff probability', unitText: 'percent' },
                { '@type': 'PropertyValue', name: 'Projected points' },
                { '@type': 'PropertyValue', name: 'Last season record (wins-losses-OT losses)' },
              ],
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com/' },
                { '@type': 'ListItem', position: 2, name: 'NHL Playoff Odds', item: 'https://www.lindysfive.com/nhl-playoff-odds' },
              ],
            },
          ]),
        }}
      />

      {/* Server-rendered mirror for crawlers and AI answer engines. Duplicates
          the interactive (client-rendered) table so every team's row is present
          in the initial HTML without JS execution. */}
      <section className="sr-only" aria-label={`NHL way-too-early playoff odds for all 32 teams, ${seasonLabel} season`}>
        <h2>NHL Way-Too-Early Playoff Odds {seasonLabel} — All 32 Teams</h2>
        <p>
          Way-too-early {seasonLabel} NHL playoff odds for all 32 teams, ranked by projected points and
          projected from {lastSeasonLabel} results. Projected points regress last season&apos;s pace toward
          the league average over a {totalGames}-game season; playoff probability is a logistic estimate
          against the projected cut line. These are preseason projections and update once the season begins.
        </p>
        <table>
          <caption>NHL way-too-early playoff odds, all 32 teams, {seasonLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Projected rank</th>
              <th scope="col">Team</th>
              <th scope="col">{lastSeasonLabel} record (W-L-OTL)</th>
              <th scope="col">Projected points</th>
              <th scope="col">Way-too-early playoff probability</th>
              <th scope="col">Conference</th>
              <th scope="col">Division</th>
            </tr>
          </thead>
          <tbody>
            {leagueRanked.map((t, i) => (
              <tr key={t.abbrev}>
                <td>{i + 1}</td>
                <td>{t.name}</td>
                <td>{t.lastWins}-{t.lastLosses}-{t.lastOtLosses}</td>
                <td>{t.projectedPoints}</td>
                <td>{t.odds}%</td>
                <td>{t.conferenceName}</td>
                <td>{t.divisionName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="shadow-xl border-b-4" style={{ background: '#003087', borderBottomColor: '#0A1128' }}>
          <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 text-center relative">
            <div className="absolute top-4 left-4">
              <MLBTeamNav
                currentTeamId=""
                teamColors={{ primary: '#003087', secondary: '#FFB81C', accent: '#FFFFFF' }}
                defaultTab="nhl"
              />
            </div>
            <Link href="/" className="inline-block mb-2">
              <p className="text-xl md:text-2xl font-bold text-white/70 hover:text-white transition-colors" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                Lindy&apos;s Five
              </p>
            </Link>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              NHL Playoff Odds {seasonLabel}
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              Way-too-early {seasonLabel} playoff odds for all 32 teams, projected from {lastSeasonLabel} results. Live odds take over once the season begins.
            </p>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">NHL Playoff Odds</span>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 pb-16">
          {teams.length > 0 ? (
            <PreseasonOddsClient teams={teams} totalGames={totalGames} lastSeasonLabel={lastSeasonLabel} />
          ) : (
            <div className="mt-8 bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-500 shadow-sm">
              Way-too-early {seasonLabel} odds arrive here shortly. Check back soon.
            </div>
          )}

          <section className="mt-12 max-w-3xl mx-auto">
            <GamePromo sport="nhl" />
          </section>

          {/* Narrative Section */}
          <section className="mt-12 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {seasonLabel} NHL Way-Too-Early Playoff Odds
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                The {seasonLabel} NHL schedule is set, and the countdown to opening night is on. Before a
                single puck drops, these way-too-early playoff odds project all 32 teams from last
                season&apos;s results — a simple, transparent starting point for the {seasonLabel} race.
              </p>
              <p>
                The projection takes each team&apos;s {lastSeasonLabel} points pace and regresses it toward
                the league average, because team strength carries over year to year only in part. That
                regressed pace is projected over the {totalGames}-game season and measured against the
                projected playoff cut line to produce a playoff probability. It deliberately ignores roster
                moves, injuries, and goaltending — it is a baseline, not a forecast, and the live model
                takes over the moment games begin.
              </p>
              <p>
                Follow along all season with{' '}
                <Link href="/" className="text-blue-600 hover:text-blue-500 underline">Lindy&apos;s Five</Link>{' '}
                for 5-game set analysis, points pace tracking, and playoff projections for every NHL team.
                Pick your team from the table above, or see{' '}
                <Link href="/mlb/playoff-odds" className="text-blue-600 hover:text-blue-500 underline">MLB playoff odds for all 30 teams</Link>.
              </p>
            </div>
          </section>

          {/* Back to Home */}
          <div className="mt-12 text-center flex flex-wrap items-center justify-center gap-4">
            <Link href="/" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
              <span>&larr;</span>
              <span>Back to All Teams</span>
            </Link>
            <Link href="/mlb/playoff-odds" className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-6 py-3 rounded-lg transition-colors font-medium">
              <span>MLB Playoff Odds 2026</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center text-sm text-gray-500">
          <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
          <p className="mt-1">Way-too-early projections from last season&apos;s results.</p>
        </footer>
      </div>
    </>
  );
}
