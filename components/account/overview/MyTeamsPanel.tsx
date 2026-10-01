'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Plus, Star, X } from 'lucide-react';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS, findTeam, getTeamUrl } from '@/lib/teamConfig';
import { cardColors, logoFor } from '@/components/home/YourTeamCard';
import type { TeamSnapshot } from '@/lib/services/homeTeamSnapshot';
import { SectionTitle } from './ui';

const teamOptions = (teams: Record<string, { city: string; name: string }>) =>
  Object.entries(teams)
    .map(([slug, t]) => ({ slug, label: `${t.city} ${t.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

const TEAM_GROUPS = [
  { label: 'NHL', options: teamOptions(NHL_TEAMS) },
  { label: 'MLB', options: teamOptions(MLB_TEAMS) },
  { label: 'NFL', options: teamOptions(NFL_TEAMS) },
];

function summary(snap: TeamSnapshot | undefined): string {
  if (!snap) return 'Loading…';
  const next = snap.next ? `${snap.next.label === 'Next game' ? 'Next' : snap.next.label}: ${snap.next.text.split(' · ')[0]}` : null;
  return [snap.record, snap.odds != null ? `Odds ${snap.odds}%` : null, next].filter(Boolean).join(' · ') || snap.oddsNote || 'Offseason';
}

/**
 * Every followed team (the menu stars), the first one main. Rows link to the
 * tracker and carry a recap-email switch; Edit reveals make-main and remove.
 */
export default function MyTeamsPanel({
  teams,
  snapshots,
  recaps,
  recapBusy,
  onToggleRecap,
  saving,
  onSaveTeams,
}: {
  teams: string[];
  snapshots: Record<string, TeamSnapshot>;
  recaps: { teams: string[]; pending: boolean } | null;
  recapBusy: string | null;
  onToggleRecap: (team: string, on: boolean) => void;
  saving: boolean;
  onSaveTeams: (teams: string[], main?: string) => Promise<void>;
}) {
  const [addTeam, setAddTeam] = useState('');
  const [editing, setEditing] = useState(false);

  return (
    <section id="my-teams" className="flex scroll-mt-16 flex-col gap-2.5">
      <SectionTitle
        right={
          teams.length > 0 && (
            <button type="button" onClick={() => setEditing(e => !e)} className="text-sm font-bold text-amber-400 hover:text-amber-300">
              {editing ? 'Done' : 'Edit'}
            </button>
          )
        }
      >
        My Teams
      </SectionTitle>

      {teams.length === 0 && (
        <p className="text-sm text-slate-300">
          Add the teams you follow. They&apos;re starred in the menu on every device you sign in on, and you can turn on game recap emails for each one.
        </p>
      )}

      {teams.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {teams.map((slug, i) => {
            const team = findTeam(slug);
            if (!team) return null;
            const isMain = i === 0;
            const recapOn = !!recaps?.teams.includes(slug);
            const name = `${team.city} ${team.name}`;
            return (
              <li key={slug} className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-2.5 sm:gap-3 sm:p-3">
                <Link href={getTeamUrl(slug)} className="group flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-1.5" style={{ background: cardColors(team.colors).bg }}>
                    <img src={logoFor(team)} alt="" className="h-full w-full object-contain" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-extrabold text-white group-hover:underline">{name}</span>
                      {isMain && <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-slate-900">MAIN</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-300">{summary(snapshots[slug])}</span>
                  </span>
                </Link>
                {editing ? (
                  <span className="flex shrink-0 items-center gap-1">
                    {!isMain && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onSaveTeams(teams, slug)}
                        className="flex min-h-9 items-center gap-1 rounded-lg bg-slate-700 px-2.5 text-xs font-bold text-slate-100 transition-colors hover:bg-slate-600 disabled:opacity-50"
                      >
                        <Star className="h-3.5 w-3.5" aria-hidden /> Make main
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        // Unfollowing a team also stops its recap emails.
                        if (recapOn) onToggleRecap(slug, false);
                        await onSaveTeams(teams.filter(t => t !== slug));
                      }}
                      aria-label={`Remove ${name} from My Teams`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-pressed={recapOn}
                    aria-label={`Game recap emails for the ${team.name}: ${recapOn ? 'on' : 'off'}`}
                    title={recapOn ? 'Game recap emails on. Tap to turn off.' : 'Get game recap emails for this team'}
                    disabled={recaps == null || recapBusy === slug}
                    onClick={() => onToggleRecap(slug, !recapOn)}
                    className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      recapOn ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">{recapOn ? 'Recaps on' : 'Recaps off'}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {recaps?.pending && recaps.teams.length > 0 && (
        <p className="text-xs text-amber-300">Recap emails start once you confirm your email.</p>
      )}

      {(editing || teams.length === 0) && (
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor="add-team" className="sr-only">Add a team</label>
          <select
            id="add-team"
            value={addTeam}
            onChange={e => setAddTeam(e.target.value)}
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-white outline-none focus:border-amber-400 sm:flex-none"
          >
            <option value="">Add a team…</option>
            {TEAM_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.options.filter(t => !teams.includes(t.slug)).map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            disabled={!addTeam || saving}
            onClick={async () => {
              const slug = addTeam;
              setAddTeam('');
              await onSaveTeams([...teams, slug], teams.length === 0 ? slug : undefined);
            }}
            className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-amber-400 px-3 text-sm font-extrabold text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        </div>
      )}
      {!editing && teams.length > 0 && (
        <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 self-start text-xs font-bold text-slate-400 hover:text-white">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add a team
        </button>
      )}
    </section>
  );
}
