import Link from 'next/link';
import type { SharedTeam } from '@/lib/perfectseason/share';
import { modeBadgeLabel } from '@/lib/perfectseason/share';
import { SPORT_UI } from './sportUi';
import ResultBoard, { type RosterEntry } from './board/ResultBoard';

/** Read-only view of a team someone shared via /82-0/share?id=… (or /162-0). */
export default function SharedTeamView({ team }: { team: SharedTeam }) {
  const ui = SPORT_UI[team.sport];
  const slug = team.sport === 'mlb' ? '162-0' : '82-0';
  const games = team.sport === 'mlb' ? 162 : 82;

  const roster: RosterEntry[] = team.rows.map((r) => ({
    slotLabel: r.slot,
    franchiseId: r.franchiseId,
    decade: r.decade,
    playerName: r.playerName,
    stats: [],
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b-4 shadow-lg" style={{ background: ui.bg, borderBottomColor: ui.border }}>
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90">
            <span className="text-2xl font-bold tracking-wider text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </span>
            <span className="shrink-0 rounded-md bg-sabres-gold px-2 py-0.5 text-sm font-bold tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {ui.label}
            </span>
          </Link>
          <img src={ui.logo} alt={team.sport.toUpperCase()} className={`${ui.logoClass} opacity-90`} />
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-3 py-4">
        <div className="mx-auto max-w-[480px]">
          <div className="mb-1 flex items-center justify-center gap-2 text-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">A shared roster</span>
            <span className="rounded bg-sabres-blue/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sabres-blue">
              {modeBadgeLabel(team.variant, team.modeType)}
            </span>
          </div>

          <ResultBoard
            sport={team.sport}
            games={games}
            tank={team.modeType === 'tank'}
            wins={team.wins}
            rating={team.rating || undefined}
            grade={team.grade || undefined}
            tier={team.tier || undefined}
            totalStats={[]}
            roster={roster}
          />

          <div className="mt-4 rounded-2xl border-2 border-sabres-blue/30 bg-white p-5 text-center shadow-md">
            <p className="text-sm font-semibold text-gray-600">Think you can do better?</p>
            <Link
              href={`/${slug}`}
              className="mt-3 block w-full rounded-xl bg-sabres-blue py-3.5 text-base font-bold uppercase tracking-widest text-white shadow-md transition-colors hover:bg-sabres-light"
            >
              Can you go {games}-0?
            </Link>
            <p className="mt-2 text-xs text-gray-400">Draft your own all-time {team.sport.toUpperCase()} roster — free to play.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
