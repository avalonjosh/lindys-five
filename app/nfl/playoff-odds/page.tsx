import type { Metadata } from 'next';
import Link from 'next/link';
import { NFL_TEAMS } from '@/lib/teamConfig';
import { nflSeasonYear } from '@/lib/services/nflApi';
import { computeNFLOdds, formatNFLOdds, type NFLTeamRow } from '@/lib/services/nflLeague';
import SiteFooter from '@/components/SiteFooter';

export const revalidate = 1800;

const BASE = 'https://www.lindysfive.com';
const BY_ABBR = new Map(Object.values(NFL_TEAMS).map((t) => [t.abbreviation, t]));

export async function generateMetadata(): Promise<Metadata> {
  const season = nflSeasonYear();
  const title = `NFL Playoff Odds ${season}: Every Team's Chances to Make the Playoffs`;
  const description = `${season} NFL playoff odds for all 32 teams: chances to make the playoffs, win the division and earn the #1 seed, plus projected wins. Updated after every game.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: `${BASE}/nfl/playoff-odds`, siteName: "Lindy's Five" },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE}/nfl/playoff-odds` },
  };
}

function ConferenceTable({ conf, rows }: { conf: string; rows: NFLTeamRow[] }) {
  return (
    <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-sm sm:p-5">
      <h2 className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">{conf}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-2 font-semibold">Team</th>
              <th className="py-2 pr-2 text-center font-semibold">Record</th>
              <th className="py-2 pr-2 text-center font-semibold">Proj W</th>
              <th className="py-2 pr-2 text-center font-semibold">Win Div</th>
              <th className="py-2 pr-2 text-center font-semibold">#1 Seed</th>
              <th className="py-2 text-center font-semibold">Playoffs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = BY_ABBR.get(r.abbr);
              return (
                <tr key={r.abbr} className="border-b border-gray-100">
                  <td className="py-2 pr-2">
                    {t ? (
                      <Link href={`/pick-the-${t.pickSlug}`} className="flex items-center gap-2 font-semibold text-gray-900 hover:underline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={t.logo} alt="" className="h-6 w-6 flex-shrink-0" />
                        <span className="hidden sm:inline">{t.city} {t.name}</span>
                        <span className="sm:hidden">{t.name}</span>
                      </Link>
                    ) : r.abbr}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-center text-gray-700">{r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ''}</td>
                  <td className="py-2 pr-2 text-center text-gray-700">{r.projWins.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-center text-gray-700">{formatNFLOdds(r.divisionOdds)}</td>
                  <td className="py-2 pr-2 text-center text-gray-700">{formatNFLOdds(r.topSeed)}</td>
                  <td className="py-2 text-center font-bold text-gray-900">{formatNFLOdds(r.playoff)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function NFLPlayoffOddsPage() {
  const season = nflSeasonYear();
  const table = await computeNFLOdds(season);
  const afc = table?.teams.filter((r) => r.conference === 'AFC') ?? [];
  const nfc = table?.teams.filter((r) => r.conference === 'NFC') ?? [];
  const leader = table?.teams[0];
  const leaderName = leader ? `${BY_ABBR.get(leader.abbr)?.city ?? ''} ${BY_ABBR.get(leader.abbr)?.name ?? leader.abbr}` : '';

  const faqs = [
    {
      q: `How are these ${season} NFL playoff odds calculated?`,
      a: 'Each team gets a rating from its point differential, adjusted for strength of schedule, blended with a little of last season and trusted more as games are played. We simulate the rest of the season 10,000 times with the real schedule and home field, then seed each conference the NFL way: four division winners plus three wild cards.',
    },
    {
      q: 'How many NFL teams make the playoffs?',
      a: 'Fourteen: seven per conference. The four division winners are seeds 1 to 4 and three wild cards are seeds 5 to 7. Only the #1 seed in each conference gets a first-round bye.',
    },
    {
      q: 'How accurate are these odds?',
      a: 'Tested on the 2021 to 2025 seasons from weeks 3 through 15, the model was about 47% more accurate than giving every team the same chance (Brier score 0.131 vs 0.246). Tiebreakers are approximated, so treat close races as estimates.',
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `NFL Playoff Odds ${season}`,
      url: `${BASE}/nfl/playoff-odds`,
      dateModified: new Date().toISOString(),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `NFL Playoff Odds ${season}`,
      description: `Playoff, division and #1 seed probabilities for all 32 NFL teams in the ${season} season, from a simulation model.`,
      url: `${BASE}/nfl/playoff-odds`,
      creator: { '@type': 'Organization', name: "Lindy's Five" },
      dateModified: new Date().toISOString(),
      variableMeasured: ['Playoff probability', 'Division title probability', '#1 seed probability', 'Projected wins'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'NFL Playoff Odds', item: `${BASE}/nfl/playoff-odds` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b-4 shadow-xl" style={{ background: '#013369', borderBottomColor: '#D50A0A' }}>
        <div className="mx-auto max-w-5xl px-4 py-8 text-center md:py-12">
          <Link href="/" className="mb-2 inline-block">
            <p className="text-xl font-bold text-white/70 transition-colors hover:text-white md:text-2xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </p>
          </Link>
          <h1 className="mb-3 text-3xl font-bold text-white md:text-5xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            NFL Playoff Odds {season}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-white/80 md:text-lg">
            Every team&apos;s chances to make the playoffs, win the division and earn the #1 seed. Updated after every game.
          </p>
        </div>
      </header>

      <nav aria-label="Breadcrumb" className="mx-auto max-w-5xl px-4 py-3 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">NFL Playoff Odds</span>
      </nav>

      <main className="mx-auto max-w-5xl px-4 pb-12">
        {table ? (
          <>
            <p className="mb-4 text-sm text-gray-600">
              Through {table.gamesPlayed} games of the {season} season, the {leaderName} have the best playoff odds at{' '}
              {leader ? formatNFLOdds(leader.playoff) : ''}. Click a team to pick the rest of its season.
            </p>
            <ConferenceTable conf="AFC" rows={afc} />
            <ConferenceTable conf="NFC" rows={nfc} />
            <p className="mb-6 text-xs text-gray-500">
              Odds come from 10,000 simulations of the remaining schedule. Tiebreakers are approximated, so close races are estimates.
            </p>
          </>
        ) : (
          <p className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-sm text-gray-700">NFL odds are temporarily unavailable. Please check back soon.</p>
        )}

        <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">NFL playoff odds FAQ</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-sm font-bold text-gray-900 sm:text-base">{f.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href="/pick-the-bills" className="font-semibold text-sabres-blue hover:underline">Pick the Bills →</Link>
          <Link href="/nhl-playoff-odds" className="font-semibold text-sabres-blue hover:underline">NHL playoff odds →</Link>
          <Link href="/mlb/playoff-odds" className="font-semibold text-sabres-blue hover:underline">MLB playoff odds →</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
