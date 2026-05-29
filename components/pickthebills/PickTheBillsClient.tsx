'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Loader2, Trophy, ListChecks, Lock } from 'lucide-react';

const BILLS_BLUE = '#00338D';
const BILLS_RED = '#C60C30';
const PENDING_STASH = 'pickthebills:pendingPicks';

interface Game {
  id: string;
  weekLabel: string;
  opponent: string;
  home: boolean;
  kickoffAt: string;
  status: string;
  result: string | null;
}
interface OpenWindow {
  id: string;
  label: string;
  locksAt: string;
}
interface GamesData {
  season: number | null;
  games: Game[];
  openWindow: OpenWindow | null;
}
interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  correct: number;
  graded: number;
  accuracy: number;
  rank: number | null;
  qualified: boolean;
}
interface Leaderboard {
  season: number | null;
  finalGames: number;
  threshold: number;
  ranked: LeaderboardEntry[];
  unranked: LeaderboardEntry[];
}
interface SessionUser {
  id: string;
  name?: string | null;
}

const ET = { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } as const;
function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', ET) + ' ET';
}

export default function PickTheBillsClient() {
  const [tab, setTab] = useState<'picks' | 'leaderboard'>('picks');
  const [data, setData] = useState<GamesData | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sel, setSel] = useState<Record<string, 'W' | 'L'>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const now = Date.now();
  const pickable = useMemo(
    () => (data?.games ?? []).filter((g) => g.status === 'scheduled' && new Date(g.kickoffAt).getTime() > now),
    [data, now],
  );

  const applyDefaults = useCallback((games: Game[], effective: Record<string, 'W' | 'L'>) => {
    const next: Record<string, 'W' | 'L'> = {};
    for (const g of games) {
      if (g.status === 'scheduled' && new Date(g.kickoffAt).getTime() > Date.now()) {
        next[g.id] = effective[g.id] ?? 'W'; // smart default: Bills win
      }
    }
    setSel(next);
  }, []);

  const load = useCallback(async () => {
    const [gamesRes, boardRes, sessionRes] = await Promise.all([
      fetch('/api/pickthebills/games'),
      fetch('/api/pickthebills/leaderboard'),
      fetch('/api/auth/session'),
    ]);
    const games: GamesData = await gamesRes.json();
    const lb: Leaderboard = await boardRes.json();
    const session = await sessionRes.json();
    const sessionUser: SessionUser | null = session?.user?.id ? session.user : null;
    setData(games);
    setBoard(lb);
    setUser(sessionUser);

    let effective: Record<string, 'W' | 'L'> = {};
    if (sessionUser) {
      const mine = await fetch('/api/pickthebills/picks');
      if (mine.ok) {
        const json = await mine.json();
        for (const p of json.picks ?? []) effective[p.game_id] = p.predicted;
      }
    }
    applyDefaults(games.games, effective);
    setLoading(false);
  }, [applyDefaults]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(gameId: string, value: 'W' | 'L') {
    setSel((prev) => ({ ...prev, [gameId]: value }));
  }

  function buildPicks() {
    return pickable.map((g) => ({ gameId: g.id, predicted: sel[g.id] ?? 'W' }));
  }

  async function save(confirmOverwrite = false) {
    if (!user) {
      // Soft wall: stash picks so they survive the OAuth redirect, then sign in.
      try {
        sessionStorage.setItem(PENDING_STASH, JSON.stringify({ season: data?.season, picks: buildPicks(), stashedAt: new Date().toISOString() }));
      } catch {
        // ignore
      }
      signIn('google', { callbackUrl: '/pickthebills?claim=1' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/pickthebills/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: buildPicks(), confirmOverwrite }),
      });
      if (res.status === 409) {
        setConfirmOpen(true);
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setConfirmOpen(false);
        setNotice(`Saved ${json.savedGameIds?.length ?? 0} pick(s).`);
        await load();
      } else {
        setNotice(json.error || 'Could not save picks');
      }
    } finally {
      setSaving(false);
    }
  }

  const locked = !data?.openWindow;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-4 py-8 text-white" style={{ background: `linear-gradient(135deg, ${BILLS_BLUE}, ${BILLS_RED})` }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Pick the Bills
          </h1>
          <p className="text-white/80 mt-1 text-sm">
            Call every game. Change your mind as the season turns. Climb the accuracy leaderboard.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {([
            { key: 'picks', label: 'Make Picks', icon: ListChecks },
            { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.key ? 'text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
              style={tab === t.key ? { background: BILLS_BLUE } : undefined}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : tab === 'picks' ? (
          <PicksTab
            pickable={pickable}
            sel={sel}
            toggle={toggle}
            save={save}
            saving={saving}
            locked={locked}
            openWindow={data?.openWindow ?? null}
            user={user}
            notice={notice}
          />
        ) : (
          <LeaderboardTab board={board} />
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Replace your picks?</h3>
            <p className="text-gray-600 text-sm mb-5">
              You already made picks in this window. Saving will update them to your current selections.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: BILLS_BLUE }}
              >
                {saving ? 'Saving…' : 'Replace picks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PicksTab({
  pickable, sel, toggle, save, saving, locked, openWindow, user, notice,
}: {
  pickable: Game[];
  sel: Record<string, 'W' | 'L'>;
  toggle: (id: string, v: 'W' | 'L') => void;
  save: (confirm?: boolean) => void;
  saving: boolean;
  locked: boolean;
  openWindow: OpenWindow | null;
  user: SessionUser | null;
  notice: string | null;
}) {
  if (locked) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <p className="font-medium text-gray-700">Picks are locked right now.</p>
        <p className="text-sm mt-1">There is no open pick window. Check back at the next checkpoint.</p>
      </div>
    );
  }
  if (pickable.length === 0) {
    return <div className="text-center py-12 text-gray-500">No upcoming games to pick.</div>;
  }
  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
          {openWindow?.label} · locks {fmt(openWindow!.locksAt)}
        </div>
        <ul>
          {pickable.map((g) => (
            <li key={g.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="min-w-0">
                <div className="text-xs text-gray-400">{g.weekLabel}</div>
                <div className="font-semibold text-gray-900 truncate">
                  Bills {g.home ? 'vs' : '@'} {g.opponent}
                </div>
                <div className="text-xs text-gray-400">{fmt(g.kickoffAt)}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => toggle(g.id, 'W')}
                  className={`px-3 py-1.5 rounded-l-lg text-sm font-bold border ${
                    sel[g.id] === 'W' ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300'
                  }`}
                  style={sel[g.id] === 'W' ? { background: BILLS_BLUE } : undefined}
                >
                  Win
                </button>
                <button
                  onClick={() => toggle(g.id, 'L')}
                  className={`px-3 py-1.5 rounded-r-lg text-sm font-bold border ${
                    sel[g.id] === 'L' ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300'
                  }`}
                  style={sel[g.id] === 'L' ? { background: BILLS_RED } : undefined}
                >
                  Loss
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {notice && <p className="text-sm text-emerald-700 mb-3">{notice}</p>}

      <button
        onClick={() => save(false)}
        disabled={saving}
        className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
        style={{ background: BILLS_BLUE }}
      >
        {saving ? 'Saving…' : user ? 'Save my picks' : 'Create a free account to save your picks'}
      </button>
    </>
  );
}

function LeaderboardTab({ board }: { board: Leaderboard | null }) {
  if (!board || (board.ranked.length === 0 && board.unranked.length === 0)) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Trophy className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <p className="font-medium text-gray-700">No ranked fans yet.</p>
        <p className="text-sm mt-1">Once games are played, accuracy rankings show up here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        Ranked by accuracy. Need {board.threshold} graded game{board.threshold === 1 ? '' : 's'} to qualify
        ({board.finalGames} played so far).
      </p>
      <Rows title="Ranked" entries={board.ranked} showRank />
      {board.unranked.length > 0 && <Rows title="Not yet qualified" entries={board.unranked} showRank={false} />}
    </div>
  );
}

function Rows({ title, entries, showRank }: { title: string; entries: LeaderboardEntry[]; showRank: boolean }) {
  if (entries.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <ul>
        {entries.map((e) => (
          <li key={e.userId} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3 min-w-0">
              {showRank && <span className="w-6 text-center font-bold text-gray-400">{e.rank}</span>}
              <Link href={`/pickthebills/u/${e.userId}`} className="font-semibold text-gray-900 truncate hover:underline">
                {e.displayName || 'Anonymous'}
              </Link>
            </div>
            <div className="text-sm text-gray-600 shrink-0">
              <span className="font-bold text-gray-900">{Math.round(e.accuracy * 100)}%</span>
              <span className="text-gray-400 ml-2">{e.correct}/{e.graded}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
