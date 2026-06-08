'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { Sport } from '@/lib/perfectseason/types';
import { easternDateString, dailyDateLabel } from '@/lib/perfectseason/seed';
import {
  dailyBoard,
  alltimeBoard,
  freeBoard,
  tankBoard,
  franchiseBoard,
  type RankedEntry,
  type Variant,
} from '@/lib/perfectseason/leaderboard';
import { SPORT_UI } from './sportUi';
import { franchiseColor, franchiseLogo } from './ui';

type Tab = 'daily' | 'alltime' | 'free' | 'tank' | 'franchise';
const TABS: { key: Tab; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'alltime', label: 'All-Time' },
  { key: 'free', label: 'Free Play' },
  { key: 'tank', label: 'Tank' },
  { key: 'franchise', label: 'Franchise' },
];

function gradeColor(grade: string): string {
  switch (grade.charAt(0)) {
    case 'A': return 'text-emerald-500';
    case 'B': return 'text-sabres-blue';
    case 'C': return 'text-amber-500';
    case 'D': return 'text-orange-500';
    default: return 'text-sabres-red';
  }
}

export default function Leaderboard({ sport, franchises }: { sport: Sport; franchises: { id: string; name: string }[] }) {
  const ui = SPORT_UI[sport];
  const slug = sport === 'mlb' ? '162-0' : '82-0';
  const games = sport === 'mlb' ? 162 : 82;

  const [tab, setTab] = useState<Tab>('daily');
  const [variant, setVariant] = useState<Variant>('classic');
  const [franchiseId, setFranchiseId] = useState(franchises[0]?.id ?? '');
  const [entries, setEntries] = useState<RankedEntry[]>([]);
  const [me, setMe] = useState<RankedEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const date = easternDateString();
  const board =
    tab === 'daily' ? dailyBoard(sport, variant, date)
    : tab === 'alltime' ? alltimeBoard(sport, variant)
    : tab === 'free' ? freeBoard(sport, variant)
    : tab === 'tank' ? tankBoard(sport, variant)
    : franchiseBoard(sport, franchiseId, variant);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpanded(null);
    fetch(`/api/leaderboard/${encodeURIComponent(board)}?limit=50&me=1`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setEntries(Array.isArray(d.entries) ? d.entries : []);
        setMe(d.me ?? null);
      })
      .catch(() => !cancelled && setEntries([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [board]);

  const subtitle =
    tab === 'daily' ? dailyDateLabel(date)
    : tab === 'alltime' ? 'Best daily rating ever'
    : tab === 'free' ? 'Free play · best build'
    : tab === 'tank' ? 'Worst team wins'
    : franchises.find((f) => f.id === franchiseId)?.name ?? franchiseId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b-4 shadow-lg" style={{ background: ui.bg, borderBottomColor: ui.border }}>
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90">
            <span className="text-2xl font-bold tracking-wider text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Lindy&apos;s Five</span>
            <span className="shrink-0 rounded-md bg-sabres-gold px-2 py-0.5 text-sm font-bold tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{ui.label}</span>
          </Link>
          <Link href={`/${slug}`} className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/25">Play</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-3 py-4">
        <div className="mb-3 flex items-center justify-center gap-2 text-center">
          <Trophy className="h-6 w-6 text-sabres-gold" />
          <h1 className="text-3xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Leaderboard</h1>
        </div>

        {/* Board tabs */}
        <div className="mx-auto mb-2 grid max-w-[480px] grid-cols-5 gap-1 rounded-xl bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-1 py-2 text-center text-[10px] font-bold uppercase leading-tight transition-colors sm:text-xs ${tab === t.key ? 'bg-sabres-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Variant + franchise controls */}
        <div className="mx-auto mb-3 flex max-w-[480px] flex-wrap items-center justify-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm">
            {(['classic', 'blind'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={`rounded-lg px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide transition-colors ${variant === v ? 'bg-sabres-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v === 'classic' ? 'Classic' : 'IQ'}
              </button>
            ))}
          </div>
          {tab === 'franchise' && (
            <select
              value={franchiseId}
              onChange={(e) => setFranchiseId(e.target.value)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-sabres-blue"
            >
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>

        <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-gray-400">{subtitle}</p>

        {/* Rows */}
        {loading ? (
          <p className="py-12 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
            <p className="text-sm font-semibold text-gray-500">No scores yet — be the first.</p>
            <Link href={`/${slug}`} className="mt-3 inline-block text-sm font-bold text-sabres-blue hover:underline">Play now →</Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <Row key={e.userId} entry={e} sport={sport} games={games} highlight={me?.userId === e.userId} expanded={expanded === e.userId} onToggle={() => setExpanded(expanded === e.userId ? null : e.userId)} gradeColor={gradeColor} />
            ))}
            {me && !entries.some((e) => e.userId === me.userId) && (
              <>
                <li className="py-1 text-center text-xs font-bold text-gray-400">· · ·</li>
                <Row entry={me} sport={sport} games={games} highlight expanded={expanded === me.userId} onToggle={() => setExpanded(expanded === me.userId ? null : me.userId)} gradeColor={gradeColor} />
              </>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}

function Row({
  entry,
  sport,
  games,
  highlight,
  expanded,
  onToggle,
  gradeColor,
}: {
  entry: RankedEntry;
  sport: Sport;
  games: number;
  highlight: boolean;
  expanded: boolean;
  onToggle: () => void;
  gradeColor: (g: string) => string;
}) {
  return (
    <li className={`overflow-hidden rounded-xl border-2 shadow-sm ${highlight ? 'border-sabres-blue bg-sabres-blue/5' : 'border-gray-100 bg-white'}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-2.5 text-left">
        <span className="w-7 shrink-0 text-center text-lg font-bold text-gray-400" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{entry.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-gray-900">{entry.username}</div>
          <div className="text-[11px] font-semibold text-gray-500">{entry.wins}-{games - entry.wins} · {entry.tier}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold leading-none text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{entry.rating}</div>
          <div className={`text-xs font-bold ${gradeColor(entry.grade)}`}>{entry.grade}</div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 bg-slate-50 px-2.5 py-2">
          <div className="flex flex-col gap-1">
            {entry.rows.map((r, i) => {
              const logo = franchiseLogo(r.franchiseId, sport, 'dark');
              return (
                <div key={`${r.slot}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: franchiseColor(r.franchiseId, sport) ?? '#1e3a8a' }}>
                    {logo && <img src={logo} alt="" className="absolute h-4 w-4 object-contain opacity-30" />}
                    <span className="relative">{r.slot}</span>
                  </span>
                  <span className="flex-1 truncate font-semibold text-gray-800">{r.playerName}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">{r.franchiseId} · {r.decade}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}
