'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { login, signup } from '@/lib/perfectseason/account';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';
import { NHL_TEAMS, MLB_TEAMS, findTeam } from '@/lib/teamConfig';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: PublicUser) => void;
  initialMode?: 'signin' | 'signup';
  /** Optional context line, e.g. "Sign in to save your score to the leaderboard". */
  reason?: string;
  /** Team slug to preselect as favorite when localStorage has none (e.g. the page's team). */
  defaultFavoriteTeam?: string;
}

/** First locally-favorited team that still maps to a real team config. */
function storedFavorite(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem('favorite-teams') ?? '[]');
    if (Array.isArray(saved)) {
      for (const slug of saved) if (typeof slug === 'string' && findTeam(slug)) return slug;
    }
  } catch {
    // Ignore malformed localStorage.
  }
  return null;
}

/** Keep the hamburger/home-grid favorites in sync with the account's favorite. */
function mergeFavoriteIntoLocalStorage(slug: string | undefined) {
  if (!slug || !findTeam(slug)) return;
  try {
    const saved = JSON.parse(localStorage.getItem('favorite-teams') ?? '[]');
    const list = Array.isArray(saved) ? saved : [];
    if (!list.includes(slug)) localStorage.setItem('favorite-teams', JSON.stringify([slug, ...list]));
  } catch {
    localStorage.setItem('favorite-teams', JSON.stringify([slug]));
  }
}

const teamOptions = (teams: Record<string, { city: string; name: string }>) =>
  Object.entries(teams)
    .map(([slug, t]) => ({ slug, label: `${t.city} ${t.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

const NHL_OPTIONS = teamOptions(NHL_TEAMS);
const MLB_OPTIONS = teamOptions(MLB_TEAMS);

const inputClass =
  'w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-sabres-blue focus:bg-white';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-500';

/** Sign In / Sign Up sheet for opt-in leaderboard accounts. Styled like ShareTeamModal. */
export default function AuthModal({ onClose, onSuccess, initialMode = 'signin', reason, defaultFavoriteTeam }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subscribe, setSubscribe] = useState(false);
  // Favorite team: prefer an existing local favorite, then the page's team.
  const [favoriteTeam, setFavoriteTeam] = useState<string>(() =>
    storedFavorite() ?? (defaultFavoriteTeam && findTeam(defaultFavoriteTeam) ? defaultFavoriteTeam : '')
  );
  const [pickingTeam, setPickingTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const favorite = favoriteTeam ? findTeam(favoriteTeam) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = mode === 'signin'
      ? await login(emailOrUsername, password)
      : await signup(email, username, password, subscribe, favoriteTeam || undefined);
    setSubmitting(false);
    if (result.ok) {
      // Sync the account favorite into local favorites at explicit auth moments
      // only (never on passive page loads), so local removals stick.
      mergeFavoriteIntoLocalStorage(result.user.favoriteTeam);
      onSuccess(result.user);
    } else setError(result.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={mode === 'signin' ? 'Sign in' : 'Sign up'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="animate-sheet-up relative max-h-[92vh] w-full max-w-[400px] overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">{reason ?? 'Save your games and compete on the leaderboard.'}</p>

        {/* Google OAuth is a planned follow-up; the "Continue with Google" button drops in here. */}

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <div>
              <label className={labelClass} htmlFor="auth-username">Username</label>
              <input id="auth-username" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your display name" autoComplete="username" maxLength={20} />
            </div>
          )}
          {mode === 'signup' ? (
            <div>
              <label className={labelClass} htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
          ) : (
            <div>
              <label className={labelClass} htmlFor="auth-id">Email or username</label>
              <input id="auth-id" className={inputClass} value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} autoComplete="username" />
            </div>
          )}
          <div>
            <label className={labelClass} htmlFor="auth-password">Password</label>
            <input id="auth-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>

          {mode === 'signup' && (
            <div>
              <label className={labelClass} htmlFor="auth-favorite">Favorite team <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              {favorite && !pickingTeam ? (
                <div className="flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2">
                  {'logo' in favorite && favorite.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={favorite.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{favorite.city} {favorite.name}</span>
                  <button type="button" onClick={() => setPickingTeam(true)} className="shrink-0 text-xs font-bold text-sabres-blue hover:underline">
                    Change
                  </button>
                </div>
              ) : (
                <select
                  id="auth-favorite"
                  className={inputClass}
                  value={favoriteTeam}
                  onChange={(e) => {
                    setFavoriteTeam(e.target.value);
                    setPickingTeam(false);
                  }}
                >
                  <option value="">No favorite</option>
                  <optgroup label="NHL">
                    {NHL_OPTIONS.map((t) => (
                      <option key={t.slug} value={t.slug}>{t.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="MLB">
                    {MLB_OPTIONS.map((t) => (
                      <option key={t.slug} value={t.slug}>{t.label}</option>
                    ))}
                  </optgroup>
                </select>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={subscribe} onChange={(e) => setSubscribe(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-sabres-blue" />
              <span>Email me about new games &amp; features from Lindy&apos;s Five. No spam, unsubscribe anytime.</span>
            </label>
          )}

          {error && <p className="text-sm font-semibold text-sabres-red">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
            className="font-bold text-sabres-blue hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
