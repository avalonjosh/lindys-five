'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Check, X, Minus, Pencil } from 'lucide-react';
import { useCurrentUser } from '@/components/perfectseason/useCurrentUser';
import AuthModal from '@/components/perfectseason/board/AuthModal';
import { logout } from '@/lib/perfectseason/account';
import { fetchWhatIfSaves } from '@/lib/whatif/client';
import { fetchSabresSchedule } from '@/lib/services/nhlApi';
import { fetchMLBSchedule } from '@/lib/services/mlbApi';
import { fetchNFLSchedule } from '@/lib/services/nflApi';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS, findTeam, getTeamUrl } from '@/lib/teamConfig';
import { formatSeasonLabel } from '@/lib/utils/season';
import PicksChart from './PicksChart';
import SettingsTab from './SettingsTab';
import FavoriteTeamCard from './FavoriteTeamCard';
import { normalizePickDate, type WhatIfSave, type WhatIfPick } from '@/lib/whatif/types';
import type { GameResult } from '@/lib/types';
import type { ProfileResponse, ProfileBoard } from '@/app/api/account/profile/route';

type ActualOutcome = 'W' | 'OTL' | 'L';

interface TeamGroup {
  key: string; // `${sport}:${teamId}:${season}`
  sport: string;
  teamId: string;
  season: string;
  saves: WhatIfSave[]; // oldest first
}

interface PickGrade {
  pick: WhatIfPick;
  actual: ActualOutcome | null; // null = game not final yet
  exact: boolean;
  simpleRight: boolean; // win-vs-loss only (OTL counts as a loss)
  /** Backdated save + game already played at entry time: shown, never graded. */
  excluded: boolean;
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

/** Value of an outcome in the save's sport: NHL standings points, MLB/NFL wins. */
const pts = (o: ActualOutcome, sport: string) =>
  sport === 'nhl' ? (o === 'W' ? 2 : o === 'OTL' ? 1 : 0) : o === 'W' ? 1 : 0;

function gradeSave(save: WhatIfSave, actuals: Map<number, ActualOutcome>): SaveGrade {
  // Backdated saves can't take credit for games that were already final when
  // the save was actually entered (savedAt), only for what was still upcoming.
  const enteredDate = save.backdated
    ? new Date(save.savedAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    : null;
  const picks: PickGrade[] = save.picks.map(pick => {
    const actual = actuals.get(pick.gameId) ?? null;
    const exact = actual != null && actual === pick.outcome;
    const simpleRight = actual != null && (pick.outcome === 'W') === (actual === 'W');
    const excluded = enteredDate != null && normalizePickDate(pick.date) < enteredDate;
    return { pick, actual, exact, simpleRight, excluded };
  });
  const graded = picks.filter(p => p.actual != null && !p.excluded);
  return {
    graded: graded.length,
    exact: graded.filter(p => p.exact).length,
    simpleRight: graded.filter(p => p.simpleRight).length,
    predictedPoints: graded.reduce((s, p) => s + pts(p.pick.outcome, save.sport), 0),
    earnedPoints: graded.reduce((s, p) => s + pts(p.actual!, save.sport), 0),
    picks,
  };
}

function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Pick dates are YYYY-MM-DD on new saves but MM/DD/YYYY on early NHL ones. */
function pickDateLabel(date: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date);
  return isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** j•••@gmail.com — enough to recognize your own address, nothing more. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}•••@${domain}`;
}

function gradeClasses(grade: string): string {
  switch (grade.charAt(0).toUpperCase()) {
    case 'A': case 'S': return 'bg-green-100 text-green-700';
    case 'B': return 'bg-emerald-50 text-emerald-700';
    case 'C': return 'bg-yellow-100 text-yellow-700';
    case 'D': return 'bg-orange-100 text-orange-700';
    default: return 'bg-red-100 text-red-600';
  }
}

function rankBadge(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-700';
  if (rank === 2) return 'bg-slate-200 text-slate-600';
  if (rank === 3) return 'bg-orange-100 text-orange-800';
  return 'text-gray-900';
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

type AccountTab = 'overview' | 'picks' | 'perfectseason' | 'settings';

const TABS: { id: AccountTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'picks', label: 'My Picks' },
  { id: 'perfectseason', label: 'Perfect Season' },
  { id: 'settings', label: 'Settings' },
];

export default function AccountPage() {
  const { user, loading, setUser } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [saves, setSaves] = useState<WhatIfSave[] | null>(null);
  const [actualsByTeam, setActualsByTeam] = useState<Map<string, Map<number, ActualOutcome>>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null); // `${group.key}:${savedDate}`
  const [editingFavorite, setEditingFavorite] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [tab, setTab] = useState<AccountTab>('overview');

  const changeFavorite = async (slug: string) => {
    if (!user || savingFavorite) return;
    setSavingFavorite(true);
    const previous = user.favoriteTeam;
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteTeam: slug || null }),
        credentials: 'include',
      });
      if (res.ok) {
        setUser({ ...user, favoriteTeam: slug || undefined });
        // Keep the hamburger/home-grid favorites in step: this is a switch, so
        // the old favorite is replaced in the list, not accumulated.
        try {
          const saved = JSON.parse(localStorage.getItem('favorite-teams') ?? '[]');
          const list: string[] = Array.isArray(saved) ? saved : [];
          const withoutOld = previous ? list.filter(t => t !== previous) : list;
          const next = slug ? [slug, ...withoutOld.filter(t => t !== slug)] : withoutOld;
          localStorage.setItem('favorite-teams', JSON.stringify(next));
        } catch {
          if (slug) localStorage.setItem('favorite-teams', JSON.stringify([slug]));
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
      if (!map.has(key)) map.set(key, { key, sport: save.sport, teamId: save.teamId, season: save.season, saves: [] });
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

  // Overall exact-pick accuracy across every graded save, for the stat tiles.
  const overall = useMemo(() => {
    let graded = 0;
    let exact = 0;
    for (const group of groups) {
      const actuals = actualsByTeam.get(group.key);
      if (!actuals) continue;
      for (const save of group.saves) {
        const g = gradeSave(save, actuals);
        graded += g.graded;
        exact += g.exact;
      }
    }
    return { graded, exact };
  }, [groups, actualsByTeam]);

  // Most recent save across every team, for the Overview summary card.
  const latestSave = useMemo(
    () => (saves && saves.length ? saves.reduce((a, b) => (b.savedAt > a.savedAt ? b : a)) : null),
    [saves]
  );

  // Merged event feed for the Overview activity strip: What-If saves + daily plays.
  const activity = useMemo(() => {
    const items: { key: string; date: string; label: string; kind: 'save' | 'daily'; href: string }[] = [];
    for (const save of saves ?? []) {
      const team = findTeam(save.teamId);
      items.push({
        key: `save:${save.sport}:${save.teamId}:${save.savedDate}`,
        date: save.savedDate,
        label: `Saved ${team ? `${team.city} ${team.name}` : save.teamId} picks`,
        kind: 'save',
        href: getTeamUrl(save.teamId),
      });
    }
    for (const play of profile?.perfectSeason.recentDaily ?? []) {
      items.push({
        key: `daily:${play.sport}:${play.date}`,
        date: play.date,
        label: `Played the ${play.sport === 'mlb' ? '162-0' : '82-0'} daily puzzle`,
        kind: 'daily',
        href: play.sport === 'mlb' ? '/162-0' : '/82-0',
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [saves, profile]);

  // One schedule fetch per team group, to grade picks against real results.
  useEffect(() => {
    for (const group of groups) {
      if (actualsByTeam.has(group.key)) continue;
      if (group.sport === 'mlb') {
        const team = MLB_TEAMS[group.teamId];
        if (!team) continue;
        fetchMLBSchedule(team.mlbId, Number(group.season)).then(schedule => {
          const actuals = new Map<number, ActualOutcome>();
          for (const game of schedule) {
            if (game.gameId != null && game.outcome !== 'PENDING') actuals.set(game.gameId, game.outcome);
          }
          setActualsByTeam(prev => new Map(prev).set(group.key, actuals));
        });
        continue;
      }
      if (group.sport === 'nfl') {
        const team = NFL_TEAMS[group.teamId];
        if (!team) continue;
        fetchNFLSchedule(team.abbreviation, Number(group.season)).then(({ games }) => {
          const actuals = new Map<number, ActualOutcome>();
          for (const game of games) {
            if (game.outcome !== 'PENDING') actuals.set(game.gameId, game.outcome);
          }
          setActualsByTeam(prev => new Map(prev).set(group.key, actuals));
        });
        continue;
      }
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

  const favTeam = user.favoriteTeam ? findTeam(user.favoriteTeam) : undefined;
  const heroColor = favTeam?.colors.primary ?? '#003087';
  // Tracker header trims: secondary drives the bottom border, and the username
  // line uses the same name-color logic as the tracker team-name line.
  const heroSecondary = favTeam?.colors.secondary ?? '#FFB81C';
  const nameColor = favTeam
    ? favTeam.colors.accent !== favTeam.colors.primary
      ? favTeam.colors.accent
      : favTeam.colors.secondary !== '#FFFFFF'
        ? favTeam.colors.secondary
        : '#FFFFFF'
    : '#FFB81C';
  const bestRank = profile?.perfectSeason.boards.reduce<number | null>(
    (best, b) => (b.rank != null && (best == null || b.rank < best) ? b.rank : best),
    null
  ) ?? null;

  return (
    <div>
      {/* Header — the team tracker header, wearing the user's identity */}
      <header className="border-b-4 shadow-xl" style={{ background: heroColor, borderBottomColor: heroSecondary }}>
        <div className="mx-auto max-w-7xl px-4 py-3 md:py-4">
          <div className="relative flex flex-col items-center text-center">
            {/* Sign Out — corner control, like the tracker's toggle slot */}
            <div className="absolute right-0 top-0">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setUser(null);
                }}
                className="rounded-lg border border-white/30 px-2.5 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 md:px-3 md:py-1.5"
              >
                Sign Out
              </button>
            </div>

            <p
              className="mb-2 text-4xl font-bold tracking-wider text-white md:text-6xl"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </p>
            <h1 className="mb-1 px-2 text-lg font-semibold leading-tight md:text-2xl" style={{ color: nameColor }}>
              {user.username}
            </h1>
            <p className="px-2 text-xs leading-tight text-white opacity-90 md:text-base">
              {profile ? (
                <>
                  {maskEmail(profile.email)}
                  {' · '}Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </>
              ) : (
                'Your profile'
              )}
            </p>
            <div className="mt-2">
                {editingFavorite ? (
                  <select
                    autoFocus
                    disabled={savingFavorite}
                    value={user.favoriteTeam ?? ''}
                    onChange={(e) => changeFavorite(e.target.value)}
                    onBlur={() => setEditingFavorite(false)}
                    className="rounded-lg border-2 border-white/30 bg-white px-2 py-1.5 text-sm text-gray-800 outline-none"
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
                ) : favTeam ? (
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={getTeamUrl(user.favoriteTeam!)}
                      title={`Go to the ${favTeam.city} ${favTeam.name} tracker`}
                      className="flex items-center gap-1.5 rounded-full bg-white/15 py-1 pl-1.5 pr-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={favTeam.logo} alt="" className="h-4 w-4 object-contain" />
                      {favTeam.city} {favTeam.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingFavorite(true)}
                      title="Change favorite team"
                      aria-label="Change favorite team"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white/70 transition-colors hover:bg-white/25 hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingFavorite(true)}
                    className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/25"
                  >
                    Set your favorite team
                  </button>
                )}
            </div>
          </div>
        </div>
      </header>

      {/* Section tabs — sticky white sub-nav under the banner, team-color underline */}
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl px-4">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 border-b-2 px-1 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors sm:text-sm ${
                tab === t.id ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={tab === t.id ? { color: heroColor, borderColor: heroColor } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-6">
      {tab === 'settings' && (
        <SettingsTab
          email={profile?.email ?? null}
          accent={heroColor}
          onEmailChanged={(email) => setProfile(prev => (prev ? { ...prev, email } : prev))}
          onDeleted={() => setUser(null)}
        />
      )}

      {tab === 'overview' && (
        <>
      {/* Stat tiles — tracker StatCard vocabulary (gradient, team-color labels) */}
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2 md:p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: heroColor }}>Saved Picks</div>
          <div className="text-2xl font-bold text-gray-900 md:text-3xl">{saves?.length ?? '—'}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2 md:p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: heroColor }}>Exact Accuracy</div>
          <div className="text-2xl font-bold text-gray-900 md:text-3xl">
            {overall.graded > 0 ? `${Math.round((overall.exact / overall.graded) * 100)}%` : '—'}
          </div>
          {overall.graded > 0 && (
            <div className="mt-1 text-xs text-gray-600">{overall.exact}/{overall.graded} graded</div>
          )}
        </div>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2 md:p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: heroColor }}>Best Rank</div>
          <div className="text-2xl font-bold text-gray-900 md:text-3xl">{bestRank != null ? `#${bestRank}` : '—'}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-2 md:p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: heroColor }}>Daily Puzzles</div>
          <div className="text-2xl font-bold text-gray-900 md:text-3xl">{profile?.perfectSeason.daily.count ?? '—'}</div>
        </div>
      </div>

      {/* Today's puzzles — the daily hook */}
      <section className="mb-4 rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: heroColor, fontFamily: 'Bebas Neue, sans-serif' }}>Today&apos;s Daily Puzzles</h3>
          {(profile?.perfectSeason.daily.streak.current ?? 0) >= 2 && (
            <span className="flex-shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">
              🔥 {profile!.perfectSeason.daily.streak.current}-day streak
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { label: '82-0', sport: 'NHL', href: '/82-0', played: profile?.perfectSeason.daily.playedToday.nhl ?? false },
            { label: '162-0', sport: 'MLB', href: '/162-0', played: profile?.perfectSeason.daily.playedToday.mlb ?? false },
          ] as const).map(p => (
            <div key={p.label} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              <div>
                <div className="text-sm font-bold text-gray-900">{p.label}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{p.sport}</div>
              </div>
              {p.played ? (
                <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                  <Check className="h-3.5 w-3.5" /> Played
                </span>
              ) : (
                <Link href={p.href} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: heroColor }}>
                  Play
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Favorite team snapshot — record, odds, next game */}
      {user.favoriteTeam && <FavoriteTeamCard teamSlug={user.favoriteTeam} />}

      {/* Summary cards — less than the tabs show, so "View all" has a reason to exist */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {/* Perfect Season summary */}
        <section className="rounded-xl bg-white p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: heroColor, fontFamily: 'Bebas Neue, sans-serif' }}>Perfect Season</h3>
            <button type="button" onClick={() => setTab('perfectseason')} className="text-xs font-bold hover:underline" style={{ color: heroColor }}>
              View all →
            </button>
          </div>
          {profile == null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : profile.perfectSeason.boards.length === 0 && profile.perfectSeason.daily.count === 0 ? (
            <p className="text-sm text-gray-500">
              No games played yet. Try today&apos;s puzzle at{' '}
              <Link href="/82-0" className="font-bold hover:underline" style={{ color: heroColor }}>82-0</Link>.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {profile.perfectSeason.boards.slice(0, 3).map(b => (
                  <li key={b.board} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700">{boardLabel(b)}</span>
                    <span className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${gradeClasses(b.grade)}`}>{b.grade}</span>
                    {b.rank != null && (
                      <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold ${rankBadge(b.rank)}`}>#{b.rank}</span>
                    )}
                  </li>
                ))}
              </ul>
              {profile.perfectSeason.daily.count > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {profile.perfectSeason.daily.count} daily puzzle{profile.perfectSeason.daily.count === 1 ? '' : 's'} played
                  {profile.perfectSeason.daily.bestRating != null && (
                    <> · best {profile.perfectSeason.daily.bestRating.toFixed(1)}</>
                  )}
                </p>
              )}
            </>
          )}
        </section>

        {/* My Picks summary */}
        <section className="rounded-xl bg-white p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: heroColor, fontFamily: 'Bebas Neue, sans-serif' }}>My Picks</h3>
            <button type="button" onClick={() => setTab('picks')} className="text-xs font-bold hover:underline" style={{ color: heroColor }}>
              View all →
            </button>
          </div>
          {saves == null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : latestSave == null ? (
            <p className="text-sm text-gray-500">
              No saved picks yet. Turn on What If mode on any{' '}
              <Link href="/nhl" className="font-bold hover:underline" style={{ color: heroColor }}>team page</Link> and hit Save Picks.
            </p>
          ) : (
            <>
              {(() => {
                const team = findTeam(latestSave.teamId);
                return (
                  <div className="flex items-center gap-2.5">
                    {team && <Image src={team.logo} alt="" width={32} height={32} className="h-8 w-8 flex-shrink-0" unoptimized />}
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-gray-900">
                        {team ? `${team.city} ${team.name}` : latestSave.teamId} · {longDate(latestSave.savedDate)}
                        {latestSave.label && <span className="font-semibold text-gray-500"> · “{latestSave.label}”</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {latestSave.summary.gamesPicked} picked ({latestSave.summary.record}){latestSave.sport !== 'nfl' && ` · ${latestSave.summary.playoffOdds.toFixed(1)}% odds`}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <p className="mt-2 text-xs text-gray-500">
                {overall.graded > 0 ? (
                  <>Exact accuracy <span className="font-bold text-gray-700">{Math.round((overall.exact / overall.graded) * 100)}%</span> · {overall.exact}/{overall.graded} graded</>
                ) : (
                  'Grading starts once games are played.'
                )}
              </p>
            </>
          )}
        </section>
      </div>

      {/* Recent activity — merged saves + daily plays, newest first */}
      {activity.length > 0 && (
        <section className="mb-8 rounded-xl bg-white p-4 shadow-lg">
          <h3 className="mb-1 text-base font-bold uppercase tracking-wide" style={{ color: heroColor, fontFamily: 'Bebas Neue, sans-serif' }}>Recent Activity</h3>
          <ul className="divide-y divide-gray-100">
            {activity.map(item => (
              <li key={item.key}>
                <Link href={item.href} className="flex items-center gap-3 py-2 text-sm transition-colors hover:bg-gray-50">
                  <span className="w-14 flex-shrink-0 text-xs text-gray-400">{pickDateLabel(item.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-700">{item.label}</span>
                  <span
                    className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.kind === 'save' ? '' : 'bg-gray-100 text-gray-500'}`}
                    style={item.kind === 'save' ? { backgroundColor: `${heroColor}14`, color: heroColor } : undefined}
                  >
                    {item.kind === 'save' ? 'Picks' : 'Daily'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
        </>
      )}

      {tab === 'perfectseason' && (
        <>
      {/* Perfect Season — leaderboard bests from 82-0 / 162-0 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold uppercase tracking-wide md:text-xl" style={{ color: heroColor, fontFamily: 'Bebas Neue, sans-serif' }}>Perfect Season</h2>
        <div className="flex gap-2 text-xs font-bold">
          <Link href="/82-0" className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-gray-700 transition-colors hover:bg-gray-200">82-0</Link>
          <Link href="/162-0" className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-gray-700 transition-colors hover:bg-gray-200">162-0</Link>
        </div>
      </div>
      <section className="mb-8 overflow-hidden rounded-xl bg-white shadow-lg">
        {profile == null ? (
          <div className="p-4 text-sm text-gray-400">Loading…</div>
        ) : profile.perfectSeason.boards.length === 0 && profile.perfectSeason.daily.count === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            No games played yet. Try the daily puzzle at{' '}
            <Link href="/82-0" className="font-bold hover:underline" style={{ color: heroColor }}>82-0</Link> (NHL) or{' '}
            <Link href="/162-0" className="font-bold hover:underline" style={{ color: heroColor }}>162-0</Link> (MLB).
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
                  <span className={`flex-shrink-0 rounded-lg px-2 py-1 text-sm font-bold ${gradeClasses(b.grade)}`}>{b.grade}</span>
                  {b.rank != null && (
                    b.rank <= 3 ? (
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-sm font-bold ${rankBadge(b.rank)}`}>#{b.rank}</span>
                    ) : (
                      <span className="w-14 flex-shrink-0 text-right text-sm font-bold text-gray-900">#{b.rank}</span>
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
        </>
      )}

      {tab === 'picks' && (
        <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold uppercase tracking-wide md:text-xl" style={{ color: heroColor, fontFamily: 'Bebas Neue, sans-serif' }}>My Picks</h2>
        <Link href="/nhl" className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200">
          Make Picks
        </Link>
      </div>
      {saves == null ? (
        <div className="py-12 text-center text-gray-400">Loading your picks…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="mb-2 font-semibold text-gray-700">No saved picks yet</p>
          <p className="mb-4 text-sm text-gray-500">
            Turn on What If mode on any team page, simulate some games, and hit Save Picks.
          </p>
          <Link href="/nhl" className="text-sm font-bold hover:underline" style={{ color: heroColor }}>
            Browse NHL teams →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(group => {
            const team =
              group.sport === 'mlb' ? MLB_TEAMS[group.teamId]
              : group.sport === 'nfl' ? NFL_TEAMS[group.teamId]
              : NHL_TEAMS[group.teamId];
            if (!team) return null;
            const actuals = actualsByTeam.get(group.key);
            const groupGrade = actuals
              ? group.saves.reduce(
                  (acc, save) => {
                    const g = gradeSave(save, actuals);
                    return { graded: acc.graded + g.graded, exact: acc.exact + g.exact };
                  },
                  { graded: 0, exact: 0 }
                )
              : null;
            return (
              <section key={group.key} className="overflow-hidden rounded-xl bg-white shadow-lg">
                {/* Team header */}
                <div className="flex items-center gap-3 border-b border-gray-100 p-4" style={{ backgroundColor: `${team.colors.primary}0d` }}>
                  <Image src={team.logo} alt="" width={40} height={40} className="h-10 w-10" unoptimized />
                  <div className="min-w-0 flex-1">
                    <Link href={getTeamUrl(group.teamId)} className="font-bold text-gray-900 hover:underline">
                      {team.city} {team.name}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {group.sport === 'nhl' ? formatSeasonLabel(group.season) : group.season} · {group.saves.length} save{group.saves.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  {groupGrade && groupGrade.graded > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-lg font-bold leading-tight" style={{ color: team.colors.primary }}>
                        {Math.round((groupGrade.exact / groupGrade.graded) * 100)}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">
                        {groupGrade.exact}/{groupGrade.graded} exact
                      </div>
                    </div>
                  )}
                </div>

                {/* Trend charts — one measure per chart (no dual axis) */}
                {group.saves.length >= 2 ? (
                  <div className="grid gap-4 border-b border-gray-100 p-4 sm:grid-cols-2">
                    <PicksChart
                      title={group.sport === 'nhl' ? 'Projected Points by Save' : 'Projected Wins by Save'}
                      data={group.saves.map(s => ({ date: s.savedDate, value: s.summary.projectedPoints }))}
                      color={team.colors.primary}
                    />
                    {group.sport !== 'nfl' && (
                      <PicksChart
                        title="Playoff Odds by Save"
                        data={group.saves.map(s => ({ date: s.savedDate, value: s.summary.playoffOdds }))}
                        color={team.colors.primary}
                        unit="%"
                      />
                    )}
                  </div>
                ) : (
                  <div className="border-b border-gray-100 px-4 py-2.5 text-xs text-gray-500">
                    Save picks again on a future date to start your trend charts.
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
                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                              <span>{longDate(save.savedDate)}</span>
                              {save.label && (
                                <span className="min-w-0 truncate font-semibold text-gray-500">· “{save.label}”</span>
                              )}
                              {save.backdated && (
                                <span
                                  className="flex-shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600"
                                  title="These picks were logged after the fact. Games already played at entry time don't count toward accuracy."
                                >
                                  Entered later
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {save.summary.gamesPicked} games picked ({save.summary.record}) · Proj {save.summary.projectedPoints} {save.sport === 'nhl' ? 'pts' : 'wins'}{save.sport !== 'nfl' && ` · ${save.summary.playoffOdds.toFixed(1)}% odds`}
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
                              // MLB/NFL have no OTL, so "exact" and "win vs loss" are
                              // the same measure — show two tiles instead of three.
                              <div className={`mb-3 grid gap-2 pt-3 text-center ${save.sport !== 'nhl' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                <div className="rounded-lg bg-white p-2">
                                  <div className="text-sm font-bold text-gray-900">{grade.exact}/{grade.graded}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-gray-400">{save.sport !== 'nhl' ? 'Correct (W/L)' : 'Exact (W/OTL/L)'}</div>
                                </div>
                                {save.sport === 'nhl' && (
                                  <div className="rounded-lg bg-white p-2">
                                    <div className="text-sm font-bold text-gray-900">{grade.simpleRight}/{grade.graded}</div>
                                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Win vs Loss</div>
                                  </div>
                                )}
                                <div className="rounded-lg bg-white p-2">
                                  <div className="text-sm font-bold text-gray-900">{grade.earnedPoints}/{grade.predictedPoints}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-gray-400">{save.sport !== 'nhl' ? 'Wins Earned vs Picked' : 'Pts Earned vs Picked'}</div>
                                </div>
                              </div>
                            )}
                            <ul className="flex flex-col gap-1 pt-1">
                              {(grade?.picks ?? save.picks.map(pick => ({ pick, actual: null as ActualOutcome | null, exact: false, simpleRight: false, excluded: false }))).map(({ pick, actual, exact, excluded }) => (
                                <li key={pick.gameId} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs">
                                  <span className="w-14 flex-shrink-0 text-gray-400">{pick.week ? `Wk ${pick.week}` : pickDateLabel(pick.date)}</span>
                                  <span className="min-w-0 flex-1 truncate font-semibold text-gray-700">
                                    {pick.isHome ? 'vs' : '@'} {pick.opponentAbbrev}
                                  </span>
                                  <span className="flex-shrink-0 font-bold text-gray-900">Picked {pick.outcome}</span>
                                  {excluded && actual != null ? (
                                    <span
                                      className="flex w-16 flex-shrink-0 items-center justify-end gap-1 text-gray-400"
                                      title="Already played when these picks were entered — not graded"
                                    >
                                      <Minus className="h-3.5 w-3.5" /> {actual}
                                    </span>
                                  ) : actual == null ? (
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
        </>
      )}
      </main>
    </div>
  );
}
