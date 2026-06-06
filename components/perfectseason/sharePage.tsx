import type { Metadata } from 'next';
import Link from 'next/link';
import { kv } from '@vercel/kv';
import { shareKey, type SharedTeam } from '@/lib/perfectseason/share';
import type { Sport } from '@/lib/perfectseason/types';
import SharedTeamView from './SharedTeamView';

const SITE = 'https://www.lindysfive.com';

async function loadTeam(sport: Sport, id?: string): Promise<SharedTeam | null> {
  if (!id) return null;
  const team = await kv.get<SharedTeam>(shareKey(id));
  // Guard against an id from the other sport landing on this route.
  if (!team || team.sport !== sport) return null;
  return team;
}

/** Per-share OG/Twitter metadata so the link unfurls the team card. */
export async function shareMetadata(sport: Sport, id?: string): Promise<Metadata> {
  const slug = sport === 'mlb' ? '162-0' : '82-0';
  const team = await loadTeam(sport, id);
  if (!team) {
    return { title: `Shared team — ${slug}`, robots: { index: false, follow: true } };
  }
  const title = `${team.wins}-${team.losses} — can you go ${slug}?`;
  const description = `A shared all-time ${sport.toUpperCase()} roster projected to go ${team.wins}-${team.losses}. Build your own and see if you can go ${slug}.`;
  const url = `${SITE}/${slug}/share?id=${id}`;
  const images = id ? [`${SITE}/api/og?type=ps-team&id=${id}`] : [];
  return {
    title,
    description,
    alternates: { canonical: url },
    // User-generated and ephemeral — keep these out of the index but follow links.
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: "Lindy's Five", images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

/** The page body: the shared team, or a friendly fallback for a bad/expired id. */
export default async function SharePageBody(sport: Sport, id?: string) {
  const team = await loadTeam(sport, id);
  if (team) return <SharedTeamView team={team} />;

  const slug = sport === 'mlb' ? '162-0' : '82-0';
  const games = sport === 'mlb' ? 162 : 82;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Team not found</p>
      <h1 className="mt-2 text-2xl font-bold text-sabres-navy">This shared team link is invalid or expired.</h1>
      <Link
        href={`/${slug}`}
        className="mt-6 rounded-xl bg-sabres-blue px-6 py-3.5 text-base font-bold uppercase tracking-widest text-white shadow-md transition-colors hover:bg-sabres-light"
      >
        Can you go {games}-0?
      </Link>
    </div>
  );
}
