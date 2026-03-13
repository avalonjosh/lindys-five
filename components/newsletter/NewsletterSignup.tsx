'use client';

import { useState, useEffect } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';

interface NewsletterSignupProps {
  teams?: string[];
  variant: 'inline' | 'banner' | 'compact';
  source: string;
  teamDisplayName?: string;
  primaryColor?: string;
  accentColor?: string;
}

export default function NewsletterSignup({
  teams: initialTeams,
  variant,
  source,
  teamDisplayName,
  primaryColor = '#003087',
  accentColor = '#FFB81C',
}: NewsletterSignupProps) {
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
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return <SuccessMessage message={message} variant={variant} primaryColor={primaryColor} />;
  }

  if (variant === 'compact') {
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
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/10 text-white placeholder:text-white/50 border border-white/20 focus:outline-none focus:border-white/50"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: accentColor, color: primaryColor }}
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
