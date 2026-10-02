'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { login, signup, requestPasswordReset } from '@/lib/perfectseason/account';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';
import { NHL_TEAMS, MLB_TEAMS, findTeam } from '@/lib/teamConfig';
import { readFavorites, mergeFavorite } from '@/lib/favorites';
import { logoFor } from '@/components/home/YourTeamCard';

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
  return readFavorites().find((slug) => findTeam(slug)) ?? null;
}

const teamOptions = (teams: Record<string, { city: string; name: string }>) =>
  Object.entries(teams)
    .map(([slug, t]) => ({ slug, label: `${t.city} ${t.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

const NHL_OPTIONS = teamOptions(NHL_TEAMS);
const MLB_OPTIONS = teamOptions(MLB_TEAMS);

// Shown once Google sign-in is configured (credentials + redirect URI) for this deploy.
const GOOGLE_SIGNIN = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === '1';

const inputClass =
  'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-amber-400';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-300';
const primaryButton =
  'mt-1 w-full rounded-xl bg-amber-400 py-3 text-sm font-extrabold uppercase tracking-wide text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-60';

/** Sign In / Sign Up sheet for accounts, in the site's dark style (same look on light and dark pages). */
export default function AuthModal({ onClose, onSuccess, initialMode = 'signin', reason, defaultFavoriteTeam }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [resetSent, setResetSent] = useState<string | null>(null);
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
    if (mode === 'forgot') {
      const sent = await requestPasswordReset(emailOrUsername);
      setSubmitting(false);
      if (sent.ok) setResetSent(sent.message);
      else setError(sent.error);
      return;
    }
    const result = mode === 'signin'
      ? await login(emailOrUsername, password)
      : await signup(email, username, password, subscribe, favoriteTeam || undefined);
    setSubmitting(false);
    if (result.ok) {
      // Star the account favorite in the hamburger/home grid right away.
      if (result.user.favoriteTeam && findTeam(result.user.favoriteTeam)) mergeFavorite(result.user.favoriteTeam);
      onSuccess(result.user);
    } else setError(result.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Reset password' : 'Sign up'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-up relative max-h-[92vh] w-full max-w-[400px] overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-3xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {mode === 'signin' ? 'Sign In' : mode === 'forgot' ? 'Reset Password' : 'Sign Up'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-300">
          {mode === 'forgot'
            ? "Enter your email or username and we'll email you a link to choose a new password."
            : reason ?? 'Save your games and compete on the leaderboard.'}
        </p>

        {GOOGLE_SIGNIN && mode !== 'forgot' && (
          <>
            <a
              href={`/api/auth/google?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/account')}`}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-500 bg-slate-950 py-3 text-sm font-bold text-white transition-colors hover:border-slate-400 hover:bg-slate-800"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </a>
            <div className="my-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-700" />or<span className="h-px flex-1 bg-slate-700" />
            </div>
          </>
        )}

        {mode === 'forgot' && resetSent ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">{resetSent}</p>
            <p className="text-xs text-slate-400">Don&apos;t see it? Check your spam folder, or try again in a few minutes.</p>
            <button
              type="button"
              onClick={() => { setMode('signin'); setResetSent(null); setError(null); }}
              className={primaryButton}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
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
          {mode !== 'forgot' && (
            <div>
              <label className={labelClass} htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); }}
                  className="mt-1.5 text-xs font-semibold text-amber-400 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className={labelClass} htmlFor="auth-favorite">Favorite team <span className="font-normal normal-case text-slate-400">(optional)</span></label>
              {favorite && !pickingTeam ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2">
                  <img src={logoFor(favorite)} alt="" className="h-6 w-6 shrink-0 object-contain" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{favorite.city} {favorite.name}</span>
                  <button type="button" onClick={() => setPickingTeam(true)} className="shrink-0 text-xs font-bold text-amber-400 hover:underline">
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
            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={subscribe} onChange={(e) => setSubscribe(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400" />
              <span>
                {favorite
                  ? `Email me ${favorite.name} game recaps and the weekly Lindy's Five roundup.`
                  : "Email me the weekly Lindy's Five roundup. (Pick a favorite team to get game recaps too.)"}
                {' '}Unsubscribe anytime.
              </span>
            </label>
          )}

          {mode === 'signup' && (
            <p className="text-xs text-slate-400">We&apos;ll email you a quick link to confirm your address.</p>
          )}

          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}

          <button type="submit" disabled={submitting} className={primaryButton}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'forgot' ? 'Email Me a Reset Link' : 'Create Account'}
          </button>
        </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-400">
          {mode === 'signin' ? "Don't have an account? " : mode === 'forgot' ? 'Remembered it? ' : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setResetSent(null);
              setError(null);
            }}
            className="font-bold text-amber-400 hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
