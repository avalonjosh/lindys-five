'use client';

import Link from 'next/link';
import { findTeam } from '@/lib/teamConfig';
import { cardColors, logoFor } from '@/components/home/YourTeamCard';
import { SectionTitle } from './ui';

export interface PickRow {
  key: string;
  teamId: string;
  title: string;
  sub: string;
  /** e.g. "7/10 right"; null while no game is graded yet. */
  result: string | null;
}

/** The latest What-If saves and how they're grading. */
export default function PicksPanel({ rows, onViewAll }: { rows: PickRow[] | null; onViewAll: () => void }) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle right={rows && rows.length > 0 && <button type="button" onClick={onViewAll} className="text-sm font-bold text-amber-400 hover:text-amber-300">View all</button>}>
        My Picks
      </SectionTitle>
      {rows == null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-slate-800/60" aria-label="Loading picks" />
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-1 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
          <span className="font-bold text-white">No saved picks yet</span>
          <span>
            Turn on What If on any <Link href="/nhl" className="font-bold text-amber-400 hover:text-amber-300">team page</Link>, pick the games, and hit Save Picks. We&apos;ll grade them as the games are played.
          </span>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-700 rounded-2xl border border-slate-700 bg-slate-800/60">
          {rows.map(r => {
            const team = findTeam(r.teamId);
            return (
              <li key={r.key} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                {team && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-1" style={{ background: cardColors(team.colors).bg }}>
                    <img src={logoFor(team)} alt="" className="h-full w-full object-contain" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{r.title}</div>
                  <div className="truncate text-xs text-slate-400">{r.sub}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${r.result ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                  {r.result ?? 'Pending'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
