'use client';

import { useEffect, useState } from 'react';
import { changeEmail, changePassword, setNewsletterSubscribed, deleteAccount } from '@/lib/perfectseason/account';

interface SettingsTabProps {
  email: string | null; // null while the profile is loading
  /** Favorite-team primary color for buttons (falls back to Sabres navy). */
  accent: string;
  onEmailChanged: (email: string) => void;
  onDeleted: () => void;
}

type FormStatus = { state: 'idle' | 'saving' | 'done' | 'error'; message?: string };

const inputClasses =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-sabres-blue';

function StatusLine({ status }: { status: FormStatus }) {
  if (status.state === 'done') return <p className="text-xs font-semibold text-green-600">{status.message}</p>;
  if (status.state === 'error') return <p className="text-xs font-semibold text-red-500">{status.message}</p>;
  return null;
}

export default function SettingsTab({ email, accent, onEmailChanged, onDeleted }: SettingsTabProps) {
  // Email
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailStatus, setEmailStatus] = useState<FormStatus>({ state: 'idle' });

  // Password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<FormStatus>({ state: 'idle' });

  // Newsletter
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [nlStatus, setNlStatus] = useState<FormStatus>({ state: 'idle' });

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteUnsubscribe, setDeleteUnsubscribe] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<FormStatus>({ state: 'idle' });

  useEffect(() => {
    fetch('/api/newsletter/status', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setSubscribed(data?.signedIn ? !!data.subscribed : false))
      .catch(() => setSubscribed(false));
  }, []);

  const submitEmail = async () => {
    if (emailStatus.state === 'saving') return;
    setEmailStatus({ state: 'saving' });
    const result = await changeEmail(emailPassword, newEmail);
    if (result.ok) {
      onEmailChanged(newEmail.trim().toLowerCase());
      setEmailStatus({ state: 'done', message: 'Email updated.' });
      setEmailOpen(false);
      setNewEmail('');
      setEmailPassword('');
    } else {
      setEmailStatus({ state: 'error', message: result.error });
    }
  };

  const submitPassword = async () => {
    if (passwordStatus.state === 'saving') return;
    setPasswordStatus({ state: 'saving' });
    const result = await changePassword(currentPassword, newPassword);
    if (result.ok) {
      setPasswordStatus({ state: 'done', message: 'Password updated.' });
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setPasswordStatus({ state: 'error', message: result.error });
    }
  };

  const toggleNewsletter = async () => {
    if (subscribed == null || nlStatus.state === 'saving') return;
    const next = !subscribed;
    setNlStatus({ state: 'saving' });
    const result = await setNewsletterSubscribed(next);
    if (result.ok) {
      setSubscribed(next);
      setNlStatus({ state: 'done', message: next ? 'Subscribed! Recaps land after every game.' : 'Unsubscribed.' });
      try {
        if (next) localStorage.setItem('newsletter-subscribed', '1');
        else localStorage.removeItem('newsletter-subscribed');
      } catch { /* ignore */ }
    } else {
      setNlStatus({ state: 'error', message: result.error });
    }
  };

  const submitDelete = async () => {
    if (deleteStatus.state === 'saving') return;
    setDeleteStatus({ state: 'saving' });
    const result = await deleteAccount(deletePassword, deleteUnsubscribe);
    if (result.ok) {
      try {
        localStorage.removeItem('newsletter-subscribed');
      } catch { /* ignore */ }
      onDeleted();
    } else {
      setDeleteStatus({ state: 'error', message: result.error });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Email */}
      <section className="rounded-xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Email</h3>
            <p className="truncate text-sm text-gray-500">{email ?? 'Loading…'}</p>
          </div>
          <button
            type="button"
            onClick={() => { setEmailOpen(!emailOpen); setEmailStatus({ state: 'idle' }); }}
            className="flex-shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
          >
            {emailOpen ? 'Cancel' : 'Change'}
          </button>
        </div>
        {emailOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
            <input
              type="email"
              placeholder="New email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className={inputClasses}
            />
            <input
              type="password"
              placeholder="Current password"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              className={inputClasses}
            />
            <button
              type="button"
              onClick={submitEmail}
              disabled={emailStatus.state === 'saving' || !newEmail || !emailPassword}
              className="self-start rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {emailStatus.state === 'saving' ? 'Saving…' : 'Save Email'}
            </button>
          </div>
        )}
        <StatusLine status={emailStatus} />
      </section>

      {/* Password */}
      <section className="rounded-xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Password</h3>
            <p className="text-sm text-gray-500">••••••••</p>
          </div>
          <button
            type="button"
            onClick={() => { setPasswordOpen(!passwordOpen); setPasswordStatus({ state: 'idle' }); }}
            className="flex-shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
          >
            {passwordOpen ? 'Cancel' : 'Change'}
          </button>
        </div>
        {passwordOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className={inputClasses}
            />
            <input
              type="password"
              placeholder="New password (8+ characters)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClasses}
            />
            <button
              type="button"
              onClick={submitPassword}
              disabled={passwordStatus.state === 'saving' || !currentPassword || newPassword.length < 8}
              className="self-start rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {passwordStatus.state === 'saving' ? 'Saving…' : 'Save Password'}
            </button>
          </div>
        )}
        <StatusLine status={passwordStatus} />
      </section>

      {/* Newsletter */}
      <section className="rounded-xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Email Recaps</h3>
            <p className="text-sm text-gray-500">
              {subscribed == null
                ? 'Loading…'
                : subscribed
                  ? 'You get game recaps by email.'
                  : 'Get game recaps in your inbox. Free, unsubscribe anytime.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleNewsletter}
            disabled={subscribed == null || nlStatus.state === 'saving'}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
              subscribed
                ? 'bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200'
                : 'text-white transition-opacity hover:opacity-90'
            }`}
            style={subscribed ? undefined : { backgroundColor: accent }}
          >
            {nlStatus.state === 'saving' ? 'Saving…' : subscribed ? 'Unsubscribe' : 'Subscribe'}
          </button>
        </div>
        <StatusLine status={nlStatus} />
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-red-600">Delete Account</h3>
            <p className="text-sm text-gray-500">Permanently removes your account and all your data.</p>
          </div>
          <button
            type="button"
            onClick={() => { setDeleteOpen(!deleteOpen); setDeleteStatus({ state: 'idle' }); }}
            className="flex-shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            {deleteOpen ? 'Cancel' : 'Delete…'}
          </button>
        </div>
        {deleteOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-red-100 pt-3">
            <p className="text-xs text-gray-600">
              This deletes your saved What-If picks, removes you from every Perfect Season leaderboard, and erases
              your profile. <span className="font-bold">This cannot be undone.</span>
            </p>
            <input
              type="password"
              placeholder="Your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className={inputClasses}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={deleteUnsubscribe}
                onChange={e => setDeleteUnsubscribe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              Also unsubscribe me from email recaps
            </label>
            <button
              type="button"
              onClick={submitDelete}
              disabled={deleteStatus.state === 'saving' || !deletePassword}
              className="self-start rounded-lg bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {deleteStatus.state === 'saving' ? 'Deleting…' : 'Permanently Delete My Account'}
            </button>
          </div>
        )}
        <StatusLine status={deleteStatus} />
      </section>
    </div>
  );
}
