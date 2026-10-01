'use client';

import { useEffect, useState } from 'react';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS, findTeam } from '@/lib/teamConfig';
import type { EmailKind } from '@/lib/types';

interface PrefsView {
  email: string;
  subscribed: boolean;
  unsubscribed: boolean;
  pending: boolean;
  teams: string[];
  prefs: Record<EmailKind, boolean>;
  myTeams: string[];
}

const KINDS: { key: EmailKind; label: string; detail: string }[] = [
  { key: 'gameRecaps', label: 'Game recaps', detail: 'The morning after each game: score, playoff odds and the next game.' },
  { key: 'setRecaps', label: '5-game set recaps', detail: 'How each 5-game set went against the playoff pace.' },
  { key: 'digest', label: 'Weekly roundup', detail: 'Thursdays: the playoff races and your teams in one email.' },
  { key: 'specials', label: 'Special emails', detail: 'Playoff clinch alerts and the holiday gift guide.' },
];

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

/**
 * Every email choice in one place: recaps per team, kinds of email, or none.
 * Signed-in accounts use it in Settings; `id` (from an email's unsubscribe
 * link) uses it on /email-preferences without signing in.
 */
export default function EmailPreferences({ id, accent = '#003087' }: { id?: string; accent?: string }) {
  const [view, setView] = useState<PrefsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // Teams switched off during this visit stay listed, so they can be switched back on.
  const [seen, setSeen] = useState<string[]>([]);
  const [addTeam, setAddTeam] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    fetch(`/api/newsletter/preferences${id ? `?id=${encodeURIComponent(id)}` : ''}`, { credentials: 'include' })
      .then(async res => (res.ok ? setView(await res.json()) : setError("We couldn't find those email preferences.")))
      .catch(() => setError('Network error. Try again in a minute.'));
  }, [id]);

  const update = async (change: Record<string, unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...(id ? { id } : {}), ...change }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Something went wrong');
      else {
        setView(data);
        setSaved(message);
      }
    } catch {
      setError('Network error. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !view) return <p className="text-sm text-red-600">{error}</p>;
  if (!view) return <p className="text-sm text-gray-400">Loading…</p>;

  const teamList = Array.from(new Set([...view.teams, ...view.myTeams, ...seen])).filter(t => findTeam(t));
  const anyOn = view.subscribed && (view.teams.length > 0 || KINDS.some(k => view.prefs[k.key]));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-600">
        Emails go to <span className="font-semibold text-gray-900">{view.email}</span>.
        {view.pending && ' Nothing is sent until you confirm this email (check your inbox for the link).'}
      </p>

      {view.unsubscribed ? (
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-700">You&apos;re unsubscribed from all Lindy&apos;s Five emails.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => update({ resubscribe: true }, 'Welcome back. Your emails are on again.')}
            className="mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            Turn my emails back on
          </button>
        </div>
      ) : (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-gray-900">Teams</legend>
            {teamList.length === 0 ? (
              <p className="mb-2 text-sm text-gray-500">No teams yet. Add one to get its game recaps.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {teamList.map(slug => (
                  <label key={slug} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={view.teams.includes(slug)}
                      disabled={busy}
                      onChange={e => {
                        setSeen(prev => (prev.includes(slug) ? prev : [...prev, slug]));
                        update({ team: { slug, on: e.target.checked } }, e.target.checked ? `${teamLabel(slug)} added.` : `${teamLabel(slug)} removed.`);
                      }}
                      className="h-5 w-5 rounded border-gray-300"
                      style={{ accentColor: accent }}
                    />
                    <span className="text-sm text-gray-800">{teamLabel(slug)}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <label htmlFor={`email-add-team${id ? '-link' : ''}`} className="sr-only">Add a team</label>
              <select
                id={`email-add-team${id ? '-link' : ''}`}
                value={addTeam}
                onChange={e => setAddTeam(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-sabres-blue"
              >
                <option value="">Add a team…</option>
                {TEAM_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.filter(t => !teamList.includes(t.slug)).map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                disabled={!addTeam || busy}
                onClick={() => {
                  const slug = addTeam;
                  setAddTeam('');
                  setSeen(prev => [...prev, slug]);
                  update({ team: { slug, on: true } }, `${teamLabel(slug)} added.`);
                }}
                className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                Add
              </button>
            </div>
          </fieldset>

          <fieldset disabled={!view.subscribed}>
            <legend className="mb-2 text-sm font-bold text-gray-900">Kinds of email</legend>
            {!view.subscribed && <p className="mb-2 text-xs text-gray-500">Add a team above to start getting emails, then choose which kinds here.</p>}
            <div className="flex flex-col gap-1.5">
              {KINDS.map(k => (
                <label key={k.key} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={view.subscribed && view.prefs[k.key]}
                    disabled={busy || !view.subscribed}
                    onChange={e => update({ prefs: { [k.key]: e.target.checked } }, `${k.label} ${e.target.checked ? 'on' : 'off'}.`)}
                    className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300"
                    style={{ accentColor: accent }}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">{k.label}</span>
                    <span className="block text-xs text-gray-500">{k.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {anyOn && (
            <div className="border-t border-gray-100 pt-4">
              {confirmAll ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-700">Stop every Lindy&apos;s Five email?</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => update({ unsubscribeAll: true }, "You're unsubscribed from everything.").then(() => setConfirmAll(false))}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    Yes, unsubscribe
                  </button>
                  <button type="button" onClick={() => setConfirmAll(false)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmAll(true)} className="text-sm font-semibold text-gray-500 underline hover:text-gray-700">
                  Unsubscribe from all emails
                </button>
              )}
            </div>
          )}
        </>
      )}

      {(saved || error) && (
        <p role="status" className={`text-sm font-semibold ${error ? 'text-red-600' : 'text-green-700'}`}>{error ?? saved}</p>
      )}
    </div>
  );
}
