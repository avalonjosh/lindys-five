'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Loader2, Check } from 'lucide-react';

const NHL_TEAMS = [
  { slug: 'ducks', name: 'Anaheim Ducks' },
  { slug: 'bruins', name: 'Boston Bruins' },
  { slug: 'sabres', name: 'Buffalo Sabres' },
  { slug: 'flames', name: 'Calgary Flames' },
  { slug: 'hurricanes', name: 'Carolina Hurricanes' },
  { slug: 'blackhawks', name: 'Chicago Blackhawks' },
  { slug: 'avalanche', name: 'Colorado Avalanche' },
  { slug: 'bluejackets', name: 'Columbus Blue Jackets' },
  { slug: 'stars', name: 'Dallas Stars' },
  { slug: 'redwings', name: 'Detroit Red Wings' },
  { slug: 'oilers', name: 'Edmonton Oilers' },
  { slug: 'panthers', name: 'Florida Panthers' },
  { slug: 'kings', name: 'Los Angeles Kings' },
  { slug: 'wild', name: 'Minnesota Wild' },
  { slug: 'canadiens', name: 'Montreal Canadiens' },
  { slug: 'predators', name: 'Nashville Predators' },
  { slug: 'devils', name: 'New Jersey Devils' },
  { slug: 'islanders', name: 'New York Islanders' },
  { slug: 'rangers', name: 'New York Rangers' },
  { slug: 'senators', name: 'Ottawa Senators' },
  { slug: 'flyers', name: 'Philadelphia Flyers' },
  { slug: 'penguins', name: 'Pittsburgh Penguins' },
  { slug: 'sharks', name: 'San Jose Sharks' },
  { slug: 'kraken', name: 'Seattle Kraken' },
  { slug: 'blues', name: 'St. Louis Blues' },
  { slug: 'lightning', name: 'Tampa Bay Lightning' },
  { slug: 'mapleleafs', name: 'Toronto Maple Leafs' },
  { slug: 'utah', name: 'Utah Hockey Club' },
  { slug: 'canucks', name: 'Vancouver Canucks' },
  { slug: 'goldenknights', name: 'Vegas Golden Knights' },
  { slug: 'capitals', name: 'Washington Capitals' },
  { slug: 'jets', name: 'Winnipeg Jets' },
];

interface NewsletterModalProps {
  team?: string;
  teamDisplayName?: string;
  primaryColor?: string;
  accentColor?: string;
}

export default function NewsletterModal({
  team,
  teamDisplayName,
  primaryColor = '#003087',
  accentColor = '#FFB81C',
}: NewsletterModalProps) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [teams, setTeams] = useState<string[]>(team ? [team] : []);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [starredName, setStarredName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const label = starredName || teamDisplayName || 'NHL';
  const isGeneric = !team;

  useEffect(() => {
    const timerShown = () => sessionStorage.getItem('newsletterModalShown') === '1';
    const alreadySubscribed = () =>
      sessionStorage.getItem('newsletterSubscribed') === '1' ||
      localStorage.getItem('newsletter-subscribed') === '1';

    // Check if returning subscriber — never show modal
    if (localStorage.getItem('newsletter-subscribed') === '1') return;

    // For generic mode, load favorites from localStorage
    if (isGeneric && !timerShown()) {
      let hasFavorites = false;
      try {
        const stored = localStorage.getItem('favorite-teams');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTeams(parsed);
            hasFavorites = true;
          }
        }
      } catch {
        // ignore
      }
      if (!hasFavorites) {
        setShowTeamPicker(true);
      }
    }

    // Timer-based trigger (2.5s delay, once per session)
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (!timerShown()) {
      timer = setTimeout(() => {
        setVisible(true);
      }, 2500);
    }

    // Star-based trigger: always fires unless user already subscribed
    function handleTeamStarred(e: Event) {
      if (alreadySubscribed()) return;
      const { teamId } = (e as CustomEvent).detail;
      // Look up short name from NHL_TEAMS
      const matched = NHL_TEAMS.find((t) => t.slug === teamId);
      const shortName = matched ? matched.name.split(' ').pop()! : '';
      // Pre-fill with the starred team, reset form state
      setTeams((prev) => prev.includes(teamId) ? prev : [...prev, teamId]);
      setSelectedTeam(teamId);
      setStarredName(shortName);
      setShowTeamPicker(false);
      setStatus('idle');
      setMessage('');
      // Clear the timer so we don't double-show
      if (timer) clearTimeout(timer);
      setVisible(true);
    }

    window.addEventListener('team-starred', handleTeamStarred);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('team-starred', handleTeamStarred);
    };
  }, [isGeneric]);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem('newsletterModalShown', '1');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    const submitTeams = showTeamPicker
      ? (selectedTeam ? [selectedTeam] : [])
      : (teams.length > 0 ? teams : ['sabres']);

    if (submitTeams.length === 0) {
      setStatus('error');
      setMessage('Please select a team');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, teams: submitTeams, source: isGeneric ? 'odds-modal' : 'team-modal' }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message);
        sessionStorage.setItem('newsletterSubscribed', '1');
        localStorage.setItem('newsletter-subscribed', '1');
        setTimeout(dismiss, 2500);
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Header */}
        <div
          className="px-6 py-5"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
          }}
        >
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5 text-white/80" />
            <span
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {label}
            </span>
          </div>
          <h2
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Never Miss a Recap
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {status === 'success' ? (
            <div className="text-center py-4">
              <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-gray-900 font-medium">{message}</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-4">
                Get {label !== 'NHL' ? `${label} ` : ''}game recaps and set analyses delivered to your inbox. Free, no spam.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3">
                {showTeamPicker && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => { setSelectedTeam(e.target.value); setStatus('idle'); }}
                    className="w-full px-4 py-2.5 rounded-lg text-sm border-2 border-gray-200 focus:outline-none transition-colors bg-white text-gray-700 appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                    onFocus={(e) => (e.target.style.borderColor = primaryColor)}
                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                  >
                    <option value="">Select your team...</option>
                    {NHL_TEAMS.map((t) => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm border-2 border-gray-200 focus:outline-none transition-colors"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  onFocus={(e) => (e.target.style.borderColor = primaryColor)}
                  onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50 shrink-0"
                  style={{ background: primaryColor }}
                >
                  {status === 'loading' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Subscribe'
                  )}
                </button>
                </div>
              </form>
              {status === 'error' && (
                <p className="text-red-500 text-xs mt-2">{message}</p>
              )}
              <p className="text-gray-400 text-xs mt-3">Unsubscribe anytime with one click.</p>
            </>
          )}
        </div>
      </div>
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
