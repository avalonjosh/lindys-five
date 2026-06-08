import Link from 'next/link';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';

interface TeamLite {
  slug: string;
  city: string;
  name: string;
}

function sortedTeams(teams: Record<string, { slug: string; city: string; name: string }>): TeamLite[] {
  return Object.values(teams)
    .map((t) => ({ slug: t.slug, city: t.city, name: t.name }))
    .sort((a, b) => `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`));
}

/** Sitewide footer with a full, server-rendered team directory. Every page that
 *  renders this links to all 32 NHL and 30 MLB team pages in the initial HTML,
 *  so crawlers can discover and prioritize them (the visible team grid on the
 *  hubs is client-rendered and not reliably seen by crawlers). */
export default function SiteFooter() {
  const nhl = sortedTeams(NHL_TEAMS);
  const mlb = sortedTeams(MLB_TEAMS);

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav
          aria-label="Site sections"
          className="mb-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium"
        >
          <Link href="/nhl-playoff-odds" className="transition-colors hover:text-white">NHL Playoff Odds</Link>
          <Link href="/mlb/playoff-odds" className="transition-colors hover:text-white">MLB Playoff Odds</Link>
          <Link href="/playoffs" className="transition-colors hover:text-white">Playoff Bracket</Link>
          <Link href="/nhl/scores" className="transition-colors hover:text-white">NHL Scores</Link>
          <Link href="/mlb/scores" className="transition-colors hover:text-white">MLB Scores</Link>
          <Link href="/82-0" className="transition-colors hover:text-white">82-0</Link>
          <Link href="/162-0" className="transition-colors hover:text-white">162-0</Link>
          <Link href="/blog" className="transition-colors hover:text-white">Blog</Link>
          <Link href="/feed.xml" className="transition-colors hover:text-white">RSS</Link>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Link href="/nhl" className="hover:text-white">NHL Teams</Link>
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {nhl.map((t) => (
                <li key={t.slug}>
                  <Link href={`/nhl/${t.slug}`} className="transition-colors hover:text-white">
                    {t.city} {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Link href="/mlb" className="hover:text-white">MLB Teams</Link>
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {mlb.map((t) => (
                <li key={t.slug}>
                  <Link href={`/mlb/${t.slug}`} className="transition-colors hover:text-white">
                    {t.city} {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} JRR Apps. Independent NHL &amp; MLB playoff tracker. Not affiliated with the NHL or MLB.
        </p>
      </div>
    </footer>
  );
}
