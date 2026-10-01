'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { confirmEmailLink } from '@/lib/perfectseason/account';

type State =
  | { status: 'working' }
  | { status: 'done'; kind: 'verify' | 'change'; email: string }
  | { status: 'failed'; expired: boolean; message: string };

/** Lands from an emailed confirm link (/account/confirm-email#token=...). */
export default function ConfirmEmail() {
  const [state, setState] = useState<State>({ status: 'working' });
  const ran = useRef(false);

  useEffect(() => {
    // Strict Mode runs effects twice in dev; the token is single use.
    if (ran.current) return;
    ran.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (token) window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setState({ status: 'failed', expired: true, message: 'This page needs the link from your email.' });
      return;
    }
    confirmEmailLink(token).then((result) => {
      if (result.ok) setState({ status: 'done', kind: result.data.kind, email: result.data.email });
      else setState({ status: 'failed', expired: !!result.expired, message: result.error });
    });
  }, []);

  return (
    <main className="mx-auto max-w-[400px] px-4 py-10 sm:py-16">
      <Link href="/" className="mb-6 block text-center text-4xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        Lindy&apos;s Five
      </Link>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
        {state.status === 'working' ? (
          <p className="text-sm text-slate-400">Confirming…</p>
        ) : state.status === 'done' ? (
          <>
            <h1 className="mb-2 text-3xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {state.kind === 'change' ? 'Email Updated' : 'Email Confirmed'}
            </h1>
            <p className="text-sm text-slate-300">
              {state.kind === 'change'
                ? <>Your account now uses <span className="font-semibold text-white">{state.email}</span>. Recaps you get will go there too.</>
                : <><span className="font-semibold text-white">{state.email}</span> is confirmed. Any recaps you asked for will start with the next game.</>}
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-3xl leading-none text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {state.expired ? 'Link Expired' : "Couldn't Confirm"}
            </h1>
            <p className="text-sm text-slate-300">
              {state.expired
                ? `${state.message} Sign in and use "Send confirmation link" on your account page (or start the email change again in Settings) to get a fresh one.`
                : state.message}
            </p>
          </>
        )}
        {state.status !== 'working' && (
          <Link
            href="/account"
            className="mt-4 block w-full rounded-xl bg-amber-400 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-slate-900 transition-opacity hover:opacity-90"
          >
            Go to My Account
          </Link>
        )}
      </div>
    </main>
  );
}
