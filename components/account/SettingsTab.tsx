'use client';

import { useEffect, useState } from 'react';
import { changeEmail, changePassword, setNewsletterSubscribed, deleteAccount } from '@/lib/perfectseason/account';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS, findTeam } from '@/lib/teamConfig';

const teamOptions = (teams: Record<string, { city: string; name: string }>) =>
  Object.entries(teams)
    .map(([slug, t]) => ({ slug, label: `${t.city} ${t.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

const TEAM_GROUPS = [
  { label: 'NHL', options: teamOptions(NHL_TEAMS) },
  { label: 'MLB', options: teamOptions(MLB_TEAMS) },
  { label: 'NFL', options: teamOptions(NFL_TEAMS) },
];

const teamLabel = (slug: string) => {
  const t = findTeam(slug);
  return t ? `${t.city} ${t.name}` : slug;
};

/** "Sabres", "Sabres and Bills", "Sabres, Bills and Yankees". */
const listNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

interface SettingsTabProps {
  email: string | null; // null while the profile is loading
  emailVerified: boolean;
  /** New address waiting on its confirm link. */
  pendingEmail?: string;
  /** Account favorite team slug: the default team for recaps. */
  favoriteTeam?: string;
  onEmailChangeRequested: (pendingEmail: string) => void;
  /** Favorite-team primary color for buttons (falls back to Sabres navy). */
  accent: string;
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

export default function SettingsTab({ email, emailVerified, pendingEmail, favoriteTeam, onEmailChangeRequested, accent, onDeleted }: SettingsTabProps) {
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

  // Newsletter: null while loading
  const [nl, setNl] = useState<{ subscribed: boolean; pending: boolean; teams: string[] } | null>(null);
  const [nlStatus, setNlStatus] = useState<FormStatus>({ state: 'idle' });
  const [pickTeam, setPickTeam] = useState('');
  const favorite = favoriteTeam && findTeam(favoriteTeam) ? favoriteTeam : undefined;

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteUnsubscribe, setDeleteUnsubscribe] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<FormStatus>({ state: 'idle' });

  const loadNewsletter = () =>
    fetch('/api/newsletter/status', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setNl({ subscribed: !!data?.subscribed, pending: !!data?.pending, teams: data?.teams ?? [] }))
      .catch(() => setNl({ subscribed: false, pending: false, teams: [] }));

  useEffect(() => {
    loadNewsletter();
  }, []);

  // What they get, in plain words, so the card never promises recaps that won't come.
  const newsletterSummary = !nl
    ? 'Loading…'
    : nl.subscribed
      ? `${nl.teams.length ? `${listNames(nl.teams.map(teamLabel))} game recaps, plus the weekly roundup.` : 'The weekly roundup only. Add a team below to get its game recaps too.'}${nl.pending ? ' Starts once you confirm your email.' : ''}`
      : favorite
        ? `Get ${teamLabel(favorite)} game recaps and the weekly roundup. Free, unsubscribe anytime.`
        : 'Pick a team to get its game recaps, plus the weekly roundup.';

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
      setPasswordStatus({ state: 'done', message: 'Password updated.' });
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setPasswordStatus({ state: 'error', message: result.error });
    }
  };

  const updateNewsletter = async (subscribe: boolean, team?: string) => {
    if (!nl || nlStatus.state === 'saving') return;
    setNlStatus({ state: 'saving' });
    const result = await setNewsletterSubscribed(subscribe, team);
    if (result.ok) {
      setNlStatus({
        state: 'done',
        message: !subscribe ? 'Unsubscribed.' : result.data.pending ? 'Saved. Starts once you confirm your email.' : 'Subscribed!',
      });
      setPickTeam('');
      await loadNewsletter();
      try {
        if (subscribe) localStorage.setItem('newsletter-subscribed', '1');
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
    <div className="grid gap-4 md:grid-cols-2">
      {/* Email */}
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-xl md:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: accent }}>
              Email
              {email && !emailVerified && (
                <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-600">Not confirmed</span>
              )}
            </h3>
            <p className="truncate text-sm text-gray-500">{email ?? 'Loading…'}</p>
            {pendingEmail && <p className="truncate text-xs text-gray-400">Changing to {pendingEmail} (waiting for confirmation)</p>}
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
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-xl md:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold" style={{ color: accent }}>Password</h3>
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
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-xl md:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold" style={{ color: accent }}>Email Recaps</h3>
            <p className="text-sm text-gray-500">{newsletterSummary}</p>
          </div>
          {nl && (nl.subscribed || favorite) && (
            <button
              type="button"
              onClick={() => updateNewsletter(!nl.subscribed)}
              disabled={nlStatus.state === 'saving'}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                nl.subscribed
                  ? 'bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200'
                  : 'text-white transition-opacity hover:opacity-90'
              }`}
              style={nl.subscribed ? undefined : { backgroundColor: accent }}
            >
              {nlStatus.state === 'saving' ? 'Saving…' : nl.subscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>
          )}
        </div>
        {/* No team yet: pick one (subscribing, or adding game recaps to the roundup). */}
        {nl && ((!nl.subscribed && !favorite) || (nl.subscribed && nl.teams.length === 0)) && (
          <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
            <select value={pickTeam} onChange={e => setPickTeam(e.target.value)} className={`${inputClasses} min-w-0 flex-1`}>
              <option value="">Choose a team</option>
              {TEAM_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={() => updateNewsletter(true, pickTeam)}
              disabled={!pickTeam || nlStatus.state === 'saving'}
              className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {nlStatus.state === 'saving' ? 'Saving…' : nl.subscribed ? 'Add' : 'Subscribe'}
            </button>
          </div>
        )}
        <StatusLine status={nlStatus} />
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border-2 border-red-200 bg-white p-3 shadow-xl md:p-4">
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
