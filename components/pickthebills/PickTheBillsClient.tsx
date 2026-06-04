'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { Loader2, Trophy, ListChecks, Lock } from 'lucide-react';
import { BILLS_LOGO, nflLogo } from '@/lib/pickthebills/nflTeams';

const BILLS_BLUE = '#00338D';
const BILLS_RED = '#C60C30';
const PENDING_STASH = 'pickthebills:pendingPicks';
const SET_SIZE = 5; // "Lindy's Five" — games are grouped into sets of five.

interface Game {
  id: string;
  weekLabel: string;
  opponent: string;
  home: boolean;
  kickoffAt: string;
  status: string; // 'scheduled' | 'final'
  result: string | null; // 'W' | 'L' | 'T' | null (Bills perspective)
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

const ET_DATE = { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' } as const;
const ET_TIME = { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' } as const;
function fmtShort(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', ET_DATE)} · ${d.toLocaleTimeString('en-US', ET_TIME)}`;
}
const ET_DAY = { timeZone: 'America/New_York', month: 'numeric', day: 'numeric' } as const;
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', ET_DAY);
}

function weekNum(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
function setRange(setGames: Game[]): string {
  const nums = setGames.map((g) => weekNum(g.weekLabel)).filter((n): n is number => n !== null);
  if (nums.length === 0) return `${setGames.length} game${setGames.length === 1 ? '' : 's'}`;
  const a = Math.min(...nums);
  const b = Math.max(...nums);
  return a === b ? `Week ${a}` : `Weeks ${a}–${b}`;
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// A set's record: real results for final games, current selections for the rest.
function setRecord(setGames: Game[], sel: Record<string, 'W' | 'L'>): { wins: number; losses: number; hasFinal: boolean } {
  let wins = 0;
  let losses = 0;
  let hasFinal = false;
  for (const g of setGames) {
    if (g.status === 'final') {
      hasFinal = true;
      if (g.result === 'W') wins++;
      else if (g.result === 'L') losses++;
    } else if (sel[g.id] === 'W') wins++;
    else if (sel[g.id] === 'L') losses++;
  }
  return { wins, losses, hasFinal };
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
  // When the server reports a 409 (picks already exist in this window), we stash
  // the retry-with-confirm action here so one modal serves both save and claim.
  const [pendingConfirm, setPendingConfirm] = useState<null | (() => void)>(null);
  const claimedRef = useRef(false);

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

    const effective: Record<string, 'W' | 'L'> = {};
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
        setPendingConfirm(() => () => save(true));
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setPendingConfirm(null);
        setNotice(`Saved ${json.savedGameIds?.length ?? 0} pick(s).`);
        await load();
      } else {
        setNotice(json.error || 'Could not save picks');
      }
    } finally {
      setSaving(false);
    }
  }

  // Claim-on-return: after OAuth bounces back with ?claim=1, the anonymous picks
  // are still in sessionStorage. Write them to the now-authenticated account and
  // clear the stash. An existing account with picks in this window hits the same
  // 409 confirm path as a normal save.
  const claim = useCallback(
    async (confirmOverwrite = false) => {
      let picks: { gameId: string; predicted: 'W' | 'L' }[] = [];
      try {
        const raw = sessionStorage.getItem(PENDING_STASH);
        if (!raw) return;
        picks = JSON.parse(raw)?.picks ?? [];
      } catch {
        return;
      }
      if (picks.length === 0) {
        sessionStorage.removeItem(PENDING_STASH);
        return;
      }
      setSaving(true);
      try {
        const res = await fetch('/api/pickthebills/picks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ picks, confirmOverwrite }),
        });
        if (res.status === 409) {
          setPendingConfirm(() => () => claim(true));
          return;
        }
        const json = await res.json();
        sessionStorage.removeItem(PENDING_STASH);
        setPendingConfirm(null);
        setNotice(res.ok ? `Saved ${json.savedGameIds?.length ?? 0} pick(s).` : json.error || 'Could not save your picks');
        if (res.ok) await load();
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  useEffect(() => {
    if (loading || !user || claimedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('claim') !== '1') return;
    claimedRef.current = true;
    // Strip ?claim=1 so a refresh does not re-trigger the claim.
    window.history.replaceState(null, '', '/pickthebills');
    claim();
  }, [loading, user, claim]);

  const locked = !data?.openWindow;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — solid Bills blue, red underline, placeholder logo + wordmark. */}
      <header className="text-white border-b-4" style={{ background: BILLS_BLUE, borderColor: BILLS_RED }}>
        <div className="max-w-6xl mx-auto px-4 py-5 md:py-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white flex items-center justify-center shadow-inner p-1.5">
            <Image src={BILLS_LOGO} alt="Buffalo Bills" width={56} height={56} className="w-full h-full object-contain" />
          </div>
          <h1 className="mt-2 text-4xl md:text-5xl tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Pick the Bills
          </h1>
          <p className="text-white/80 text-xs md:text-sm">Call every game. Climb the accuracy leaderboard.</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
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
            games={data?.games ?? []}
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

      {pendingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Replace your picks?</h3>
            <p className="text-gray-600 text-sm mb-5">
              You already made picks in this window. Saving will update them to your current selections.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingConfirm(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={() => pendingConfirm()}
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
  games, sel, toggle, save, saving, locked, openWindow, user, notice,
}: {
  games: Game[];
  sel: Record<string, 'W' | 'L'>;
  toggle: (id: string, v: 'W' | 'L') => void;
  save: (confirm?: boolean) => void;
  saving: boolean;
  locked: boolean;
  openWindow: OpenWindow | null;
  user: SessionUser | null;
  notice: string | null;
}) {
  const now = Date.now();
  const sets = useMemo(() => chunk(games, SET_SIZE), [games]);

  // The "current" set is the first one holding a still-pickable game; if the
  // season is over, fall back to the last set. Drives the accent ring + autoscroll.
  const currentSetIndex = useMemo(() => {
    const idx = sets.findIndex((s) => s.some((g) => g.status === 'scheduled' && new Date(g.kickoffAt).getTime() > now));
    return idx === -1 ? Math.max(0, sets.length - 1) : idx;
  }, [sets, now]);

  // Season record: real results for finals + current selections for the rest.
  const { wins, losses } = useMemo(() => {
    let w = 0;
    let l = 0;
    for (const g of games) {
      if (g.status === 'final') {
        if (g.result === 'W') w++;
        else if (g.result === 'L') l++;
      } else if (sel[g.id] === 'W') w++;
      else if (sel[g.id] === 'L') l++;
    }
    return { wins: w, losses: l };
  }, [games, sel]);

  const currentRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !currentRef.current) return;
    scrolledRef.current = true;
    currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [sets]);

  if (games.length === 0) {
    return <div className="text-center py-12 text-gray-500">No games scheduled yet.</div>;
  }

  return (
    <>
      <HeroBar wins={wins} losses={losses} openWindow={openWindow} locked={locked} />

      <div className="grid grid-cols-1 gap-4 mt-5">
        {sets.map((setGames, i) => {
          const isCurrent = i === currentSetIndex;
          const rec = setRecord(setGames, sel);
          return (
            <div
              key={i}
              ref={isCurrent ? currentRef : undefined}
              className={`rounded-2xl border-2 bg-white p-3 md:p-4 shadow-sm ${isCurrent ? 'shadow-md' : 'border-gray-200'}`}
              style={isCurrent ? { borderColor: BILLS_BLUE } : undefined}
            >
              <div className="flex items-end justify-between mb-3 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em' }}>
                    SET {i + 1}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{setRange(setGames)}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold leading-none" style={{ color: BILLS_BLUE, fontFamily: 'Bebas Neue, sans-serif' }}>
                    {rec.wins}–{rec.losses}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">
                    {rec.hasFinal ? 'record' : 'projected'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {setGames.map((g) => (
                  <GameCell key={g.id} game={g} value={sel[g.id]} onPick={(v) => toggle(g.id, v)} editable={!locked && g.status === 'scheduled' && new Date(g.kickoffAt).getTime() > now} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {notice && <p className="text-sm text-emerald-700 mt-4">{notice}</p>}

      {locked ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-4 text-sm text-gray-500">
          <Lock className="w-4 h-4 text-gray-400" />
          Picks are locked right now. Check back at the next checkpoint.
        </div>
      ) : (
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="mt-5 w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
          style={{ background: BILLS_BLUE }}
        >
          {saving ? 'Saving…' : user ? 'Save my picks' : 'Create a free account to save your picks'}
        </button>
      )}
    </>
  );
}

function HeroBar({ wins, losses, openWindow, locked }: { wins: number; losses: number; openWindow: OpenWindow | null; locked: boolean }) {
  const decided = wins + losses;
  const pct = decided > 0 ? Math.round((wins / decided) * 100) : 0;
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Your call</span>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          {locked ? (
            <>
              <Lock className="w-3 h-3" /> Picks locked
            </>
          ) : openWindow ? (
            <>
              {openWindow.label} · locks {fmtDay(openWindow.locksAt)}
            </>
          ) : null}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Projected record</span>
        <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {wins}–{losses}
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BILLS_BLUE }} />
      </div>
    </div>
  );
}

function GameCell({ game, value, onPick, editable }: { game: Game; value: 'W' | 'L' | undefined; onPick: (v: 'W' | 'L') => void; editable: boolean }) {
  const logo = nflLogo(game.opponent);
  const isFinal = game.status === 'final';

  // Border encodes state: finals -> green if pick was right, red if wrong, gray
  // if no pick; pre-game -> blue when picking Win, red when picking Loss.
  let borderStyle: React.CSSProperties = { borderColor: '#e5e7eb' };
  if (isFinal) {
    if (value && game.result) borderStyle = { borderColor: value === game.result ? '#10b981' : '#ef4444' };
  } else if (editable && value) {
    borderStyle = { borderColor: value === 'W' ? BILLS_BLUE : BILLS_RED };
  }

  return (
    <div className={`rounded-xl border-2 bg-gradient-to-br from-blue-50/60 to-slate-50 p-2.5 flex flex-col ${isFinal && value && game.result && value !== game.result ? 'opacity-75' : ''}`} style={borderStyle}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-500">{game.weekLabel}</span>
        <span className="text-[10px] font-bold tracking-wide text-gray-400">{game.home ? 'HOME' : 'AWAY'}</span>
      </div>

      <div className="flex flex-col items-center text-center mt-1.5 mb-2">
        <div className="text-[10px] font-semibold text-gray-400">{game.home ? 'vs' : '@'}</div>
        {logo && (
          <div className="my-1 rounded-lg bg-white border border-gray-200 shadow-sm p-1">
            <Image src={logo} alt={game.opponent} width={40} height={40} className="w-10 h-10 object-contain" />
          </div>
        )}
        <div className="text-xs font-bold text-gray-800 leading-tight">{game.opponent}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{fmtShort(game.kickoffAt)}</div>
      </div>

      <div className="mt-auto">
        {isFinal ? (
          <FinalCell result={game.result} pick={value} />
        ) : editable ? (
          <SegmentedPick value={value} onPick={onPick} />
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 py-1.5 text-xs font-semibold text-gray-400">
            <Lock className="w-3 h-3" /> Locked
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentedPick({ value, onPick }: { value: 'W' | 'L' | undefined; onPick: (v: 'W' | 'L') => void }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-300">
      <button
        onClick={() => onPick('W')}
        className={`py-1.5 text-sm font-bold transition-colors ${value === 'W' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        style={value === 'W' ? { background: BILLS_BLUE } : undefined}
      >
        Win
      </button>
      <button
        onClick={() => onPick('L')}
        className={`py-1.5 text-sm font-bold border-l border-gray-300 transition-colors ${value === 'L' ? 'text-white border-transparent' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        style={value === 'L' ? { background: BILLS_RED } : undefined}
      >
        Loss
      </button>
    </div>
  );
}

function FinalCell({ result, pick }: { result: string | null; pick: 'W' | 'L' | undefined }) {
  const label = result === 'W' ? 'Win' : result === 'L' ? 'Loss' : result === 'T' ? 'Tie' : 'Final';
  const cls =
    result === 'W' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : result === 'L' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200';
  // Only W/L picks are gradable (ties are excluded from scoring).
  const correct = pick && (result === 'W' || result === 'L') ? pick === result : null;
  return (
    <div className={`rounded-lg border py-1.5 px-2 text-center text-xs font-bold flex items-center justify-center gap-1 ${cls}`}>
      <span>Final · {label}</span>
      {correct === true && <span title="You called it">✓</span>}
      {correct === false && <span title="Missed">✗</span>}
    </div>
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
    <div className="space-y-6 max-w-2xl">
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
