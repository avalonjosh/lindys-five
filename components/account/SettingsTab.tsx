'use client';

import { useState } from 'react';
import { changeEmail, changePassword, deleteAccount } from '@/lib/perfectseason/account';
import EmailPreferences from '@/components/newsletter/EmailPreferences';

interface SettingsTabProps {
  /** False for a Google account that never set a password. */
  hasPassword: boolean;
  onPasswordSet: () => void;
  username: string;
  onUsernameChanged: (username: string) => void;
  email: string | null; // null while the profile is loading
  emailVerified: boolean;
  /** New address waiting on its confirm link. */
  pendingEmail?: string;
  onEmailChangeRequested: (pendingEmail: string) => void;
  onDeleted: () => void;
}

type FormStatus = { state: 'idle' | 'saving' | 'done' | 'error'; message?: string };

const inputClasses =
  'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400';
const cardClasses = 'rounded-2xl border border-slate-700 bg-slate-800/60 p-4';
const secondaryButton = 'flex-shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-100 transition-colors hover:bg-slate-600';
const primaryButton = 'self-start rounded-lg bg-amber-400 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-50';

function StatusLine({ status }: { status: FormStatus }) {
  if (status.state === 'done') return <p className="mt-2 text-xs font-semibold text-emerald-300">{status.message}</p>;
  if (status.state === 'error') return <p className="mt-2 text-xs font-semibold text-red-300">{status.message}</p>;
  return null;
}

export default function SettingsTab({ hasPassword, onPasswordSet, username, onUsernameChanged, email, emailVerified, pendingEmail, onEmailChangeRequested, onDeleted }: SettingsTabProps) {
  // Username
  const [nameOpen, setNameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameStatus, setNameStatus] = useState<FormStatus>({ state: 'idle' });

  const submitName = async () => {
    if (nameStatus.state === 'saving') return;
    setNameStatus({ state: 'saving' });
    try {
      const res = await fetch('/api/account/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newName }),
      });
      const data = await res.json();
      if (!res.ok) return setNameStatus({ state: 'error', message: data.error || 'Something went wrong' });
      onUsernameChanged(data.user.username);
      setNameStatus({ state: 'done', message: 'Username updated, including on your leaderboard entries.' });
      setNameOpen(false);
      setNewName('');
    } catch {
      setNameStatus({ state: 'error', message: 'Network error' });
    }
  };

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

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteUnsubscribe, setDeleteUnsubscribe] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<FormStatus>({ state: 'idle' });

  const submitEmail = async () => {
    if (emailStatus.state === 'saving') return;
    setEmailStatus({ state: 'saving' });
    const result = await changeEmail(emailPassword, newEmail);
    if (result.ok) {
      onEmailChangeRequested(result.data.pendingEmail);
      setEmailStatus({ state: 'done', message: `Check ${result.data.pendingEmail} for a link to finish the change. Your email stays the same until you click it.` });
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
      setPasswordStatus({ state: 'done', message: hasPassword ? 'Password updated.' : 'Password set. You can now also sign in with your email.' });
      onPasswordSet();
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setPasswordStatus({ state: 'error', message: result.error });
    }
  };

  const submitDelete = async () => {
    if (deleteStatus.state === 'saving') return;
    setDeleteStatus({ state: 'saving' });
    const result = hasPassword
      ? await deleteAccount(deletePassword, deleteUnsubscribe)
      : await deleteAccount('', deleteUnsubscribe, deletePassword.trim());
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
    <div className="grid gap-4 md:grid-cols-2">
      {/* Username */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Username</h3>
            <p className="truncate text-sm text-slate-300">{username}</p>
          </div>
          <button
            type="button"
            onClick={() => { setNameOpen(!nameOpen); setNameStatus({ state: 'idle' }); }}
            className={secondaryButton}
          >
            {nameOpen ? 'Cancel' : 'Change'}
          </button>
        </div>
        {nameOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
            <label htmlFor="new-username" className="sr-only">New username</label>
            <input
              id="new-username"
              placeholder="New username"
              value={newName}
              maxLength={20}
              autoComplete="username"
              onChange={e => setNewName(e.target.value)}
              className={inputClasses}
            />
            <p className="text-xs text-slate-300">3 to 20 letters, numbers or underscores. Shown on leaderboards and your cards. You can change it once every 30 days.</p>
            <button
              type="button"
              onClick={submitName}
              disabled={nameStatus.state === 'saving' || newName.trim().length < 3}
              className={primaryButton}
            >
              {nameStatus.state === 'saving' ? 'Saving…' : 'Save Username'}
            </button>
          </div>
        )}
        <StatusLine status={nameStatus} />
      </section>

      {/* Email */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">
              Email
              {email && !emailVerified && (
                <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-300">Not confirmed</span>
              )}
            </h3>
            <p className="truncate text-sm text-slate-300">{email ?? 'Loading…'}</p>
            {pendingEmail && <p className="truncate text-xs text-slate-400">Changing to {pendingEmail} (waiting for confirmation)</p>}
          </div>
          {hasPassword && (
          <button
            type="button"
            onClick={() => { setEmailOpen(!emailOpen); setEmailStatus({ state: 'idle' }); }}
            className={secondaryButton}
          >
            {emailOpen ? 'Cancel' : 'Change'}
          </button>
          )}
        </div>
        {!hasPassword && <p className="mt-1 text-xs text-slate-300">From your Google account. Set a password below to use a different email.</p>}
        {emailOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
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
              className={primaryButton}
            >
              {emailStatus.state === 'saving' ? 'Saving…' : 'Save Email'}
            </button>
          </div>
        )}
        <StatusLine status={emailStatus} />
      </section>

      {/* Password */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Password</h3>
            <p className="text-sm text-slate-300">{hasPassword ? '••••••••' : 'None yet: you sign in with Google'}</p>
          </div>
          <button
            type="button"
            onClick={() => { setPasswordOpen(!passwordOpen); setPasswordStatus({ state: 'idle' }); }}
            className={secondaryButton}
          >
            {passwordOpen ? 'Cancel' : hasPassword ? 'Change' : 'Set password'}
          </button>
        </div>
        {passwordOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-700 pt-3">
            <input
              type="password"
              placeholder="Current password"
              hidden={!hasPassword}
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
              disabled={passwordStatus.state === 'saving' || (hasPassword && !currentPassword) || newPassword.length < 8}
              className={primaryButton}
            >
              {passwordStatus.state === 'saving' ? 'Saving…' : 'Save Password'}
            </button>
          </div>
        )}
        <StatusLine status={passwordStatus} />
      </section>

      {/* Emails: teams, kinds of email, or none */}
      <section className={`${cardClasses} md:col-span-2`}>
        <h3 className="mb-2 text-sm font-bold text-white">Emails</h3>
        <EmailPreferences />
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-red-300">Delete Account</h3>
            <p className="text-sm text-slate-300">Permanently removes your account and all your data.</p>
          </div>
          <button
            type="button"
            onClick={() => { setDeleteOpen(!deleteOpen); setDeleteStatus({ state: 'idle' }); }}
            className="flex-shrink-0 rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10"
          >
            {deleteOpen ? 'Cancel' : 'Delete…'}
          </button>
        </div>
        {deleteOpen && (
          <div className="mt-3 flex flex-col gap-2 border-t border-red-500/30 pt-3">
            <p className="text-xs text-slate-300">
              This deletes your saved What-If picks, removes you from every Perfect Season leaderboard, and erases
              your profile. <span className="font-bold">This cannot be undone.</span>
            </p>
            <input
              type={hasPassword ? 'password' : 'text'}
              placeholder={hasPassword ? 'Your password' : 'Type DELETE to confirm'}
              aria-label={hasPassword ? 'Your password' : 'Type DELETE to confirm'}
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              className={inputClasses}
            />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={deleteUnsubscribe}
                onChange={e => setDeleteUnsubscribe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-500"
                style={{ accentColor: '#FBBF24' }}
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
