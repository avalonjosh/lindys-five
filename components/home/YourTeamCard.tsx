'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { NHL_TEAMS, MLB_TEAMS, type TeamConfig, type MLBTeamConfig } from '@/lib/teamConfig';
import { readFavorites, onFavoritesChange, mergeFavorite, swapFavorite } from '@/lib/favorites';
import type { TeamSnapshot } from '@/lib/services/homeTeamSnapshot';

type Sport = 'nhl' | 'mlb';

const NHL_LIST = Object.values(NHL_TEAMS).sort((a, b) => a.city.localeCompare(b.city));
const MLB_LIST = Object.values(MLB_TEAMS).sort((a, b) => a.city.localeCompare(b.city));

function firstTrackedFavorite(list: string[]): string | null {
  return list.find((slug) => slug in NHL_TEAMS || slug in MLB_TEAMS) ?? null;
}

/** Config logos are the light-background versions; use the on-dark variants so dark marks (TBL, TOR) stay visible. */
function logoFor(t: TeamConfig | MLBTeamConfig): string {
  if ('mlbId' in t) return `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${t.mlbId}.svg`;
  return t.logo.replace(/_light\.svg$/, '_dark.svg');
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function darken(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  return `#${[0, 2, 4].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

/** Team config colors vary a lot (some accents equal the primary, some primaries are too light for white text), so pick a readable pair. */
export function cardColors(colors: { primary: string; secondary: string; accent: string }): { bg: string; accent: string } {
  let bg = colors.primary;
  for (let amount = 0.15; contrast(bg, '#FFFFFF') < 4.5 && amount <= 0.9; amount += 0.15) bg = darken(colors.primary, amount);
  const accent = [colors.accent, colors.secondary].find((c) => contrast(c, bg) >= 4.5) ?? '#FFFFFF';
  return { bg, accent };
}

function TeamPicker({ current, onDone }: { current: string | null; onDone?: () => void }) {
  const [sport, setSport] = useState<Sport>(current && current in MLB_TEAMS ? 'mlb' : 'nhl');
  const teams = sport === 'nhl' ? NHL_LIST : MLB_LIST;

  const pick = (slug: string) => {
    if (current) swapFavorite(current, slug);
    else mergeFavorite(slug);
    onDone?.();
  };

  return (
    <section aria-labelledby="pick-team-heading" className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pick-team-heading" className="text-base font-extrabold text-white sm:text-lg">
          {current ? 'Switch your team' : 'Pick your team'}
        </h2>
        {onDone && current && (
          <button type="button" onClick={onDone} className="min-h-11 px-2 text-sm text-slate-300 underline">
            Cancel
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label="League">
        {(['nhl', 'mlb'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSport(s)}
            aria-pressed={sport === s}
            className={`min-h-10 rounded-lg text-sm font-bold transition-colors ${sport === s ? 'bg-[#003087] text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-label={`${t.city} ${t.name}`}
            title={`${t.city} ${t.name}`}
            className={`flex aspect-square items-center justify-center rounded-xl border p-2 transition-colors hover:border-slate-500 hover:bg-slate-700/80 ${t.id === current ? 'border-amber-400 bg-slate-700/80 ring-1 ring-amber-400' : 'border-slate-700 bg-slate-700/40'}`}
          >
            <img src={logoFor(t)} alt="" loading="lazy" className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">Saved on this device. Your team shows up here next time.</p>
    </section>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3 sm:p-4">
      <div className="text-xs text-slate-200 sm:text-sm">{label}</div>
      <div className="text-4xl leading-tight sm:text-5xl" style={{ fontFamily: 'Bebas Neue, sans-serif', color: accent }}>
        {value}
      </div>
      {note && <div className="text-xs text-slate-200 sm:text-sm">{note}</div>}
    </div>
  );
}

export default function YourTeamCard() {
  const [mounted, setMounted] = useState(false);
  const [favorite, setFavorite] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TeamSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setFavorite(firstTrackedFavorite(readFavorites()));
    setMounted(true);
    return onFavoritesChange((list) => setFavorite(firstTrackedFavorite(list)));
  }, []);

  useEffect(() => {
    if (!favorite) return;
    let cancelled = false;
    setSnapshot(null);
    setFailed(false);
    fetch(`/api/home/team/${favorite}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: TeamSnapshot) => { if (!cancelled) setSnapshot(data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [favorite]);

  if (!mounted) return <div className="h-72 rounded-2xl bg-slate-800/40" aria-hidden="true" />;
  if (!favorite || picking) return <TeamPicker current={favorite} onDone={picking ? () => setPicking(false) : undefined} />;

  const team = NHL_TEAMS[favorite] ?? MLB_TEAMS[favorite];
  const { bg: primary, accent } = cardColors(team.colors);
  const name = `${team.city} ${team.name}`;
  const href = favorite in NHL_TEAMS ? `/nhl/${favorite}` : `/mlb/${favorite}`;
  const nextSoon = snapshot?.next && snapshot.next.daysUntil > 1 ? `in ${snapshot.next.daysUntil} days` : snapshot?.next?.daysUntil === 1 ? 'tomorrow' : snapshot?.next ? 'today' : '';
  const [matchup, time] = snapshot?.next?.text.split(' · ') ?? [];

  return (
    <section aria-labelledby="your-team-heading" className="flex flex-col gap-4 rounded-2xl border-2 p-4 sm:p-6" style={{ background: primary, borderColor: accent }}>
      <div className="flex items-center gap-3 sm:gap-4">
        <img src={logoFor(team)} alt="" className="h-12 w-12 shrink-0 object-contain sm:h-16 sm:w-16" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-wider sm:text-xs" style={{ color: accent }}>YOUR TEAM</div>
          <h2 id="your-team-heading" className="truncate text-xl font-extrabold text-white sm:text-2xl">{name}</h2>
          {snapshot?.record && <div className="text-sm text-slate-200">{snapshot.record}</div>}
        </div>
        <button type="button" onClick={() => setPicking(true)} className="min-h-11 shrink-0 px-1 text-sm text-slate-200 underline hover:text-white">
          Change
        </button>
      </div>

      {!snapshot && !failed && <div className="h-28 animate-pulse rounded-xl bg-black/20" aria-label="Loading team" />}

      {snapshot && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {snapshot.odds !== null && <Stat label="Playoff odds" value={`${snapshot.odds}%`} note={snapshot.oddsNote} accent={accent} />}
          {snapshot.projection && <Stat label={snapshot.projection.label} value={snapshot.projection.value} note={snapshot.projection.note} />}
          {snapshot.next && (
            <div className="col-span-2 rounded-xl bg-black/25 p-3 sm:col-span-1 sm:p-4">
              <div className="text-xs text-slate-200 sm:text-sm">{snapshot.next.label}</div>
              <div className="mt-1 text-base font-bold leading-snug text-white">{matchup}</div>
              <div className="mt-0.5 text-xs text-slate-200 sm:text-sm">{[time, nextSoon].filter(Boolean).join(' · ')}</div>
            </div>
          )}
          {snapshot.odds === null && !snapshot.projection && !snapshot.next && (
            <div className="col-span-2 text-sm text-slate-200 sm:col-span-3">{snapshot.oddsNote || 'Offseason'}</div>
          )}
        </div>
      )}

      <Link
        href={href}
        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-extrabold transition-transform hover:scale-[1.02] sm:self-start sm:px-6"
        style={{ background: accent, color: primary }}
      >
        Open {team.name} tracker
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
