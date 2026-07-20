'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Lock, Check, Mail } from 'lucide-react';
import { saveWhatIfPicks } from '@/lib/whatif/client';
import type { WhatIfSubmission } from '@/lib/whatif/types';

/** Whether the newsletter ask is suppressed on this browser (subscribed or recently declined). */
function newsletterSuppressed(): boolean {
  try {
    if (localStorage.getItem('newsletter-subscribed') === '1') return true;
    return Number(localStorage.getItem('newsletter-dismissed-until') || 0) > Date.now();
  } catch {
    return false;
  }
}

interface SavePicksModalProps {
  onClose: () => void;
  submission: WhatIfSubmission;
  teamName: string;
  totalGames: number;
}

/** Confirm-and-save sheet for What-If picks. Styled like AuthModal. */
export default function SavePicksModal({ onClose, submission, teamName, totalGames }: SavePicksModalProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [replacedToday, setReplacedToday] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [nlStatus, setNlStatus] = useState<'idle' | 'sending' | 'done' | 'error' | 'dismissed'>('idle');
  const [nlMessage, setNlMessage] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Resolve the newsletter ask up front so it's ready the moment a save lands.
  // Saving requires being signed in, so status normally comes back signedIn.
  useEffect(() => {
    if (newsletterSuppressed()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/newsletter/status', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.signedIn) return;
        if (data.subscribed) {
          try { localStorage.setItem('newsletter-subscribed', '1'); } catch { /* ignore */ }
          return;
        }
        setAccountEmail(data.email);
      } catch {
        // Network hiccup: just skip the ask.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dateLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const { summary } = submission;
  const setsLabel = summary.setsCovered.map((s) => `Set ${s.set}: ${s.picked}/${s.of}`).join(' · ');

  const save = async () => {
    if (status === 'saving') return;
    setStatus('saving');
    setError(null);
    const result = await saveWhatIfPicks(submission);
    if (result.ok) {
      setReplacedToday(result.data.replacedToday);
      setStatus('done');
    } else {
      setError(result.error);
      setStatus('error');
    }
  };

  const subscribeToRecaps = async () => {
    if (!accountEmail || nlStatus === 'sending') return;
    setNlStatus('sending');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: accountEmail,
          teams: [submission.teamId],
          source: 'post-save-prompt',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNlMessage(data.message || 'Check your inbox to confirm your subscription.');
        setNlStatus('done');
        try {
          localStorage.setItem('newsletter-subscribed', '1');
          sessionStorage.setItem('newsletterSubscribed', '1');
        } catch { /* ignore */ }
      } else {
        setNlMessage(data.error || 'Something went wrong');
        setNlStatus('error');
      }
    } catch {
      setNlMessage('Network error. Please try again.');
      setNlStatus('error');
    }
  };

  const declineRecaps = () => {
    setNlStatus('dismissed');
    try {
      // Same 30-day cooldown the newsletter popup uses, so declining here
      // quiets the ask everywhere instead of re-prompting on the next save.
      if (localStorage.getItem('newsletter-subscribed') !== '1') {
        localStorage.setItem('newsletter-dismissed-until', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Save your picks">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="animate-sheet-up relative max-h-[92vh] w-full max-w-[400px] overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {status === 'done' ? 'Picks Saved' : 'Save Your Picks'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {status === 'done' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
              <Check className="h-5 w-5 shrink-0" />
              <span>
                Your {teamName} picks for {dateLabel} are saved{replacedToday ? ' (replaced your earlier save from today)' : ''}.
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Save again on a future date to build your prediction history and see how your picks change over time.
            </p>
            {accountEmail && nlStatus !== 'dismissed' && (
              <div className="rounded-lg border-2 border-gray-100 p-3">
                {nlStatus === 'done' ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                    <Check className="h-5 w-5 shrink-0" />
                    <span>{nlMessage}</span>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gray-800">
                      <Mail className="h-4 w-4 shrink-0 text-sabres-blue" />
                      <span>Want {teamName} game recaps by email?</span>
                    </div>
                    <p className="mb-3 text-xs text-gray-500">
                      We&apos;ll send recaps to <span className="font-semibold text-gray-700">{accountEmail}</span> after every game. Free, unsubscribe anytime.
                    </p>
                    {nlStatus === 'error' && <p className="mb-2 text-xs font-semibold text-sabres-red">{nlMessage}</p>}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={subscribeToRecaps}
                        disabled={nlStatus === 'sending'}
                        className="rounded-lg bg-sabres-blue px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-sabres-light disabled:opacity-60"
                      >
                        {nlStatus === 'sending' ? 'Sending…' : 'Email Me Recaps'}
                      </button>
                      <button type="button" onClick={declineRecaps} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
                        No thanks
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <Link
              href="/account"
              className="w-full rounded-xl bg-sabres-blue py-3 text-center text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
            >
              View My Picks
            </Link>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700">
              Keep simulating
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">Snapshot your {teamName} What-If predictions as of today.</p>

            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <Lock className="h-4 w-4 shrink-0 text-gray-400" />
              <span>
                Dated <span className="font-bold">{dateLabel}</span> — the date is locked in and can&apos;t be changed.
              </span>
            </div>

            <div className="rounded-lg border-2 border-gray-100 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">What you&apos;re saving</div>
              <dl className="flex flex-col gap-1.5 text-sm text-gray-700">
                <div className="flex justify-between">
                  <dt>Games picked</dt>
                  <dd className="font-bold">{summary.gamesPicked} of {totalGames}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Your picks&apos; record</dt>
                  <dd className="font-bold">{summary.record}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{submission.sport === 'mlb' ? 'Projected wins' : 'Projected points'}</dt>
                  <dd className="font-bold">{summary.projectedPoints}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Playoff odds</dt>
                  <dd className="font-bold">{summary.playoffOdds.toFixed(1)}%</dd>
                </div>
              </dl>
              {setsLabel && <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">{setsLabel}</p>}
            </div>

            <p className="text-xs text-gray-500">One save per team per day — saving again today replaces today&apos;s earlier save.</p>

            {error && <p className="text-sm font-semibold text-sabres-red">{error}</p>}

            <button
              type="button"
              onClick={save}
              disabled={status === 'saving'}
              className="mt-1 w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light disabled:opacity-60"
            >
              {status === 'saving' ? 'Saving…' : 'Save Picks'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
