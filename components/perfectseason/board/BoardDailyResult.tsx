'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SportConfig } from '@/lib/perfectseason/types';
import type { DailyRecord, Streak } from '@/lib/perfectseason/storage';
import { sharedTeamFromRecord, type SharedTeam } from '@/lib/perfectseason/share';
import { dailyDateLabel } from '@/lib/perfectseason/seed';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';
import type { SubmitState } from '@/lib/perfectseason/account';
import ResultBoard, { type RosterEntry } from './ResultBoard';
import ShareTeamModal from './ShareTeamModal';
import LeaderboardCta from './LeaderboardCta';
import NewsletterPrompt from './NewsletterPrompt';
import JerseyCard from '../JerseyCard';
import ShareCardSheet from '../ShareCardSheet';
import { TIER_LABEL } from '@/lib/perfectseason/cards';

interface NhlDailyResultProps {
  record: DailyRecord;
  config: SportConfig;
  variant: 'classic' | 'blind';
  streak: Streak;
  played: number;
  onPlayFree: () => void;
  user: PublicUser | null;
  canSave: boolean;
  saveStatus: SubmitState;
  onSave: () => void;
}

function secondsUntilEtMidnight(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get('hour') % 24;
  return 24 * 3600 - (h * 3600 + get('minute') * 60 + get('second'));
}

function fmt(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Daily result for NHL: the 82-0.com-style ResultBoard plus our daily layer. */
export default function NhlDailyResult({ record, config, variant, streak, played, onPlayFree, user, canSave, saveStatus, onSave }: NhlDailyResultProps) {
  const slug = config.sport === 'mlb' ? '162-0' : '82-0';
  const [shareTeam, setShareTeam] = useState<SharedTeam | null>(null);
  const [left, setLeft] = useState(secondsUntilEtMidnight());
  const cardInfo = saveStatus.status === 'done' ? saveStatus.result : undefined;
  const [shareCard, setShareCard] = useState(false);
  // Signed in, the saved streak (any device, the one cards count) beats this browser's own count.
  const current = cardInfo?.streak ?? streak.current;
  const best = Math.max(streak.best, current);

  useEffect(() => {
    const t = setInterval(() => setLeft(secondsUntilEtMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  const roster: RosterEntry[] = record.grid.map((c) => ({
    slotLabel: c.slot,
    franchiseId: c.franchiseId ?? '',
    decade: c.decade,
    // Pre-fix records have no player name; fall back to the team name.
    playerName: c.playerName || c.franchise,
    stats: c.stats ?? [],
  }));

  const dayLabel = record.date ? dailyDateLabel(record.date) : `Daily #${record.dayNumber}`;

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {dayLabel} · {variant === 'blind' ? `🧠 ${config.blindLabel}` : 'Classic'}
        </p>
      </div>

      <ResultBoard
        sport={config.sport}
        games={config.games}
        tank={false}
        wins={record.wins}
        rating={record.rating}
        grade={record.grade}
        tier={record.tier}
        totalStats={config.totalStats}
        roster={roster}
      />

      <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Next daily in</p>
        <p className="text-2xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {fmt(left)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {current >= 2 ? `🔥 ${current}-day streak` : current === 1 ? 'Day 1 of a new streak' : 'Play tomorrow to start a streak'} · Best {best} · Played {played}
        </p>
        {/* Streak cards: the server's count of saved Dailies decides them. */}
        {user ? (
          cardInfo?.nextCard && !cardInfo.card && (
            <p className="mt-1 text-xs font-semibold text-sabres-navy">
              {cardInfo.nextCard.daysLeft === 1 ? 'Play tomorrow' : `${cardInfo.nextCard.daysLeft} more days`} to earn your {cardInfo.nextCard.days}-Day {TIER_LABEL[cardInfo.nextCard.tier]} card
            </p>
          )
        ) : (
          <p className="mt-1 text-xs text-gray-500">Sign in to save your streak and earn streak cards at 7, 30 and {config.games} days.</p>
        )}
      </div>

      {cardInfo?.card && (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-sabres-gold bg-white px-4 py-5 text-center shadow-md">
          <p className="text-lg font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            New card: {cardInfo.card.milestone}-Day {TIER_LABEL[cardInfo.card.tier]}
          </p>
          <JerseyCard card={cardInfo.card} width={260} owner={user?.username} />
          <p className="text-xs text-gray-500">Tap the card to flip it.</p>
          <button
            type="button"
            onClick={() => setShareCard(true)}
            className="w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
          >
            Share your card
          </button>
          <Link href="/account?tab=perfectseason" className="text-sm font-bold text-sabres-blue underline-offset-2 hover:underline">
            See your collection
          </Link>
        </div>
      )}
      {shareCard && cardInfo?.card && <ShareCardSheet card={cardInfo.card} onClose={() => setShareCard(false)} />}

      {canSave ? (
        <LeaderboardCta user={user} status={saveStatus} onSave={onSave} slug={slug} kind="daily" />
      ) : (
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm text-gray-600">
          <Link href={`/${slug}/leaderboard`} className="text-sabres-blue underline-offset-2 hover:underline">
            View leaderboard
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShareTeam(sharedTeamFromRecord(record, config, variant, Date.now()))}
          className="w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          Share your team
        </button>
        <button
          type="button"
          onClick={onPlayFree}
          className="w-full rounded-xl border-2 border-gray-300 bg-white py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition-colors hover:border-gray-400"
        >
          Free Play
        </button>
      </div>

      {shareTeam && <ShareTeamModal team={shareTeam} onClose={() => setShareTeam(null)} />}

      <NewsletterPrompt sport={config.sport === 'mlb' ? 'mlb' : 'nhl'} />

      <Link
        href={config.sport === 'mlb' ? '/82-0' : '/162-0'}
        className="block text-center text-xs font-semibold text-sabres-blue underline-offset-2 hover:underline"
      >
        {config.sport === 'mlb' ? 'Now try the NHL daily · 82-0 🏒' : 'Now try the MLB daily · 162-0 ⚾'}
      </Link>
    </div>
  );
}
