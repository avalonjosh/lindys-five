'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Check, X, Minus } from 'lucide-react';
import { useCurrentUser } from '@/components/perfectseason/useCurrentUser';
import AuthModal from '@/components/perfectseason/board/AuthModal';
import { logout } from '@/lib/perfectseason/account';
import { fetchWhatIfSaves } from '@/lib/whatif/client';
import { fetchSabresSchedule } from '@/lib/services/nhlApi';
import { NHL_TEAMS, MLB_TEAMS, findTeam } from '@/lib/teamConfig';
import { formatSeasonLabel } from '@/lib/utils/season';
import PicksChart from './PicksChart';
import type { WhatIfSave, WhatIfPick } from '@/lib/whatif/types';
import type { GameResult } from '@/lib/types';
import type { ProfileResponse, ProfileBoard } from '@/app/api/account/profile/route';

type ActualOutcome = 'W' | 'OTL' | 'L';

interface TeamGroup {
  key: string; // `${sport}:${teamId}:${season}`
  teamId: string;
  season: string;
  saves: WhatIfSave[]; // oldest first
}

interface PickGrade {
  pick: WhatIfPick;
  actual: ActualOutcome | null; // null = game not final yet
  exact: boolean;
  simpleRight: boolean; // win-vs-loss only (OTL counts as a loss)
}

interface SaveGrade {
  graded: number;
  exact: number;
  simpleRight: number;
  predictedPoints: number; // points the picks predicted, graded games only
  earnedPoints: number; // points actually earned in those games
  picks: PickGrade[];
}

function outcomeOf(game: GameResult): ActualOutcome | null {
  return game.outcome === 'PENDING' ? null : game.outcome;
}

const pts = (o: ActualOutcome) => (o === 'W' ? 2 : o === 'OTL' ? 1 : 0);

function gradeSave(save: WhatIfSave, actuals: Map<number, ActualOutcome>): SaveGrade {
  const picks: PickGrade[] = save.picks.map(pick => {
    const actual = actuals.get(pick.gameId) ?? null;
    const exact = actual != null && actual === pick.outcome;
    const simpleRight = actual != null && (pick.outcome === 'W') === (actual === 'W');
    return { pick, actual, exact, simpleRight };
  });
  const graded = picks.filter(p => p.actual != null);
  return {
    graded: graded.length,
    exact: graded.filter(p => p.exact).length,
    simpleRight: graded.filter(p => p.simpleRight).length,
    predictedPoints: graded.reduce((s, p) => s + pts(p.pick.outcome), 0),
    earnedPoints: graded.reduce((s, p) => s + pts(p.actual!), 0),
    picks,
  };
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** j•••@gmail.com — enough to recognize your own address, nothing more. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}•••@${domain}`;
}

const BOARD_KIND_LABELS: Record<ProfileBoard['kind'], string> = {
  alltime: 'All-Time Daily Best',
  free: 'Free Play',
  tank: 'Tank Mode',
  franchise: 'Franchise',
};

function boardLabel(b: ProfileBoard): string {
  const kind = BOARD_KIND_LABELS[b.kind] ?? b.kind;
  const franchise = b.franchiseId ? ` · ${b.franchiseId}` : '';
  return `${b.sport.toUpperCase()} ${kind}${franchise}`;
}

const teamOptions = (teams: Record<string, { city: string; name: string }>) =>
  Object.entries(teams)
    .map(([slug, t]) => ({ slug, label: `${t.city} ${t.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

const NHL_OPTIONS = teamOptions(NHL_TEAMS);
const MLB_OPTIONS = teamOptions(MLB_TEAMS);

export default function AccountPage() {
  const { user, loading, setUser } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [saves, setSaves] = useState<WhatIfSave[] | null>(null);
  const [actualsByTeam, setActualsByTeam] = useState<Map<string, Map<number, ActualOutcome>>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null); // `${group.key}:${savedDate}`
  const [editingFavorite, setEditingFavorite] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  const changeFavorite = async (slug: string) => {
    if (!user || savingFavorite) return;
    setSavingFavorite(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteTeam: slug || null }),
        credentials: 'include',
      });
      if (res.ok) {
        setUser({ ...user, favoriteTeam: slug || undefined });
        // Keep the hamburger/home-grid favorites in step.
        if (slug) {
          try {
            const saved = JSON.parse(localStorage.getItem('favorite-teams') ?? '[]');
            const list = Array.isArray(saved) ? saved : [];
            if (!list.includes(slug)) localStorage.setItem('favorite-teams', JSON.stringify([slug, ...list]));
          } catch {
            localStorage.setItem('favorite-teams', JSON.stringify([slug]));
          }
        }
      }
    } finally {
      setSavingFavorite(false);
      setEditingFavorite(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setSaves(null);
      setProfile(null);
      return;
    }
    fetchWhatIfSaves().then(setSaves);
    fetch('/api/account/profile', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user]);

  const groups = useMemo<TeamGroup[]>(() => {
    if (!saves) return [];
    const map = new Map<string, TeamGroup>();
    for (const save of saves) {
      const key = `${save.sport}:${save.teamId}:${save.season}`;
      if (!map.has(key)) map.set(key, { key, teamId: save.teamId, season: save.season, saves: [] });
      map.get(key)!.saves.push(save);
    }
    for (const group of map.values()) {
      group.saves.sort((a, b) => a.savedDate.localeCompare(b.savedDate));
    }
    // Most recently active team first.
    return [...map.values()].sort(
      (a, b) => Math.max(...b.saves.map(s => s.savedAt)) - Math.max(...a.saves.map(s => s.savedAt))
    );
  }, [saves]);

  // One schedule fetch per team group, to grade picks against real results.
  useEffect(() => {
    for (const group of groups) {
      if (actualsByTeam.has(group.key)) continue;
      const team = NHL_TEAMS[group.teamId];
      if (!team) continue;
      fetchSabresSchedule(group.season, team.abbreviation, team.nhlId).then(schedule => {
        const actuals = new Map<number, ActualOutcome>();
        for (const game of schedule) {
          const outcome = outcomeOf(game);
          if (game.gameId != null && outcome) actuals.set(game.gameId, outcome);
        }
        setActualsByTeam(prev => new Map(prev).set(group.key, actuals));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-400">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          My Account
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Sign in to see your saved What-If picks, how they&apos;ve changed over time, and how accurate they turned out.
        </p>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="rounded-xl bg-sabres-blue px-8 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          Sign In / Sign Up
        </button>
        {authOpen && (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            onSuccess={(u) => {
              setUser(u);
              setAuthOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {user.username}
          </h1>
          <p className="text-sm text-gray-500">
            {profile ? (
              <>
                {maskEmail(profile.email)}
                {' · '}Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </>
            ) : (
              'Your profile'
            )}
          </p>
          {/* Favorite team */}
          <div className="mt-2">
            {editingFavorite ? (
              <select
                autoFocus
                disabled={savingFavorite}
                value={user.favoriteTeam ?? ''}
                onChange={(e) => changeFavorite(e.target.value)}
                onBlur={() => setEditingFavorite(false)}
                className="rounded-lg border-2 border-gray-200 bg-gray-50 px-2 py-1.5 text-sm outline-none focus:border-sabres-blue"
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
            ) : user.favoriteTeam && findTeam(user.favoriteTeam) ? (
              <button
                type="button"
                onClick={() => setEditingFavorite(true)}
                title="Change favorite team"
                className="flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-1.5 pr-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={findTeam(user.favoriteTeam)!.logo} alt="" className="h-4 w-4 object-contain" />
                {findTeam(user.favoriteTeam)!.city} {findTeam(user.favoriteTeam)!.name}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditingFavorite(true)}
                className="text-xs font-bold text-sabres-blue hover:underline"
              >
                Set your favorite team
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout();
            setUser(null);
          }}
          className="rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>

      {/* Perfect Season — leaderboard bests from 82-0 / 162-0 */}
      <section className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4">
          <div>
            <h2 className="font-bold text-gray-900">Perfect Season</h2>
            <p className="text-xs text-gray-500">Your best results in 82-0 and 162-0</p>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            <Link href="/82-0" className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-gray-700 transition-colors hover:bg-gray-200">82-0</Link>
            <Link href="/162-0" className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-gray-700 transition-colors hover:bg-gray-200">162-0</Link>
          </div>
        </div>
        {profile == null ? (
          <div className="p-4 text-sm text-gray-400">Loading…</div>
        ) : profile.perfectSeason.boards.length === 0 && profile.perfectSeason.daily.count === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            No games played yet. Try the daily puzzle at{' '}
            <Link href="/82-0" className="font-bold text-sabres-blue hover:underline">82-0</Link> (NHL) or{' '}
            <Link href="/162-0" className="font-bold text-sabres-blue hover:underline">162-0</Link> (MLB).
          </div>
        ) : (
          <div>
            {profile.perfectSeason.daily.count > 0 && (
              <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">
                <span className="font-bold">{profile.perfectSeason.daily.count}</span> daily puzzle{profile.perfectSeason.daily.count === 1 ? '' : 's'} played
                {profile.perfectSeason.daily.bestRating != null && (
                  <> · best rating <span className="font-bold">{profile.perfectSeason.daily.bestRating.toFixed(1)}</span></>
                )}
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {profile.perfectSeason.boards.map(b => (
                <li key={b.board} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900">
                      {boardLabel(b)}
                      {b.variant === 'blind' && (
                        <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-gray-500">Blind</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{b.wins}-{b.losses} · rating {b.rating.toFixed(1)}</div>
                  </div>
                  <span className="flex-shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-sm font-bold text-gray-800">{b.grade}</span>
                  {b.rank != null && (
                    <span className="w-14 flex-shrink-0 text-right text-sm font-bold text-gray-900">#{b.rank}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <h2 className="mb-3 font-bold text-gray-900">My What-If Picks</h2>
      {saves == null ? (
        <div className="py-12 text-center text-gray-400">Loading your picks…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="mb-2 font-semibold text-gray-700">No saved picks yet</p>
          <p className="mb-4 text-sm text-gray-500">
            Turn on What If mode on any team page, simulate some games, and hit Save Picks.
          </p>
          <Link href="/nhl" className="text-sm font-bold text-sabres-blue hover:underline">
            Browse NHL teams →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(group => {
            const team = NHL_TEAMS[group.teamId];
            if (!team) return null;
            const actuals = actualsByTeam.get(group.key);
            return (
              <section key={group.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {/* Team header */}
                <div className="flex items-center gap-3 border-b border-gray-100 p-4" style={{ backgroundColor: `${team.colors.primary}0d` }}>
                  <Image src={team.logo} alt="" width={40} height={40} className="h-10 w-10" unoptimized />
                  <div className="min-w-0 flex-1">
                    <Link href={`/nhl/${team.id}`} className="font-bold text-gray-900 hover:underline">
                      {team.city} {team.name}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {formatSeasonLabel(group.season)} · {group.saves.length} save{group.saves.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>

                {/* Trend charts — one measure per chart (no dual axis) */}
                {group.saves.length >= 1 && (
                  <div className="grid gap-4 border-b border-gray-100 p-4 sm:grid-cols-2">
                    <PicksChart
                      title="Projected Points by Save"
                      data={group.saves.map(s => ({ date: s.savedDate, value: s.summary.projectedPoints }))}
                      color={team.colors.primary}
                    />
                    <PicksChart
                      title="Playoff Odds by Save"
                      data={group.saves.map(s => ({ date: s.savedDate, value: s.summary.playoffOdds }))}
                      color={team.colors.primary}
                      unit="%"
                    />
                  </div>
                )}

                {/* Saves, newest first */}
                <ul className="divide-y divide-gray-100">
                  {[...group.saves].reverse().map(save => {
                    const grade = actuals ? gradeSave(save, actuals) : null;
                    const rowKey = `${group.key}:${save.savedDate}`;
                    const open = expanded === rowKey;
                    return (
                      <li key={save.savedDate}>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : rowKey)}
                          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-gray-900">{longDate(save.savedDate)}</div>
                            <div className="text-xs text-gray-500">
                              {save.summary.gamesPicked} games picked ({save.summary.record}) · Proj {save.summary.projectedPoints} pts · {save.summary.playoffOdds.toFixed(1)}% odds
                            </div>
                          </div>
                          {grade && grade.graded > 0 && (
                            <div className="flex-shrink-0 text-right">
                              <div className="text-sm font-bold text-gray-900">{grade.exact}/{grade.graded}</div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-400">exact</div>
                            </div>
                          )}
                          {grade && grade.graded === 0 && (
                            <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              Pending
                            </span>
                          )}
                          {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />}
                        </button>

                        {open && (
                          <div className="bg-gray-50 px-4 pb-4">
                            {grade && grade.graded > 0 && (
                              <div className="mb-3 grid grid-cols-3 gap-2 pt-3 text-center">
                                <div className="rounded-lg bg-white p-2">
                                  <div className="text-sm font-bold text-gray-900">{grade.exact}/{grade.graded}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Exact (W/OTL/L)</div>
                                </div>
                                <div className="rounded-lg bg-white p-2">
                                  <div className="text-sm font-bold text-gray-900">{grade.simpleRight}/{grade.graded}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Win vs Loss</div>
                                </div>
                                <div className="rounded-lg bg-white p-2">
                                  <div className="text-sm font-bold text-gray-900">{grade.earnedPoints}/{grade.predictedPoints}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Pts Earned vs Picked</div>
                                </div>
                              </div>
                            )}
                            <ul className="flex flex-col gap-1 pt-1">
                              {(grade?.picks ?? save.picks.map(pick => ({ pick, actual: null as ActualOutcome | null, exact: false, simpleRight: false }))).map(({ pick, actual, exact }) => (
                                <li key={pick.gameId} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
                                  <span className="w-14 flex-shrink-0 text-gray-400">{new Date(`${pick.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-700">
                                    {pick.isHome ? 'vs' : '@'} {pick.opponentAbbrev}
                                  </span>
                                  <span className="flex-shrink-0 font-bold text-gray-900">Picked {pick.outcome}</span>
                                  {actual == null ? (
                                    <span className="flex w-16 flex-shrink-0 items-center justify-end gap-1 text-gray-400">
                                      <Minus className="h-3.5 w-3.5" /> TBD
                                    </span>
                                  ) : exact ? (
                                    <span className="flex w-16 flex-shrink-0 items-center justify-end gap-1 font-bold text-green-600">
                                      <Check className="h-3.5 w-3.5" /> {actual}
                                    </span>
                                  ) : (
                                    <span className="flex w-16 flex-shrink-0 items-center justify-end gap-1 font-bold text-red-500">
                                      <X className="h-3.5 w-3.5" /> {actual}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
