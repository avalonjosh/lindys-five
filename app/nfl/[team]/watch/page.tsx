import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Tv } from 'lucide-react';
import { NFL_TEAMS, findNFLTeamByPickSlug } from '@/lib/teamConfig';
import { fetchNFLSchedule, nflSeasonYear } from '@/lib/services/nflApi';
import { nflWatchInfo, NFL_REGIONAL_NOTE } from '@/lib/watch/nflWatch';
import WhereToWatch from '@/components/watch/WhereToWatch';
import SiteFooter from '@/components/SiteFooter';
import type { NFLGameResult } from '@/lib/types/nfl';

export const revalidate = 3600;

const BASE = 'https://www.lindysfive.com';

// URL segment is the team nickname used by the Pick the {Team} pages.
export function generateStaticParams() {
  return Object.values(NFL_TEAMS).map((t) => ({ team: t.pickSlug }));
}

function kickoff(g: NFLGameResult): string {
  const d = g.startIso ? new Date(g.startIso) : null;
  if (!d) return g.date;
  const date = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  // Unscheduled kickoffs (e.g. Week 18) come through as midnight Eastern.
  return time === '12:00 AM' ? `${date} · Time TBA` : `${date} · ${time} ET`;
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const t = findNFLTeamByPickSlug(team);
  if (!t) return {};
  const full = `${t.city} ${t.name}`;
  const season = nflSeasonYear();
  const title = `How to Watch the ${full} ${season}: TV Channel & Streaming Guide`;
  const description = `What channel is the ${t.name} game on? Every ${full} game's TV network and streaming options for the ${season} NFL season, including out-of-market options.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: `${BASE}/nfl/${team}/watch`, siteName: "Lindy's Five", images: [{ url: t.logo }] },
    twitter: { card: 'summary', title, description, images: [t.logo] },
    alternates: { canonical: `${BASE}/nfl/${team}/watch` },
  };
}

export default async function NFLWatchPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const t = findNFLTeamByPickSlug(team);
  if (!t) notFound();

  const season = nflSeasonYear();
  const full = `${t.city} ${t.name}`;
  let games: NFLGameResult[] = [];
  try {
    games = (await fetchNFLSchedule(t.abbreviation, season)).games;
  } catch {
    /* page still renders the FAQ */
  }
  const upcoming = games.filter((g) => g.outcome === 'PENDING');
  const next = upcoming[0];
  // Everything but the regional Sunday afternoon CBS/FOX window airs nationwide.
  const primetime = upcoming.filter((g) => (g.tv || []).length > 0 && !nflWatchInfo(g.tv, g.startIso || '').regional);
  const nextWatch = next ? nflWatchInfo(next.tv, next.startIso || '') : null;
  const pickUrl = `/pick-the-${t.pickSlug}`;

  const faqs = [
    {
      q: `What channel is the ${t.name} game on?`,
      a: `${t.name} games air on CBS, FOX, NBC, ESPN/ABC, Prime Video or Netflix depending on the week. The schedule below lists the network for every remaining ${full} game. Sunday afternoon games on CBS and FOX are regional, so they air in the ${t.city} market and wherever the network picks them up.`,
    },
    {
      q: `How can I stream ${t.name} games?`,
      a: `Live TV services like DIRECTV, Fubo and YouTube TV carry CBS, FOX, NBC and ESPN. CBS games also stream on Paramount+, NBC games on Peacock, Thursday Night Football on Prime Video, and ESPN/ABC games in the ESPN app.`,
    },
    {
      q: `How do I watch the ${t.name} out of market?`,
      a: `Primetime games (Thursday, Sunday and Monday night) air nationally. For Sunday afternoon games outside the ${t.city} market, NFL Sunday Ticket on YouTube carries every out-of-market game.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: `Pick the ${t.name}`, item: `${BASE}${pickUrl}` },
        { '@type': 'ListItem', position: 3, name: 'How to watch', item: `${BASE}/nfl/${team}/watch` },
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

      <header className="border-b-4 shadow-lg" style={{ background: t.colors.primary, borderBottomColor: t.colors.secondary }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-white/80">
            <Tv className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">TV &amp; Streaming</span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            How to Watch the {full}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Every {t.name} game&apos;s TV network and streaming options for the {season} season.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href={pickUrl} className="hover:text-gray-700">Pick the {t.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">How to watch</span>
        </nav>

        {next && nextWatch && (
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">
              Next game: {next.isHome ? 'vs' : '@'} {next.opponentName}
            </h2>
            <p className="mb-2 text-sm text-gray-500">Week {next.week} · {kickoff(next)}</p>
            <WhereToWatch
              info={nextWatch.info}
              homeName={next.isHome ? t.name : next.opponentName}
              awayName={next.isHome ? next.opponentName : t.name}
              trackLabel={`nflwatch-${t.id}`}
              note={nextWatch.regional ? NFL_REGIONAL_NOTE : undefined}
            />
          </section>
        )}

        {primetime.length > 0 && (
          <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">National and primetime games</h2>
            <ul className="divide-y divide-gray-100">
              {primetime.map((g) => (
                <li key={g.gameId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
                  <span className="text-gray-900">
                    <span className="font-semibold">{g.isHome ? 'vs' : '@'} {g.opponentName}</span>
                    <span className="text-gray-500"> · Week {g.week} · {kickoff(g)}</span>
                  </span>
                  <span className="font-semibold text-gray-700">{(g.tv || []).join(', ')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">{season} TV schedule</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-semibold">Wk</th>
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Opponent</th>
                    <th className="py-2 font-semibold">TV</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((g) => (
                    <tr key={g.gameId} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-600">{g.week}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{kickoff(g)}</td>
                      <td className="py-2 pr-3 font-semibold text-gray-900">{g.isHome ? 'vs' : '@'} {g.opponentName}</td>
                      <td className="py-2 text-gray-700">{(g.tv || []).join(', ') || 'TBA'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">{NFL_REGIONAL_NOTE} Flexed games can move networks late in the season.</p>
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
          <Link href={pickUrl} className="font-semibold text-sabres-blue hover:underline">← Pick the {t.name}</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
