'use client';

import { useState } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';

interface InlineEmailCaptureProps {
  /** Tracks where the signup came from (e.g. 'home', 'mlb-odds', 'nhl-scores'). */
  source: string;
  theme?: 'light' | 'dark';
  heading?: string;
  subtext?: string;
}

/**
 * Always-visible, non-intrusive email capture for general/SEO pages (home, odds,
 * scores) where there's no single team to attribute. General opt-in (no team) via
 * the single opt-in quick-subscribe endpoint — keeps these signups off team recap
 * lists they didn't choose; they get the broadcast/weekly digest.
 */
export default function InlineEmailCapture({
  source,
  theme = 'light',
  heading = 'Get NHL & MLB playoff updates',
  subtext = 'Playoff odds, new games, and leaderboards — no spam, unsubscribe anytime.',
}: InlineEmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const dark = theme === 'dark';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/newsletter/quick-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Try again');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setError('Network error');
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-semibold ${dark ? 'border-slate-700 bg-slate-800/50 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
        <Check className="h-4 w-4" /> You&apos;re on the list — thanks!
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${dark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-white shadow-sm'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mail className={`h-5 w-5 ${dark ? 'text-gray-400' : 'text-sabres-blue'}`} />
            <h3 className={`text-lg font-bold ${dark ? 'text-white' : 'text-sabres-navy'}`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {heading}
            </h3>
          </div>
          <p className={`mt-0.5 text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{subtext}</p>
        </div>
        <form onSubmit={submit} className="flex w-full gap-2 sm:w-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm outline-none sm:w-56 ${dark ? 'border border-slate-600 bg-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500' : 'border-2 border-gray-200 bg-gray-50 text-gray-900 focus:border-sabres-blue focus:bg-white'}`}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="shrink-0 rounded-lg bg-sabres-blue px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sabres-light disabled:opacity-60"
          >
            {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe'}
          </button>
        </form>
      </div>
      {status === 'error' && <p className={`mt-2 text-xs font-semibold ${dark ? 'text-red-400' : 'text-sabres-red'}`}>{error}</p>}
    </div>
  );
}
