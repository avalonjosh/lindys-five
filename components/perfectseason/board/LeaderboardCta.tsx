'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';
import type { SubmitState } from '@/lib/perfectseason/account';

interface LeaderboardCtaProps {
  user: PublicUser | null;
  status: SubmitState;
  onSave: () => void;
  slug: string;
  kind: 'daily' | 'free';
}

/** Shared leaderboard call-to-action / submission status for both result screens. */
export default function LeaderboardCta({ user, status, onSave, slug, kind }: LeaderboardCtaProps) {
  const viewLink = (
    <Link href={`/${slug}/leaderboard`} className="text-sabres-blue underline-offset-2 hover:underline">
      View leaderboard
    </Link>
  );

  if (status.status === 'submitting') {
    return <Box>Posting your score…</Box>;
  }
  if (status.status === 'done') {
    const r = status.result;
    return (
      <Box>
        <span className="font-bold text-sabres-navy">
          <Trophy className="mr-1 inline h-4 w-4 text-sabres-gold" />
          On the leaderboard{r?.rank ? ` — #${r.rank}` : ''}
        </span>{' '}
        · {viewLink}
      </Box>
    );
  }
  if (status.status === 'error') {
    return (
      <Box>
        <span className="text-sabres-red">{status.error || "Couldn't post score"}.</span>{' '}
        <button type="button" onClick={onSave} className="font-bold text-sabres-blue hover:underline">
          Try again
        </button>
      </Box>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={onSave}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-sabres-navy py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-blue"
    >
      <Trophy className="h-4 w-4 text-sabres-gold" />
      {user ? (kind === 'daily' ? 'Save to leaderboard' : 'Submit to leaderboard') : kind === 'daily' ? 'Sign in to save your score' : 'Sign in to compete'}
    </button>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm text-gray-600">{children}</div>;
}
