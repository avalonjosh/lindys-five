import type { Metadata } from 'next';
import Link from 'next/link';
import BreadcrumbNav from '@/components/seo/BreadcrumbNav';
import SiteFooter from '@/components/SiteFooter';

const URL = 'https://www.lindysfive.com/how-playoff-odds-work';

export const metadata: Metadata = {
  title: "How Playoff Odds Are Calculated: Lindy's Five vs FanGraphs & 538",
  description:
    "How Lindy's Five computes NHL and MLB playoff odds from live standings, projected pace, and cut lines, and how that compares to simulation models like FanGraphs, MoneyPuck, and the former FiveThirtyEight.",
  alternates: { canonical: URL },
  openGraph: {
    title: 'How Playoff Odds Work',
    description:
      'The Lindy\'s Five playoff probability model explained, with a comparison to FanGraphs, MoneyPuck, and FiveThirtyEight.',
    url: URL,
    siteName: "Lindy's Five",
    type: 'article',
    images: ['/api/og?type=sport-hub&sport=nhl&title=How%20Playoff%20Odds%20Work&subtitle=Our%20model%2C%20explained'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Playoff Odds Work',
    description: 'The Lindy\'s Five playoff probability model explained, and how it compares to FanGraphs and 538.',
  },
};

const FAQ = [
  {
    q: 'What does a playoff probability actually mean?',
    a: 'It is the estimated chance a team finishes in a playoff spot given everything known today: its record, how much of the season is left, and where the division and wild card cut lines are projected to land. A 70% team is expected to make it about 7 times out of 10 if the rest of the season were replayed from this point.',
  },
  {
    q: 'How does Lindy\'s Five calculate NHL playoff odds?',
    a: 'We project each team\'s final point total from its current points pace, compute the projected division (top 3) and wild card cut lines from live standings, and convert the gap between the projection and the cut line into a probability with a logistic curve. Teams currently holding a playoff spot get a small position bonus after 25 games. NHL clinch and elimination flags override the model at 100% and 0%.',
  },
  {
    q: 'How does Lindy\'s Five calculate MLB playoff odds?',
    a: 'We estimate each team\'s true talent by blending its win rate, its Pythagorean record from runs scored and allowed, and a regression-to-.500 prior that fades as games pile up. Rest-of-season outcomes are treated as a binomial distribution, which gives the probability of finishing ahead of each division rival and of the wild card bubble team. Official MLB clinch and elimination status overrides the model.',
  },
  {
    q: 'Why are your odds different from FanGraphs, MoneyPuck, or FiveThirtyEight?',
    a: 'Those models run thousands of Monte Carlo simulations of the remaining schedule using player-level projections and game-by-game matchups. Lindy\'s Five uses a closed-form standings model instead: team-level pace, cut lines, and a probability curve. Ours is simpler and fully transparent, and it reacts quickly to results. Simulation models capture schedule strength and injuries better, so mid-season gaps of 5-15 percentage points on bubble teams are normal. The two approaches converge as the season winds down.',
  },
  {
    q: 'Does FiveThirtyEight still publish MLB and NHL playoff odds?',
    a: 'No. FiveThirtyEight stopped producing its sports forecasts in 2023 and the site was shut down in 2025. For MLB, FanGraphs and Baseball Reference publish simulation-based odds; for the NHL, MoneyPuck and The Athletic do. Lindy\'s Five covers all 30 MLB and 32 NHL teams with a standings-based model, updated every five minutes.',
  },
  {
    q: 'How often are the odds updated?',
    a: 'Standings, projections, and playoff odds refresh every five minutes during the season from the official NHL and MLB stats APIs. Odds change after every final score.',
  },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'How Playoff Odds Work',
    description: metadata.description,
    url: URL,
    publisher: { '@type': 'Organization', name: "Lindy's Five", url: 'https://www.lindysfive.com' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com' },
      { '@type': 'ListItem', position: 2, name: 'How Playoff Odds Work', item: URL },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
];

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-2xl md:text-3xl text-gray-900" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
      {children}
    </h2>
  );
}

export default function HowPlayoffOddsWorkPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
          <BreadcrumbNav items={[{ name: 'Home', href: '/' }, { name: 'How Playoff Odds Work' }]} className="mb-6 text-sm text-gray-500" />

          <h1 className="text-4xl md:text-6xl text-gray-900 mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            How Playoff Odds Are Calculated
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Lindy&apos;s Five publishes playoff odds for all 32 NHL teams and all 30 MLB teams. This page explains
            exactly how the numbers are produced, what they do and do not account for, and how they compare to
            simulation-based models like FanGraphs, MoneyPuck, and the former FiveThirtyEight.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/nhl-playoff-odds" className="rounded-lg bg-white px-4 py-2 text-sabres-blue shadow hover:shadow-md">NHL Playoff Odds</Link>
            <Link href="/mlb/playoff-odds" className="rounded-lg bg-white px-4 py-2 text-sabres-blue shadow hover:shadow-md">MLB Playoff Odds</Link>
            <Link href="/playoffs" className="rounded-lg bg-white px-4 py-2 text-sabres-blue shadow hover:shadow-md">Stanley Cup Bracket</Link>
          </div>

          <article className="text-gray-700 leading-relaxed">
            <H2>The short version</H2>
            <p>
              Every team&apos;s odds come from three ingredients: <strong>where it is projected to finish</strong>,{' '}
              <strong>where the playoff cut line is projected to fall</strong>, and{' '}
              <strong>how much season is left</strong> for those two numbers to move. The bigger the gap between a
              team&apos;s projection and the cut line, and the later in the season it is, the more certain the odds
              become. Everything is recomputed from live standings every five minutes.
            </p>

            <H2>NHL playoff odds, step by step</H2>
            <ol className="list-decimal space-y-3 pl-6">
              <li>
                <strong>Project final points.</strong> A team&apos;s points pace (points per game so far) is extended
                over the full schedule: 84 games from 2026-27, 82 before that. A team at 1.20 points per game projects to
                about 101 points.
              </li>
              <li>
                <strong>Find the cut lines.</strong> An NHL team qualifies by finishing top three in its division or as
                one of two conference wild cards. We project both thresholds from the current standings: the projected
                points of the third-place team in the division, and of the second wild card in the conference.
              </li>
              <li>
                <strong>Convert the gap to a probability.</strong> The difference between the team&apos;s projection
                and each cut line runs through a logistic (S-shaped) curve. At the cut line the odds are 50%; a few points
                either side moves them quickly; far above or below, the curve flattens toward 99% or 1%. The curve is
                steeper for the division path (fewer competitors) than for the wild card path (more), and it gets steeper
                as the season progresses, because there is less time for the standings to change.
              </li>
              <li>
                <strong>Take the better path.</strong> The team&apos;s playoff probability is the higher of its division
                and wild card probabilities. Team pages show which path is active.
              </li>
              <li>
                <strong>Position bonus.</strong> After 25 games, a team currently holding a playoff spot gets a small
                edge (up to 1.5 points shaved off the cut line by season&apos;s end), reflecting that incumbents are
                displaced less often than pace alone suggests.
              </li>
              <li>
                <strong>Clinch and elimination.</strong> The NHL&apos;s official x/y/z/p clinch indicators set odds to
                100%, and an &quot;e&quot; sets them to 0%. Until then, odds are capped at 99% and floored at 1%.
              </li>
            </ol>
            <p>
              Stanley Cup odds on the <Link href="/playoffs" className="text-sabres-blue underline">bracket page</Link>{' '}
              use a separate series model: point percentage and goal differential set each team&apos;s strength, a
              logistic curve turns the strength gap into a single-game win probability adjusted for home ice, and a
              best-of-seven distribution turns that into series and championship probabilities.
            </p>

            <H2>MLB playoff odds, step by step</H2>
            <ol className="list-decimal space-y-3 pl-6">
              <li>
                <strong>Estimate true talent.</strong> Win-loss record is noisy, so each team&apos;s underlying strength
                blends three signals: its actual win rate, its Pythagorean win rate from runs scored and allowed (which
                strips out luck in one-run games), and a regression-to-.500 prior that fades as the sample grows.
              </li>
              <li>
                <strong>Project wins and cut lines.</strong> Projected wins extend the current pace over 162 games. The
                division cut line is the projection of the division leader (or runner-up if the team leads); the wild card
                cut line is the third wild card, or the first team out if the team is already in.
              </li>
              <li>
                <strong>Model the rest of the season.</strong> Remaining games are treated as a binomial distribution
                around each team&apos;s true-talent rate. That gives the probability of finishing ahead of any given rival.
                Division odds are the joint probability of finishing ahead of every division rival; wild card odds
                compare the team to the bubble rival it needs to beat or hold off.
              </li>
              <li>
                <strong>Take the better path, apply official status.</strong> As in the NHL, the playoff probability is
                the higher of the division and wild card paths, clamped to 1-99% until MLB&apos;s official clinch or
                elimination status makes it 100% or 0%.
              </li>
            </ol>

            <H2>How this compares to FanGraphs, MoneyPuck, and FiveThirtyEight</H2>
            <p>
              The best-known playoff odds are <strong>simulation</strong> models. FanGraphs (MLB) and MoneyPuck (NHL)
              simulate the remaining schedule thousands of times, game by game, using player-level projections, current
              depth charts, and home-field effects, then count how often each team makes it. FiveThirtyEight ran similar
              Elo-based simulations until its sports forecasts ended in 2023; the site itself closed in 2025, which is why
              searches for &quot;538 playoff odds&quot; no longer lead anywhere current.
            </p>
            <p>Lindy&apos;s Five is a <strong>standings model</strong>. The practical differences:</p>
            <div className="my-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-left text-gray-900">
                    <th className="py-2 pr-4">&nbsp;</th>
                    <th className="py-2 pr-4">Lindy&apos;s Five</th>
                    <th className="py-2">FanGraphs / MoneyPuck</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-gray-200"><td className="py-2 pr-4 font-semibold">Method</td><td className="py-2 pr-4">Closed-form: pace, cut lines, probability curve</td><td className="py-2">Monte Carlo simulation of every remaining game</td></tr>
                  <tr className="border-b border-gray-200"><td className="py-2 pr-4 font-semibold">Inputs</td><td className="py-2 pr-4">Team record, points or runs, live standings, official clinch flags</td><td className="py-2">Player projections, rosters, injuries, schedule, home advantage</td></tr>
                  <tr className="border-b border-gray-200"><td className="py-2 pr-4 font-semibold">Strength of schedule</td><td className="py-2 pr-4">Not modeled directly</td><td className="py-2">Modeled game by game</td></tr>
                  <tr className="border-b border-gray-200"><td className="py-2 pr-4 font-semibold">Transparency</td><td className="py-2 pr-4">Every input is visible on the page; you can check the math</td><td className="py-2">Proprietary projection systems</td></tr>
                  <tr className="border-b border-gray-200"><td className="py-2 pr-4 font-semibold">Best at</td><td className="py-2 pr-4">Answering &quot;what pace do we need?&quot; and tracking the race set by set</td><td className="py-2">Precise mid-season odds for bubble teams</td></tr>
                  <tr><td className="py-2 pr-4 font-semibold">Update cadence</td><td className="py-2 pr-4">Every 5 minutes</td><td className="py-2">Typically daily</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              In practice the models agree on who is in and who is out, and they converge as the season ends. Expect
              the largest gaps (often 5-15 percentage points) in the middle of the season on bubble teams with unusually
              hard or easy remaining schedules, or with major injuries a standings model cannot see.
            </p>

            <H2>What the odds do not account for</H2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Injuries, trades, and roster changes (only their effect on results, once it shows up in the standings).</li>
              <li>Remaining strength of schedule and home/away split.</li>
              <li>Tiebreakers. Regulation wins (NHL) and head-to-head records (MLB) are not modeled; a team exactly on the cut line shows 50%.</li>
              <li>Early-season noise. NHL odds need 5 games and MLB odds need 10 before the model engages; before that every team shows 50%.</li>
            </ul>

            <H2>Where the data comes from</H2>
            <p>
              Standings, schedules, scores, and clinch indicators come from the official NHL and MLB stats APIs and are
              refreshed every five minutes. Preseason &quot;way-too-early&quot; odds on team pages carry last season&apos;s
              final standings forward until the new season has enough games.
            </p>

            <H2>Frequently asked questions</H2>
            <div className="space-y-6">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <h3 className="mb-1 font-bold text-gray-900">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </article>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
