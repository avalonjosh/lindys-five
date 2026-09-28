import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Tv } from 'lucide-react';
import { NHL_TEAMS } from '@/lib/teamConfig';
import { fetchWithRetry } from '@/lib/services/nhlApi';
import { getCurrentNHLSeason, formatSeasonLabel } from '@/lib/utils/season';
import { nhlWatchInfo, watchSummary, type TvBroadcast } from '@/lib/watch/nhlWatch';
import WhereToWatch from '@/components/watch/WhereToWatch';
import SiteFooter from '@/components/SiteFooter';

export const revalidate = 3600;

const BASE = 'https://www.lindysfive.com';

export function generateStaticParams() {
  return Object.keys(NHL_TEAMS).map((team) => ({ team }));
}

interface ScheduleGame {
  id: number;
  gameType: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: string;
  homeTeam: { abbrev: string; commonName?: { default: string } };
  awayTeam: { abbrev: string; commonName?: { default: string } };
  tvBroadcasts?: TvBroadcast[];
}

async function fetchSeason(abbrev: string, season: string): Promise<ScheduleGame[]> {
  try {
    const res = await fetchWithRetry(`https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${season}`, 2);
    const data = await res.json();
    return ((data.games || []) as ScheduleGame[]).filter((g) => g.gameType === 2);
  } catch {
    return [];
  }
}

const teamName = (abbrev: string) => Object.values(NHL_TEAMS).find((t) => t.abbreviation === abbrev)?.name ?? abbrev;

function gameWhen(g: ScheduleGame): string {
  const d = new Date(g.startTimeUTC);
  const date = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time} ET`;
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const t = NHL_TEAMS[team];
  if (!t) return {};
  const full = `${t.city} ${t.name}`;
  const label = formatSeasonLabel(getCurrentNHLSeason());
  const title = `How to Watch the ${full} ${label}: TV Channel & Streaming Guide`;
  const description = `What channel is the ${t.name} game on? Every ${full} game's TV channel and streaming options for the ${label} season, local, national and out of market.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: `${BASE}/nhl/${team}/watch`, siteName: "Lindy's Five", images: [{ url: t.logo }] },
    twitter: { card: 'summary', title, description, images: [t.logo] },
    alternates: { canonical: `${BASE}/nhl/${team}/watch` },
  };
}

export default async function WatchPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const t = NHL_TEAMS[team];
  if (!t) notFound();

  const season = getCurrentNHLSeason();
  const label = formatSeasonLabel(season);
  const full = `${t.city} ${t.name}`;
  const games = await fetchSeason(t.abbreviation, season);
  const now = Date.now();
  const upcoming = games.filter((g) => new Date(g.startTimeUTC).getTime() > now - 3 * 60 * 60 * 1000 && g.gameState !== 'OFF' && g.gameState !== 'FINAL');

  // The team's own broadcasts (its side of each game), for the local TV summary.
  const localCounts = new Map<string, number>();
  let nationalCount = 0;
  for (const g of games) {
    const info = nhlWatchInfo(g.tvBroadcasts);
    const mine = g.homeTeam.abbrev === t.abbreviation ? info.home : info.away;
    if (info.nationalExclusive) nationalCount++;
    for (const n of mine) localCounts.set(n.name, (localCounts.get(n.name) || 0) + 1);
  }
  const locals = [...localCounts.entries()].sort((a, b) => b[1] - a[1]);
  const mainLocal = locals[0]?.[0];
  const nationalGames = upcoming.filter((g) => nhlWatchInfo(g.tvBroadcasts).national.length > 0);
  const next = upcoming[0];

  const faqs = [
    {
      q: `What channel is the ${t.name} game on?`,
      a: mainLocal
        ? `Most ${full} games air on ${mainLocal} in the team's home market. ${nationalCount > 0 ? `${nationalCount} games this season are on national TV instead (ESPN, ABC, TNT, NHL Network and others), and those air nationwide.` : ''} Check the schedule below for each game's channel.`
        : `Each ${full} game's channel is listed in the schedule below, including national broadcasts on ESPN, ABC, TNT and NHL Network.`,
    },
    {
      q: `How can I stream ${t.name} games?`,
      a: `In the ${t.city} area, stream local games through a live TV service that carries ${mainLocal ?? 'the team’s local network'}, such as DIRECTV or Fubo (availability varies by ZIP code). National games stream on ESPN+ or HBO Max depending on the network, or on live TV services like DIRECTV, Fubo, Sling TV and YouTube TV.`,
    },
    {
      q: `Can I watch ${t.name} games out of market?`,
      a: `Yes. In the US, out-of-market ${t.name} games stream on ESPN+ (NHL Power Play), except games on national TV. In Canada, games stream on Sportsnet+ or TSN+ depending on the broadcaster.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'NHL', item: `${BASE}/nhl` },
        { '@type': 'ListItem', position: 3, name: full, item: `${BASE}/nhl/${team}` },
        { '@type': 'ListItem', position: 4, name: 'How to watch', item: `${BASE}/nhl/${team}/watch` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  const accent = t.colors.accent || '#FFB81C';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b-4 shadow-lg" style={{ background: t.colors.primary, borderBottomColor: accent }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-white/80">
            <Tv className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">TV &amp; Streaming</span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            How to Watch the {full}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Every {t.name} game&apos;s TV channel and streaming options for the {label} season.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href="/nhl" className="hover:text-gray-700">NHL</Link>
          <span className="mx-2">/</span>
          <Link href={`/nhl/${team}`} className="hover:text-gray-700">{t.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">How to watch</span>
        </nav>

        {next && (
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">
              Next game: {next.homeTeam.abbrev === t.abbreviation ? 'vs' : '@'} {teamName(next.homeTeam.abbrev === t.abbreviation ? next.awayTeam.abbrev : next.homeTeam.abbrev)}
            </h2>
            <p className="mb-2 text-sm text-gray-500">{gameWhen(next)}</p>
            <WhereToWatch
              info={nhlWatchInfo(next.tvBroadcasts)}
              homeName={teamName(next.homeTeam.abbrev)}
              awayName={teamName(next.awayTeam.abbrev)}
              trackLabel={`watchpage-${team}`}
            />
          </section>
        )}

        <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">Local TV</h2>
          {locals.length > 0 ? (
            <>
              <p className="text-sm leading-relaxed text-gray-700">
                Most {full} games air on <strong>{mainLocal}</strong> in the team&apos;s home market.
                {nationalCount > 0 && ` ${nationalCount} games this season are national broadcasts instead.`}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {locals.slice(0, 4).map(([name, count]) => (
                  <li key={name}><strong>{name}</strong>: {count} games</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-700">Local broadcast details for the {label} season aren&apos;t published yet.</p>
          )}
          <p className="mt-3 text-sm text-gray-700">
            Out of market in the US? Games that aren&apos;t on national TV stream on ESPN+ (NHL Power Play).
          </p>
        </section>

        {nationalGames.length > 0 && (
          <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">National TV games</h2>
            <ul className="divide-y divide-gray-100">
              {nationalGames.slice(0, 12).map((g) => {
                const info = nhlWatchInfo(g.tvBroadcasts);
                const home = g.homeTeam.abbrev === t.abbreviation;
                return (
                  <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
                    <span className="text-gray-900">
                      <span className="font-semibold">{home ? 'vs' : '@'} {teamName(home ? g.awayTeam.abbrev : g.homeTeam.abbrev)}</span>
                      <span className="text-gray-500"> · {gameWhen(g)}</span>
                    </span>
                    <span className="font-semibold text-gray-700">{info.national.map((n) => n.name).join(', ')}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">Upcoming games and channels</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Opponent</th>
                    <th className="py-2 font-semibold">TV</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.slice(0, 15).map((g) => {
                    const home = g.homeTeam.abbrev === t.abbreviation;
                    return (
                      <tr key={g.id} className="border-b border-gray-100">
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{gameWhen(g)}</td>
                        <td className="py-2 pr-3 font-semibold text-gray-900">{home ? 'vs' : '@'} {teamName(home ? g.awayTeam.abbrev : g.homeTeam.abbrev)}</td>
                        <td className="py-2 text-gray-700">
                          <Link href={`/nhl/scores/${g.id}`} className="hover:underline">{watchSummary(nhlWatchInfo(g.tvBroadcasts)) ?? 'TBA'}</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">{t.name} TV and streaming FAQ</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-sm font-bold text-gray-900 sm:text-base">{f.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href={`/nhl/${team}`} className="font-semibold text-sabres-blue hover:underline">← {t.name} playoff odds</Link>
          <Link href={`/nhl/${team}/tickets`} className="font-semibold text-sabres-blue hover:underline">{t.name} tickets →</Link>
          <Link href={`/nhl/${team}/gear`} className="font-semibold text-sabres-blue hover:underline">{t.name} gear →</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
