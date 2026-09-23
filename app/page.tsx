import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import TodaysPuzzles from '@/components/home/TodaysPuzzles';
import YourTeamCard from '@/components/home/YourTeamCard';
import TonightGames from '@/components/home/TonightGames';
import HomeEmailSignup from '@/components/home/HomeEmailSignup';

// Today's games are server-rendered, so refresh the page every minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "NHL & MLB Playoff Odds, Standings & Scores | Lindy's Five" },
  description:
    "Live NHL and MLB playoff odds, standings, projections, and scores for every team, tracked five games at a time. Will your team make the playoffs? Updated after every game.",
  openGraph: {
    title: "Lindy's Five: NHL & MLB Playoff Odds, Standings & Scores",
    description:
      "Live NHL and MLB playoff odds, standings, projections, and scores for every team, tracked five games at a time.",
    type: 'website',
    url: 'https://www.lindysfive.com/',
    siteName: "Lindy's Five",
    images: [{ url: '/api/og?type=sport-hub&sport=nhl&title=Lindy%27s%20Five&subtitle=NHL%20%26%20MLB%20playoff%20odds%2C%20standings%20%26%20scores', width: 1200, height: 630, alt: "Lindy's Five" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Lindy's Five — NHL & MLB Playoff Tracker",
    description:
      "Track your team's playoff race with 5-game set analysis. NHL and MLB standings, projections, and odds updated daily.",
    images: ['/api/og?type=sport-hub&sport=nhl&title=Lindy%27s%20Five&subtitle=NHL%20%26%20MLB%20playoff%20odds%2C%20standings%20%26%20scores'],
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/',
  },
};

const NAV_LINKS: { href: string; label: string; mobile?: boolean }[] = [
  { href: '/nhl', label: 'NHL', mobile: true },
  { href: '/mlb', label: 'MLB', mobile: true },
  { href: '/nhl/scores', label: 'Scores', mobile: true },
  { href: '/nhl-playoff-odds', label: 'Playoff Odds' },
  { href: '/82-0', label: '82-0' },
  { href: '/162-0', label: '162-0' },
  { href: '/blog', label: 'Blog' },
];

const SPORT_TILES = [
  { href: '/nhl', label: 'NHL', note: '32 teams · playoff odds', className: 'bg-[#003087]' },
  { href: '/mlb', label: 'MLB', note: '30 teams · playoff odds', className: 'bg-[#041E42] border border-[#1e3a6e]' },
  { href: '#pick-the-team', label: 'NFL', note: 'Pick the team', className: 'bg-slate-800 border border-slate-700' },
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: "Lindy's Five",
            description: "Track every season, five games at a time. NHL and MLB playoff odds and projections.",
            url: 'https://www.lindysfive.com',
            publisher: { '@id': 'https://www.lindysfive.com/#organization' },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            '@id': 'https://www.lindysfive.com/#organization',
            name: "Lindy's Five",
            url: 'https://www.lindysfive.com',
            logo: 'https://www.lindysfive.com/favicon.svg',
            description: 'Independent NHL and MLB playoff odds tracker covering all 62 teams, five games at a time.',
            parentOrganization: { '@type': 'Organization', name: 'JRR Apps' },
            sameAs: ['https://x.com/lindysfive'],
          }),
        }}
      />

      <div className="flex min-h-screen flex-col bg-slate-900 text-white">
        <header className="border-b border-slate-800">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
            <Link href="/" className="text-3xl leading-none sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </Link>
            <nav aria-label="Main" className="flex items-center gap-4 text-sm font-semibold text-slate-200 sm:gap-6 sm:text-[15px]">
              {NAV_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={`hover:text-amber-400 ${l.mobile ? '' : 'hidden lg:inline'}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:gap-8 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-4xl leading-none sm:text-5xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Will your team make the playoffs?
            </h1>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Live odds for every NHL and MLB team, updated after every game and tracked five games at a time. Plus two free daily roster puzzles.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:order-2 lg:col-span-5">
              <TodaysPuzzles />
            </div>
            <div className="lg:order-1 lg:col-span-7">
              <YourTeamCard />
            </div>
          </div>

          <TonightGames />

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <nav aria-label="Sports" className="grid grid-cols-3 gap-2 sm:gap-3 lg:col-span-7">
              {SPORT_TILES.map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl p-3 text-center transition-transform hover:scale-[1.03] sm:min-h-28 sm:items-start sm:justify-between sm:rounded-2xl sm:p-4 sm:text-left ${t.className}`}
                >
                  <span className="text-2xl leading-none sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{t.label}</span>
                  <span className="text-[11px] text-slate-300 sm:text-sm">{t.note}</span>
                </Link>
              ))}
            </nav>
            <div className="lg:col-span-5">
              <HomeEmailSignup />
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
