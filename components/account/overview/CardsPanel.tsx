'use client';

import Link from 'next/link';
import JerseyCard from '@/components/perfectseason/JerseyCard';
import { nextMilestone, TIER_LABEL, type StreakCard } from '@/lib/perfectseason/cards';
import type { ProfileResponse } from '@/app/api/account/profile/route';
import { SectionTitle } from './ui';

const GAME = { nhl: '82-0', mlb: '162-0' } as const;

/** The newest streak card and how close the next one is. */
export default function CardsPanel({
  profile,
  username,
  onViewAll,
  onShare,
}: {
  profile: ProfileResponse | null;
  username: string;
  onViewAll: () => void;
  onShare: (card: StreakCard) => void;
}) {
  const latest = profile?.cards[0] ?? null;
  const by = profile?.perfectSeason.daily.bySport;
  // Progress toward the game with the longer live streak (82-0 when tied or none).
  const sport: 'nhl' | 'mlb' = by && by.mlb.current > by.nhl.current ? 'mlb' : 'nhl';
  const streak = by?.[sport].current ?? 0;
  const next = nextMilestone(sport, streak);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle right={<button type="button" onClick={onViewAll} className="text-sm font-bold text-amber-400 hover:text-amber-300">View all</button>}>
        Streak Cards
      </SectionTitle>
      <div className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        {latest ? (
          <JerseyCard card={latest} width={120} owner={username} />
        ) : (
          <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 text-center text-slate-500" style={{ width: 120, height: 168 }}>
            <span className="text-3xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{next?.days ?? 7}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">days</span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {latest ? (
            <div className="text-sm text-slate-300">
              Latest: <span className="font-bold text-white">{latest.player.name}</span>, {latest.milestone}-day {TIER_LABEL[latest.tier]}
              <button type="button" onClick={() => onShare(latest)} className="ml-2 text-xs font-bold text-amber-400 hover:text-amber-300">Share</button>
            </div>
          ) : (
            <div className="text-sm text-slate-300">
              Play a game&apos;s Daily {next?.days ?? 7} days in a row to earn your first card.
            </div>
          )}
          {next && (
            <>
              <div className="text-xs text-slate-400">Next: {next.days}-day {TIER_LABEL[next.tier]} ({GAME[sport]})</div>
              <div className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuemin={0} aria-valuemax={next.days} aria-valuenow={streak}>
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((streak / next.days) * 100)}%` }} />
              </div>
              <div className="text-xs text-slate-400">{streak} of {next.days} days</div>
            </>
          )}
          {streak === 0 && (
            <Link href={`/${GAME[sport]}`} className="self-start text-xs font-bold text-amber-400 hover:text-amber-300">Play today&apos;s {GAME[sport]} →</Link>
          )}
        </div>
      </div>
    </section>
  );
}
