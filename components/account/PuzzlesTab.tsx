'use client';

import Link from 'next/link';
import { ChevronRight, Flame } from 'lucide-react';
import JerseyCard from '@/components/perfectseason/JerseyCard';
import { CARD_MILESTONES, TIER_LABEL, nextMilestone, type StreakCard } from '@/lib/perfectseason/cards';
import type { ProfileBoard, ProfileResponse } from '@/app/api/account/profile/route';
import { SectionTitle } from './overview/ui';

const GAMES = [
  { sport: 'nhl', title: '82-0', league: 'NHL', href: '/82-0', bg: '#0b2463', border: '#1e40af', label: 'text-blue-200' },
  { sport: 'mlb', title: '162-0', league: 'MLB', href: '/162-0', bg: '#041E42', border: '#1e3a6e', label: 'text-red-200' },
] as const;

const BOARD_KIND_LABELS: Record<ProfileBoard['kind'], string> = {
  alltime: 'All-Time Daily Best',
  free: 'Free Play',
  tank: 'Tank Mode',
  franchise: 'Franchise',
};

function boardLabel(b: ProfileBoard): string {
  const kind = BOARD_KIND_LABELS[b.kind] ?? b.kind;
  return b.franchiseId ? `${kind} · ${b.franchiseId}` : kind;
}

function gradeClasses(grade: string): string {
  switch (grade.charAt(0).toUpperCase()) {
    case 'A': case 'S': return 'bg-emerald-500/20 text-emerald-300';
    case 'B': return 'bg-teal-500/20 text-teal-300';
    case 'C': return 'bg-yellow-400/20 text-yellow-300';
    case 'D': return 'bg-orange-500/20 text-orange-300';
    default: return 'bg-red-500/20 text-red-300';
  }
}

function rankClasses(rank: number): string {
  if (rank === 1) return 'bg-amber-400 text-slate-900';
  if (rank === 2) return 'bg-slate-300 text-slate-900';
  if (rank === 3) return 'bg-orange-400 text-slate-900';
  return 'bg-white/10 text-white';
}

function Stat({ value, label, short }: { value: string; label: string; short?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/25 p-3">
      <div className="truncate text-3xl leading-none text-white sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{value}</div>
      <div className="mt-1 truncate text-xs text-slate-200">
        {short ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span></> : label}
      </div>
    </div>
  );
}

/** The Puzzles tab: each game's streak and best scores, then the streak card collection. */
export default function PuzzlesTab({
  profile,
  username,
  onShare,
}: {
  profile: ProfileResponse | null;
  username: string;
  onShare: (card: StreakCard) => void;
}) {
  if (profile == null) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-800/60" aria-label="Loading" />;
  }
  const { daily, boards } = profile.perfectSeason;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          right={daily.count > 0 && (
            <span className="text-xs text-slate-400 sm:text-sm">
              {daily.count} Dail{daily.count === 1 ? 'y' : 'ies'} played{daily.bestRating != null && ` · best ${daily.bestRating.toFixed(1)}`}
            </span>
          )}
        >
          Your Games
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {GAMES.map(g => {
            const streak = daily.bySport?.[g.sport] ?? { current: 0, best: 0 };
            const next = nextMilestone(g.sport, streak.current);
            const played = daily.playedToday[g.sport];
            const gameBoards = boards.filter(b => b.sport === g.sport);
            return (
              <div key={g.sport} className="flex flex-col gap-4 rounded-2xl border p-4 sm:p-5" style={{ background: g.bg, borderColor: g.border }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="whitespace-nowrap text-5xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{g.title}</span>
                    <span className={`text-[11px] font-bold tracking-wider ${g.label}`}>{g.league} · {played ? 'PLAYED' : 'NOT PLAYED'}<span className="hidden sm:inline"> TODAY</span></span>
                  </div>
                  <Link
                    href={g.href}
                    className={`flex min-h-10 shrink-0 items-center gap-0.5 rounded-lg px-4 text-sm font-bold text-white transition-colors ${played ? 'border border-white/30 hover:bg-white/10' : 'bg-white/15 hover:bg-white/25'}`}
                  >
                    {played ? 'Result' : 'Play'} <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <Stat value={String(streak.current)} label="Day streak" />
                  <Stat value={String(streak.best)} label="Best streak" />
                  <Stat value={next ? `${next.daysLeft}` : '✓'} label={next ? `Days to ${TIER_LABEL[next.tier]}` : 'All cards'} short={next ? `To ${TIER_LABEL[next.tier]}` : undefined} />
                </div>
                {streak.current > 0 && next && (
                  <p className="-mt-1 flex items-center gap-1 text-xs font-bold text-amber-400">
                    <Flame className="h-3.5 w-3.5" aria-hidden />
                    Play every day: the {next.days}-day {TIER_LABEL[next.tier]} card is {next.daysLeft} day{next.daysLeft === 1 ? '' : 's'} away.
                  </p>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Best scores</span>
                    <Link href={`${g.href}/leaderboard`} className="text-xs font-bold text-amber-400 hover:text-amber-300">Leaderboard →</Link>
                  </div>
                  {gameBoards.length === 0 ? (
                    <p className="rounded-xl bg-black/25 px-3 py-3 text-sm text-slate-300">
                      No saved scores yet. Save a board to the leaderboard after you play and your best shows up here.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-white/10 rounded-xl bg-black/25">
                      {gameBoards.map(b => (
                        <li key={b.board} className="flex items-center gap-2.5 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
                              <span className="truncate">{boardLabel(b)}</span>
                              {b.variant === 'blind' && (
                                <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">Blind</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-300">{b.wins}-{b.losses} · rating {b.rating.toFixed(1)}</div>
                          </div>
                          <span className={`shrink-0 rounded-lg px-2 py-1 text-sm font-bold ${gradeClasses(b.grade)}`}>{b.grade}</span>
                          {b.rank != null && (
                            <span className={`min-w-11 shrink-0 rounded-full px-2 py-0.5 text-center text-sm font-bold ${rankClasses(b.rank)}`}>#{b.rank}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionTitle right={<span className="text-xs text-slate-400 sm:text-sm">{profile.cards.length} earned</span>}>Streak Cards</SectionTitle>
        <p className="text-sm text-slate-300">
          Play a game&apos;s Daily on consecutive days to earn its cards: bronze at 7 days, silver at 30, gold at 82 (82-0) or 162 (162-0). Miss a day and the streak starts over. Tap a card to flip it.
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
          {profile.cards.map(card => (
            <div key={card.id} className="flex flex-col items-center gap-1.5">
              <JerseyCard card={card} width={150} owner={username} />
              <button type="button" onClick={() => onShare(card)} className="text-xs font-bold text-amber-400 hover:text-amber-300">
                Share
              </button>
            </div>
          ))}
          {GAMES.flatMap(g =>
            CARD_MILESTONES[g.sport]
              .filter(m => !profile.cards.some(c => c.sport === g.sport && c.milestone === m.days))
              .map(m => (
                <div
                  key={`${g.sport}-${m.days}`}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 text-center text-slate-500"
                  style={{ width: 150, height: 210 }}
                >
                  <span className="text-3xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{m.days}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">{g.title} · {TIER_LABEL[m.tier]}</span>
                  <span className="mt-1 text-[10px]">Not earned yet</span>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
