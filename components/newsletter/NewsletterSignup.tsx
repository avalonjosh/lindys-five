'use client';

import { useState, useEffect } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';
import { useNewsletterStatus, accountSubscribe } from '@/lib/useNewsletterStatus';

interface NewsletterSignupProps {
  teams?: string[];
  variant: 'inline' | 'banner' | 'compact';
  source: string;
  teamDisplayName?: string;
  primaryColor?: string;
  accentColor?: string;
  /** Render nothing for visitors who already subscribed on this browser. */
  hideIfSubscribed?: boolean;
}

export default function NewsletterSignup({
  teams: initialTeams,
  variant,
  source,
  teamDisplayName,
  primaryColor = '#003087',
  accentColor = '#FFB81C',
  hideIfSubscribed = false,
}: NewsletterSignupProps) {
  const [hidden, setHidden] = useState(false);
  const account = useNewsletterStatus();
  const [oneTap, setOneTap] = useState<'idle' | 'loading' | 'done' | 'pending' | 'error'>('idle');
  const [email, setEmail] = useState('');
  const [teams, setTeams] = useState<string[]>(initialTeams || []);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Load favorites from localStorage if no teams pre-filled
  useEffect(() => {
    if (!initialTeams || initialTeams.length === 0) {
      try {
        const stored = localStorage.getItem('favorite-teams');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTeams(parsed);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [initialTeams]);

  useEffect(() => {
    if (!hideIfSubscribed) return;
    try {
      if (localStorage.getItem('newsletter-subscribed') === '1') setHidden(true);
    } catch {
      // ignore
    }
  }, [hideIfSubscribed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;

    const submitTeams = teams.length > 0 ? teams : ['sabres'];

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, teams: submitTeams, source }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message);
        try {
          localStorage.setItem('newsletter-subscribed', '1');
        } catch {
          // ignore
        }
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  // Signed in: we already have their email, so no form. Hide if they already
  // get this team's recaps or unsubscribed on purpose; otherwise one tap.
  if (account.loading) return null;
  if (account.signedIn) {
    const team = initialTeams?.[0];
    const label = teamDisplayName || 'game';
    if (oneTap === 'done') {
      return <SuccessMessage message={`Done! ${teamDisplayName ? `${teamDisplayName} recaps` : 'Recaps'} are headed to ${account.email ?? 'your inbox'}.`} variant={variant} primaryColor={primaryColor} />;
    }
    if (oneTap === 'pending') {
      return <SuccessMessage message={`Almost there. Confirm your email with the link we sent to ${account.email ?? 'your inbox'}, and ${teamDisplayName ? `${teamDisplayName} recaps` : 'recaps'} start.`} variant={variant} primaryColor={primaryColor} />;
    }
    if (account.unsubscribed) return null;
    if (account.subscribed && (!team || account.teams.includes(team))) return null;
    const tap = async () => {
      setOneTap('loading');
      const result = await accountSubscribe(team, source);
      setOneTap(result === 'active' ? 'done' : result === 'pending' ? 'pending' : 'error');
    };
    const dark = variant !== 'inline';
    return (
      <div
        className={`rounded-2xl p-5 shadow-lg border-2 ${variant === 'inline' ? 'mt-4 bg-white border-gray-200' : ''}`}
        style={dark ? { background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`, borderColor: accentColor } : undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Mail className={`w-4 h-4 ${dark ? 'text-white/80' : ''}`} style={dark ? undefined : { color: primaryColor }} />
              <h3 className={`text-lg font-bold ${dark ? 'text-white' : ''}`} style={{ fontFamily: 'Bebas Neue, sans-serif', ...(dark ? {} : { color: primaryColor }) }}>
                Get {label} Recaps in Your Inbox
              </h3>
            </div>
            <p className={`mt-0.5 text-xs ${dark ? 'text-white/70' : 'text-gray-500'}`}>
              {account.subscribed ? `Add ${label} recaps to your Lindy's Five emails.` : `One tap. We'll send them to ${account.email}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={tap}
            disabled={oneTap === 'loading'}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={dark
              ? { background: Math.abs(luminance(accentColor) - luminance(primaryColor)) < 0.25 ? '#ffffff' : accentColor, color: primaryColor }
              : { background: primaryColor, color: '#ffffff' }}
          >
            {oneTap === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${label} Recaps`}
          </button>
        </div>
        {oneTap === 'error' && <p className={`mt-2 text-xs ${dark ? 'text-red-300' : 'text-red-500'}`}>Couldn&apos;t subscribe right now. Please try again.</p>}
      </div>
    );
  }

  // Signed out: hide once this browser has subscribed.
  if (hidden) return null;

  if (status === 'success') {
    return <SuccessMessage message={message} variant={variant} primaryColor={primaryColor} />;
  }

  if (variant === 'compact') {
    // Many team configs repeat the primary as the accent; fall back to white
    // so the button never disappears into the card.
    const buttonBg = Math.abs(luminance(accentColor) - luminance(primaryColor)) < 0.25 ? '#ffffff' : accentColor;
    return (
      <div
        className="rounded-2xl p-5 shadow-lg border-2"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
          borderColor: accentColor,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-white/80" />
          <h3
            className="text-lg font-bold text-white"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Get {teamDisplayName || 'Game'} Recaps in Your Inbox
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm bg-white/10 text-white placeholder:text-white/50 border border-white/20 focus:outline-none focus:border-white/50"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: buttonBg, color: primaryColor }}
          >
            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
          </button>
        </form>
        {status === 'error' && <p className="text-red-300 text-xs mt-2">{message}</p>}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-gray-400" />
              <h3
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Get Game Recaps Delivered
              </h3>
            </div>
            <p className="text-gray-400 text-sm">
              Follow your favorite teams — get game recaps and set analyses in your inbox.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 sm:w-auto w-full">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 sm:w-56 px-4 py-2.5 rounded-lg text-sm bg-slate-700 text-white placeholder:text-slate-400 border border-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50 shrink-0"
              style={{ background: '#003087' }}
            >
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
            </button>
          </form>
        </div>
        {status === 'error' && <p className="text-red-400 text-xs mt-2">{message}</p>}
      </div>
    );
  }

  // variant === 'inline'
  return (
    <div className="mt-4 rounded-2xl p-6 shadow-xl border-2 border-gray-200 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5" style={{ color: primaryColor }} />
        <h3
          className="text-xl font-bold"
          style={{ color: primaryColor, fontFamily: 'Bebas Neue, sans-serif' }}
        >
          Get Recaps Like This in Your Inbox
        </h3>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Never miss a game recap or set analysis. Free, no spam, unsubscribe anytime.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-2.5 rounded-lg text-sm border-2 border-gray-200 focus:outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
          style={{ background: primaryColor }}
        >
          {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
        </button>
      </form>
      {status === 'error' && <p className="text-red-500 text-xs mt-2">{message}</p>}
    </div>
  );
}

function SuccessMessage({
  message,
  variant,
  primaryColor,
}: {
  message: string;
  variant: string;
  primaryColor: string;
}) {
  if (variant === 'banner') {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 text-center">
        <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-white font-medium">{message}</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="rounded-2xl p-5 shadow-lg border-2 text-center"
        style={{ background: primaryColor, borderColor: primaryColor }}
      >
        <Check className="w-6 h-6 text-green-300 mx-auto mb-1" />
        <p className="text-white text-sm font-medium">{message}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl p-6 shadow-xl border-2 border-green-200 bg-green-50 text-center">
      <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
      <p className="text-green-800 font-medium">{message}</p>
    </div>
  );
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
