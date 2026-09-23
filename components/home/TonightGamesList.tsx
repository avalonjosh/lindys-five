'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

export interface TonightGame {
  key: string;
  href: string;
  sport: 'nhl' | 'mlb';
  league: string;
  away: string;
  home: string;
  awayScore?: number;
  homeScore?: number;
  state: 'live' | 'upcoming' | 'final';
  status: string;
  sortMinutes: number;
}

type Filter = 'nhl' | 'mlb';

export default function TonightGamesList({ games }: { games: TonightGame[] }) {
  const counts = { nhl: games.filter((g) => g.sport === 'nhl').length, mlb: games.filter((g) => g.sport === 'mlb').length };
  const [filter, setFilter] = useState<Filter>(counts.nhl > 0 ? 'nhl' : 'mlb');
  const listRef = useRef<HTMLUListElement>(null);
  const shown = games.filter((g) => g.sport === filter);
  const filters: { id: Filter; label: string }[] = [
    { id: 'nhl', label: 'NHL' },
    { id: 'mlb', label: 'MLB' },
  ];

  const choose = (f: Filter) => {
    setFilter(f);
    if (listRef.current) listRef.current.scrollLeft = 0;
  };

  return (
    <section aria-labelledby="tonight-heading" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="tonight-heading" className="text-2xl text-white sm:text-3xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Today&apos;s Games
        </h2>
        {counts.nhl > 0 && counts.mlb > 0 && (
          <div className="flex rounded-lg bg-slate-800 p-0.5" role="group" aria-label="Filter games by league">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => choose(f.id)}
                aria-pressed={filter === f.id}
                className={`min-h-9 rounded-md px-3 text-xs font-bold transition-colors sm:text-sm ${
                  filter === f.id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul ref={listRef} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-color:#334155_transparent] [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {shown.map((g) => (
          <li key={g.key} className="shrink-0 snap-start">
            <Link
              href={g.href}
              className="flex w-36 flex-col gap-1 rounded-xl border border-slate-700 bg-slate-800/70 p-2.5 transition-colors hover:border-slate-500"
            >
              <span className="flex h-4 items-center justify-between gap-1 whitespace-nowrap text-[11px] leading-none">
                <span className="text-slate-400">{g.league}</span>
                {g.state === 'live' ? (
                  <span className="rounded bg-red-600 px-1.5 py-0.5 font-extrabold text-white">{g.status}</span>
                ) : (
                  <span className="font-bold text-slate-300">{g.status}</span>
                )}
              </span>
              {[{ abbrev: g.away, score: g.awayScore }, { abbrev: g.home, score: g.homeScore }].map((side, i) => (
                <span key={i} className="flex items-center justify-between text-sm font-bold text-white">
                  <span>{i === 0 ? side.abbrev : `@ ${side.abbrev}`}</span>
                  {side.score !== undefined && <span className="tabular-nums">{side.score}</span>}
                </span>
              ))}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex gap-4 text-xs font-bold text-blue-300 sm:text-sm">
        {filter === 'nhl' && <Link href="/nhl/scores" className="hover:text-white">Full NHL scoreboard</Link>}
        {filter === 'mlb' && <Link href="/mlb/scores" className="hover:text-white">Full MLB scoreboard</Link>}
      </div>
    </section>
  );
}
