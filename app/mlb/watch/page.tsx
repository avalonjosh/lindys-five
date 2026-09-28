import type { Metadata } from 'next';
import Link from 'next/link';
import { Tv } from 'lucide-react';
import { fetchWithRetry } from '@/lib/services/nhlApi';
import { mlbWatchInfo, type MLBBroadcast } from '@/lib/watch/mlbWatch';
import WhereToWatch from '@/components/watch/WhereToWatch';
import SiteFooter from '@/components/SiteFooter';

export const revalidate = 1800;

const BASE = 'https://www.lindysfive.com';

interface PostseasonGame {
  gamePk: number;
  gameDate: string;
  gameType: string;
  seriesDescription: string;
  seriesGameNumber?: number;
  gamesInSeries?: number;
  ifNecessary?: string;
  status: { detailedState: string; startTimeTBD?: boolean };
  teams: {
    away: { team: { name: string }; score?: number };
    home: { team: { name: string }; score?: number };
  };
  broadcasts?: MLBBroadcast[];
}

const ROUND_ORDER = ['F', 'D', 'L', 'W'];
const ROUND_NAMES: Record<string, string> = { F: 'Wild Card Series', D: 'Division Series', L: 'Championship Series', W: 'World Series' };

const seasonYear = () => new Date().getFullYear();

async function fetchPostseason(year: number): Promise<PostseasonGame[]> {
  try {
    const res = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${year}-09-20&endDate=${year}-11-15&gameType=F,D,L,W&hydrate=broadcasts(all),team`,
      2,
    );
    const data = await res.json();
    return (data.dates || []).flatMap((d: { games: PostseasonGame[] }) => d.games);
  } catch {
    return [];
  }
}

function when(g: PostseasonGame): string {
  const d = new Date(g.gameDate);
  const date = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  if (g.status.startTimeTBD) return `${date} · Time TBA`;
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time} ET`;
}

const tvNames = (g: PostseasonGame) => mlbWatchInfo(g.broadcasts).info.national.map((n) => n.name).join(', ');

export async function generateMetadata(): Promise<Metadata> {
  const year = seasonYear();
  const title = `How to Watch the ${year} MLB Playoffs: TV Schedule & Streaming`;
  const description = `What channel are the MLB playoffs on? The ${year} MLB postseason TV schedule for the Wild Card Series, Division Series, LCS and World Series, with streaming options for every game.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: `${BASE}/mlb/watch`, siteName: "Lindy's Five" },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE}/mlb/watch` },
  };
}

export default async function MLBWatchPage() {
  const year = seasonYear();
  const games = await fetchPostseason(year);
  const now = Date.now();
  const nextGame = games.find((g) => new Date(g.gameDate).getTime() > now - 4 * 60 * 60 * 1000 && g.status.detailedState !== 'Final');

  // Rounds in order, each split into its series (AL/NL), with the round's networks.
  const rounds = ROUND_ORDER.map((type) => {
    const list = games.filter((g) => g.gameType === type);
    const series = new Map<string, PostseasonGame[]>();
    for (const g of list) series.set(g.seriesDescription, [...(series.get(g.seriesDescription) || []), g]);
    const networks = [...new Set(list.map(tvNames).filter(Boolean))];
    return { type, name: ROUND_NAMES[type], series: [...series.entries()], networks, sample: list[0] };
  }).filter((r) => r.series.length > 0);

  const roundTv = (type: string) => rounds.find((r) => r.type === type)?.networks.join(' and ');
  const faqs = [
    {
      q: `What channel are the ${year} MLB playoffs on?`,
      a: rounds.length
        ? rounds.map((r) => `${r.name}: ${r.networks.join(' and ') || 'TBA'}`).join('. ') + '.'
        : `The ${year} MLB postseason TV schedule will be posted here once it's announced.`,
    },
    {
      q: 'How can I stream the MLB playoffs?',
      a: 'NBC games stream on Peacock, TBS and truTV games stream on HBO Max, and FOX and FS1 games stream on FOX One. Live TV services like DIRECTV, Fubo, Sling TV and YouTube TV carry most of these networks too.',
    },
    {
      q: `What channel is the ${year} World Series on?`,
      a: roundTv('W') ? `The ${year} World Series is on ${roundTv('W')}.` : 'The World Series airs on FOX, and streams on FOX One.',
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'MLB', item: `${BASE}/mlb` },
        { '@type': 'ListItem', position: 3, name: 'How to watch the playoffs', item: `${BASE}/mlb/watch` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  const nextWatch = nextGame ? mlbWatchInfo(nextGame.broadcasts) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b-4 border-red-600 shadow-lg" style={{ background: '#041E42' }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-white/80">
            <Tv className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">TV &amp; Streaming</span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            How to Watch the {year} MLB Playoffs
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Every postseason game&apos;s TV channel and streaming options, from the Wild Card Series to the World Series.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href="/mlb" className="hover:text-gray-700">MLB</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">How to watch the playoffs</span>
        </nav>

        {nextGame && nextWatch && (
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">
              Next game: {nextGame.teams.away.team.name} at {nextGame.teams.home.team.name}
            </h2>
            <p className="mb-2 text-sm text-gray-500">{nextGame.seriesDescription} · {when(nextGame)}</p>
            <WhereToWatch
              info={nextWatch.info}
              homeName={nextGame.teams.home.team.name}
              awayName={nextGame.teams.away.team.name}
              trackLabel="mlb-watchpage"
              note={nextWatch.spanish.length ? `En español: ${nextWatch.spanish.join(', ')}` : undefined}
            />
          </section>
        )}

        {rounds.length === 0 && (
          <p className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 text-sm text-gray-700 sm:p-6">
            The {year} postseason TV schedule isn&apos;t posted yet. Check back once the bracket is set.
          </p>
        )}

        {rounds.map((r) => (
          <section key={r.type} className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{r.name}</h2>
              {r.networks.length > 0 && <span className="text-sm font-semibold text-gray-700">{r.networks.join(' · ')}</span>}
            </div>
            {r.series.map(([desc, list]) => (
              <div key={desc} className="mb-4 last:mb-0">
                {r.series.length > 1 && <h3 className="mb-1 text-sm font-bold text-gray-500">{desc}</h3>}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {list.map((g) => {
                        const final = g.status.detailedState === 'Final';
                        return (
                          <tr key={g.gamePk} className="border-b border-gray-100">
                            <td className="whitespace-nowrap py-2 pr-3 text-gray-600">
                              {g.seriesGameNumber ? `Game ${g.seriesGameNumber}` : ''}
                              {g.ifNecessary === 'Y' && <span className="text-gray-400">*</span>}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{when(g)}</td>
                            <td className="py-2 pr-3 font-semibold text-gray-900">
                              <Link href={`/mlb/scores/${g.gamePk}`} className="hover:underline">
                                {g.teams.away.team.name} at {g.teams.home.team.name}
                              </Link>
                              {final && <span className="ml-1 font-normal text-gray-500">({g.teams.away.score}-{g.teams.home.score})</span>}
                            </td>
                            <td className="py-2 text-gray-700">{tvNames(g) || 'TBA'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {r.series.some(([, list]) => list.some((g) => g.ifNecessary === 'Y')) && (
              <p className="mt-2 text-xs text-gray-400">* If necessary</p>
            )}
          </section>
        ))}

        <section className="mb-6 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 sm:text-xl">MLB playoffs TV and streaming FAQ</h2>
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
          <Link href="/mlb/playoff-odds" className="font-semibold text-sabres-blue hover:underline">MLB playoff odds →</Link>
          <Link href="/mlb/scores" className="font-semibold text-sabres-blue hover:underline">MLB scores →</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
