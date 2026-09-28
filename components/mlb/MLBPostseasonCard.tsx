import Link from 'next/link';
import { Trophy } from 'lucide-react';
import AffiliateLink from '@/components/affiliate/AffiliateLink';
import WhereToWatch from '@/components/watch/WhereToWatch';
import { mlbWatchInfo } from '@/lib/watch/mlbWatch';
import { seriesHeadline, type MLBPostseason, type PostseasonGame } from '@/lib/services/mlbPostseason';

function GameRow({ g, oppName, teamSlug, color }: { g: PostseasonGame; oppName: string; teamSlug: string; color: string }) {
  const won = g.state === 'final' && (g.teamScore ?? 0) > (g.oppScore ?? 0);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
      <Link href={`/mlb/scores/${g.gamePk}`} className="min-w-0 hover:underline">
        <span className="font-semibold text-gray-900">
          Game {g.gameNumber}
          {g.ifNecessary && g.state === 'upcoming' && <span className="text-gray-400">*</span>}
        </span>
        <span className="text-gray-500"> · {g.isHome ? 'vs' : '@'} {oppName}</span>
        {g.state === 'upcoming' && <span className="text-gray-500"> · {g.when}</span>}
      </Link>
      <span className="flex items-center gap-2">
        {g.state === 'final' && (
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${won ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {won ? 'W' : 'L'} {g.teamScore}-{g.oppScore}
          </span>
        )}
        {g.state === 'live' && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            Live {g.teamScore}-{g.oppScore}
          </span>
        )}
        {g.state !== 'final' && g.tv && <span className="text-xs font-semibold text-gray-600">{g.tv}</span>}
        {g.state === 'upcoming' && g.ticketLink && (
          <AffiliateLink
            href={g.ticketLink}
            track="tickets"
            trackLabel={`mlb-postseason-${teamSlug}`}
            className="rounded-md px-2 py-1 text-xs font-bold text-white"
            style={{ background: color }}
          >
            Tickets
          </AffiliateLink>
        )}
      </span>
    </li>
  );
}

/** Postseason status for an MLB team page: the current series game by game,
 *  earlier rounds as one-liners, and where to watch the next game. */
export default function MLBPostseasonCard({
  postseason,
  teamName,
  teamSlug,
  color,
  season,
}: {
  postseason: MLBPostseason;
  teamName: string;
  teamSlug: string;
  color: string;
  season: number;
}) {
  const current = postseason.series[postseason.series.length - 1];
  const earlier = postseason.series.slice(0, -1);
  const next = current.games.find((g) => g.state !== 'final');
  const nextWatch = next && !postseason.eliminated ? mlbWatchInfo(next.broadcasts) : null;

  return (
    <section className="mb-4 rounded-2xl border-2 bg-white p-3 shadow-xl md:p-4" style={{ borderColor: color }}>
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-4 w-4" style={{ color }} />
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{season} Postseason</h2>
      </div>
      <p className="text-lg font-bold text-gray-900 md:text-2xl">{seriesHeadline(teamName, current)}</p>
      {current.state !== 'won' && current.state !== 'lost' && (
        <p className="text-sm text-gray-500">
          {current.name} vs {current.oppName} · best of {current.bestOf}
        </p>
      )}

      {earlier.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
          {earlier.map((s) => (
            <li key={s.name}>
              {s.short}: {s.state === 'won' ? 'won' : s.state === 'lost' ? 'lost' : ''} {s.teamWins}-{s.oppWins} vs {s.oppName}
            </li>
          ))}
        </ul>
      )}

      {current.games.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100">
          {current.games.map((g) => (
            <GameRow key={g.gamePk} g={g} oppName={current.oppName} teamSlug={teamSlug} color={color} />
          ))}
        </ul>
      )}
      {current.games.some((g) => g.ifNecessary && g.state === 'upcoming') && (
        <p className="mt-1 text-[11px] text-gray-400">* If necessary</p>
      )}

      {next && nextWatch && (
        <WhereToWatch
          className="mt-3"
          info={nextWatch.info}
          homeName={next.isHome ? teamName : current.oppName}
          awayName={next.isHome ? current.oppName : teamName}
          trackLabel={`mlb-postseason-${teamSlug}`}
          note={nextWatch.spanish.length ? `En español: ${nextWatch.spanish.join(', ')}` : undefined}
        />
      )}

      <p className="mt-3 text-xs">
        <Link href="/mlb/watch" className="font-semibold text-sabres-blue hover:underline">Full MLB playoffs TV schedule →</Link>
      </p>
    </section>
  );
}
