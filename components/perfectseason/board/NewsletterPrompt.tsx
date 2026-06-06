'use client';

import { useEffect, useState } from 'react';
import { Check, Mail, X } from 'lucide-react';

const DISMISS_KEY = 'l5ps.newsletter-dismissed';

/**
 * Lightweight, dismissible email-capture shown on the result screens — the
 * biggest growth lever, since it catches players who never make an account.
 * Single opt-in via /api/newsletter/quick-subscribe (general broadcast list).
 */
export default function NewsletterPrompt() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Reveal only if not previously dismissed/subscribed (avoids a flash for those who were).
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const remember = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    setShow(false);
    remember();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setError(null);
    try {
      const res = await fetch('/api/newsletter/quick-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Try again');
        setStatus('error');
        return;
      }
      setStatus('done');
      remember();
    } catch {
      setError('Network error');
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <Check className="h-4 w-4" /> You&apos;re on the list — thanks!
      </div>
    );
  }
  if (!show) return null;

  return (
    <div className="relative rounded-xl border-2 border-gray-200 bg-white p-3 shadow-sm">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 pr-6">
        <Mail className="h-4 w-4 shrink-0 text-sabres-blue" />
        <p className="text-sm font-bold text-gray-900">Be first to know about new games</p>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">Occasional updates from Lindy&apos;s Five. No spam, unsubscribe anytime.</p>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="min-w-0 flex-1 rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-sabres-blue focus:bg-white"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="shrink-0 rounded-lg bg-sabres-blue px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-sabres-light disabled:opacity-60"
        >
          {status === 'submitting' ? '…' : 'Notify me'}
        </button>
      </form>
      {error && <p className="mt-1 text-xs font-semibold text-sabres-red">{error}</p>}
    </div>
  );
}
