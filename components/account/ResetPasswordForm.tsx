'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { confirmPasswordReset, requestPasswordReset } from '@/lib/perfectseason/account';

const inputClass =
  'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-amber-400';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-300';
const buttonClass =
  'mt-1 w-full rounded-xl bg-amber-400 py-3 text-sm font-extrabold uppercase tracking-wide text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-60';

/** Choose a new password from an emailed reset link (/account/reset#token=...). */
export default function ResetPasswordForm() {
  const router = useRouter();
  // undefined = not read yet, null = no token in the link
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendId, setResendId] = useState('');
  const [resent, setResent] = useState<string | null>(null);

  // The token is in the fragment (never sent to the server). Read it once,
  // then drop it from the address bar so it isn't left in history or shared.
  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('token');
    setToken(t);
    if (t) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !token) return;
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError("Those passwords don't match.");
    setSubmitting(true);
    setError(null);
    const result = await confirmPasswordReset(token, password);
    if (result.ok) {
      router.push('/account?updated=password');
      return;
    }
    setSubmitting(false);
    if (/expired|already used/i.test(result.error)) setExpired(true);
    else setError(result.error);
  };

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !resendId.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await requestPasswordReset(resendId.trim());
    setSubmitting(false);
    if (result.ok) setResent(result.message);
    else setError(result.error);
  };

  const showResend = token === null || expired;

  return (
    <main className="mx-auto max-w-[400px] px-4 py-10 sm:py-16">
      <Link href="/" className="mb-6 block text-center text-4xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        Lindy&apos;s Five
      </Link>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        <h1 className="mb-2 text-3xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {showResend ? 'Link Expired' : 'Choose a New Password'}
        </h1>

        {token === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : showResend ? (
          resent ? (
            <p className="mt-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">{resent}</p>
          ) : (
            <form onSubmit={resend} className="flex flex-col gap-3">
              <p className="text-sm text-slate-300">
                {token === null
                  ? "This page needs the link from your reset email. Enter your email or username and we'll send a new one."
                  : "Reset links work once and expire after an hour. Enter your email or username and we'll send a new one."}
              </p>
              <div>
                <label className={labelClass} htmlFor="reset-id">Email or username</label>
                <input id="reset-id" className={inputClass} value={resendId} onChange={(e) => setResendId(e.target.value)} autoComplete="username" />
              </div>
              {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
              <button type="submit" disabled={submitting} className={buttonClass}>
                {submitting ? 'Please wait…' : 'Send a New Link'}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <p className="text-sm text-slate-300">Pick something at least 8 characters long. You&apos;ll be signed in on this device and signed out everywhere else.</p>
            <div>
              <label className={labelClass} htmlFor="reset-password">New password</label>
              <input id="reset-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
            </div>
            <div>
              <label className={labelClass} htmlFor="reset-confirm">Confirm new password</label>
              <input id="reset-confirm" type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
            <button type="submit" disabled={submitting} className={buttonClass}>
              {submitting ? 'Saving…' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
      <p className="mt-4 text-center text-sm">
        <Link href="/account" className="font-bold text-amber-400 hover:underline">Back to sign in</Link>
      </p>
    </main>
  );
}
