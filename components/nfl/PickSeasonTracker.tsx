'use client';

// Pick the {Team}: full-tracker-style NFL season pick page. The whole page is
// pick mode — every pending game has W/L buttons, played games lock with their
// real result. Mirrors the MLBTeamTracker layout and reuses the What-If save
// flow (accounts, SavePicksModal, sticky bar, restore).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { NFLTeamConfig } from '@/lib/teamConfig/nflTeams';
import type { NFLGameResult } from '@/lib/types/nfl';
import { fetchNFLSchedule } from '@/lib/services/nflApi';
import NFLPickNav from './NFLPickNav';
import WhatIfStickyBar from '@/components/WhatIfStickyBar';
import HeaderProfileIcon from '@/components/HeaderProfileIcon';
import { useCurrentUser } from '@/components/perfectseason/useCurrentUser';
import AuthModal from '@/components/perfectseason/board/AuthModal';
import SavePicksModal from '@/components/whatif/SavePicksModal';
import { fetchLatestWhatIfSave } from '@/lib/whatif/client';
import type { WhatIfSave, WhatIfSubmission } from '@/lib/whatif/types';

const NFL_SEASON_GAMES = 17;
// Rough modern playoff cut: ~10 wins usually makes it, 9 is the bubble.
const NFL_PLAYOFF_TARGET = 10;

type Pick = 'W' | 'L';

interface PickSeasonTrackerProps {
  team: NFLTeamConfig;
}

export default function PickSeasonTracker({ team }: PickSeasonTrackerProps) {
  const router = useRouter();
  const [games, setGames] = useState<NFLGameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map());
  // Most recent prior-season result vs each opponent, for the row context zone.
  const [lastMeetings, setLastMeetings] = useState<Map<string, NFLGameResult>>(new Map());

  // Saved-picks flow: opt-in account (shared with Perfect Season), save modal,
  // and the user's most recent save for this team (for the restore prompt).
  const { user, setUser } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [latestSave, setLatestSave] = useState<WhatIfSave | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const autoRestoredRef = useRef(false);
  const [boxOffscreen, setBoxOffscreen] = useState(false);
  const outlookBoxRef = useRef<HTMLDivElement | null>(null);

  const season = String(new Date().getFullYear());
  const fullName = `${team.city} ${team.name}`;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await fetchNFLSchedule(team.abbreviation, Number(season));
      setGames(data.games);
    } catch (err) {
      console.error('Failed to load NFL schedule:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPicks(new Map());
    setLatestSave(null);
    setAutoLoaded(false);
    autoRestoredRef.current = false;
    loadData();
    // Mark the browser as having tried a pick page — quiets the discovery
    // banner on the NHL trackers for good.
    try {
      localStorage.setItem('pickthe-visited', '1');
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  // Most recent meeting per opponent, playoffs included. The NFL's rotating
  // schedule guarantees every pairing within 4 seasons, so walking back four
  // years covers all 17 opponents even ones not played last year.
  useEffect(() => {
    let cancelled = false;
    setLastMeetings(new Map());
    const priorSeasons = [1, 2, 3, 4].map(back =>
      fetchNFLSchedule(team.abbreviation, Number(season) - back, { includePostseason: true }).catch(() => null)
    );
    Promise.all(priorSeasons).then(results => {
      if (cancelled) return;
      const byOpponent = new Map<string, NFLGameResult>();
      for (const result of results) {
        for (const g of result?.games ?? []) {
          if (g.outcome === 'PENDING') continue;
          const existing = byOpponent.get(g.opponent);
          if (!existing || g.isoDate > existing.isoDate) byOpponent.set(g.opponent, g);
        }
      }
      setLastMeetings(byOpponent);
    });
    return () => { cancelled = true; };
  }, [team.abbreviation, season]);

  // Most recent save for this team, to power the "load my last picks" prompt.
  useEffect(() => {
    if (!user) {
      setLatestSave(null);
      return;
    }
    let cancelled = false;
    fetchLatestWhatIfSave('nfl', team.id, season).then(save => {
      if (!cancelled) setLatestSave(save);
    });
    return () => { cancelled = true; };
  }, [user, team.id, season]);

  // Returning pickers open with their latest saved picks already applied —
  // the page should recognize them, not present a blank slate. Runs once per
  // team, only onto an untouched board; Reset clears it back to blank.
  useEffect(() => {
    if (!latestSave || games.length === 0 || autoRestoredRef.current) return;
    autoRestoredRef.current = true;
    if (picks.size > 0) return; // they started picking before the fetch landed
    const pendingIds = new Set(games.filter(g => g.outcome === 'PENDING').map(g => g.gameId));
    const restored = new Map<number, Pick>();
    for (const pick of latestSave.picks) {
      if (pick.outcome === 'OTL' || !pendingIds.has(pick.gameId)) continue;
      restored.set(pick.gameId, pick.outcome);
    }
    if (restored.size > 0) {
      setPicks(restored);
      setAutoLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestSave, games]);

  // Sticky bar appears once the Season Outlook box scrolls out of view.
  useEffect(() => {
    const el = outlookBoxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setBoxOffscreen(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const scrollToOutlook = () => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    outlookBoxRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const handlePick = (game: NFLGameResult, outcome: Pick) => {
    if (game.outcome !== 'PENDING') return;
    setPicks(prev => {
      const next = new Map(prev);
      if (next.get(game.gameId) === outcome) next.delete(game.gameId);
      else next.set(game.gameId, outcome);
      return next;
    });
  };

  // Record math: real results + picks on pending games.
  const outlook = useMemo(() => {
    const realWins = games.filter(g => g.outcome === 'W').length;
    const realLosses = games.filter(g => g.outcome === 'L').length;
    let pickWins = 0;
    let pickLosses = 0;
    for (const p of picks.values()) p === 'W' ? pickWins++ : pickLosses++;
    return {
      realWins,
      realLosses,
      pickWins,
      pickLosses,
      projWins: realWins + pickWins,
      projLosses: realLosses + pickLosses,
      gamesPlayed: realWins + realLosses,
      unpicked: games.filter(g => g.outcome === 'PENDING' && !picks.has(g.gameId)).length,
    };
  }, [games, picks]);

  const buildWhatIfSubmission = (): WhatIfSubmission => ({
    sport: 'nfl',
    teamId: team.id,
    season,
    picks: games
      .filter(g => picks.has(g.gameId))
      .map(g => ({
        gameId: g.gameId,
        date: g.isoDate,
        opponentAbbrev: g.opponent,
        isHome: g.isHome,
        outcome: picks.get(g.gameId)!,
        week: g.week,
      })),
    summary: {
      gamesPicked: picks.size,
      record: `${outlook.pickWins}-${outlook.pickLosses}`,
      projectedPoints: outlook.projWins, // wins (see WhatIfSummary)
      playoffOdds: 0, // no NFL probability model yet — hidden in displays
      totalPoints: outlook.realWins,
      gamesPlayed: outlook.gamesPlayed,
      setsCovered: [],
    },
  });

  const handleSaveClick = () => {
    if (picks.size === 0) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setSaveModalOpen(true);
  };

  const resetPicks = () => {
    setPicks(new Map());
    setAutoLoaded(false);
  };

  // Re-apply a previous save: only still-pending games take effect.
  const handleRestorePicks = () => {
    if (!latestSave) return;
    const pendingIds = new Set(games.filter(g => g.outcome === 'PENDING').map(g => g.gameId));
    const restored = new Map<number, Pick>();
    for (const pick of latestSave.picks) {
      if (pick.outcome === 'OTL' || !pendingIds.has(pick.gameId)) continue;
      restored.set(pick.gameId, pick.outcome);
    }
    setPicks(restored);
  };

  const teamNameColor = team.colors.accent !== team.colors.primary
    ? team.colors.accent
    : team.colors.secondary !== '#FFFFFF'
    ? team.colors.secondary
    : '#FFFFFF';

  if (loading && games.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-2xl" style={{ color: team.colors.primary }}>Loading {team.name} schedule...</div>
      </div>
    );
  }

  if (error && games.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-2xl mb-4" style={{ color: team.colors.primary }}>Failed to load {team.name} schedule</div>
          <button
            onClick={() => { setError(false); loadData(); }}
            className="px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
          >
            Tap to Retry
          </button>
        </div>
      </div>
    );
  }

  const targetProgress = Math.min((outlook.projWins / NFL_PLAYOFF_TARGET) * 100, 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sticky pick bar — follows the user down the schedule */}
      <WhatIfStickyBar
        show={boxOffscreen && picks.size > 0}
        gamesSimulated={picks.size}
        record={`${outlook.pickWins}-${outlook.pickLosses}`}
        projectedPoints={outlook.projWins}
        odds={0}
        showOdds={false}
        totalPoints={outlook.projWins}
        gamesPlayed={outlook.gamesPlayed}
        totalGames={NFL_SEASON_GAMES}
        playoffTarget={NFL_PLAYOFF_TARGET}
        projectionReady={picks.size > 0}
        onReset={resetPicks}
        onSave={handleSaveClick}
        onJumpToBox={scrollToOutlook}
        isGoatMode={false}
        teamColors={{ primary: team.colors.primary, accent: team.colors.accent }}
        darkModeColors={{ accent: team.colors.secondary, background: team.colors.primary }}
      />

      {/* Header — matches the NHL/MLB tracker heroes */}
      <header
        className="shadow-xl border-b-4"
        style={{ background: team.colors.primary, borderBottomColor: team.colors.secondary }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col items-center text-center relative">
            <div className="absolute left-0 top-0">
              <NFLPickNav currentTeamId={team.id} />
            </div>

            {/* Account entry (mirrors the NHL tracker header) */}
            <div className="absolute right-0 top-0">
              <HeaderProfileIcon user={user} />
            </div>

            <button
              onClick={() => router.push('/')}
              className="hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded-lg"
              title="Back to Home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={team.logo} alt={`${fullName} Logo`} className="w-16 h-16 md:w-24 md:h-24 mb-2 md:mb-3" />
            </button>
            <p
              className="text-4xl md:text-6xl font-bold mb-2 tracking-wider text-white"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </p>
            <h1
              className="text-xs md:text-2xl font-semibold mb-1 px-2 leading-tight whitespace-nowrap"
              style={{ color: teamNameColor }}
            >
              Pick the {team.name} &bull; {season} Season
            </h1>
            <p className="text-xs md:text-base opacity-90 px-2 leading-tight text-white">
              Predict every game &bull; Save your picks &bull; Track your accuracy
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Season Outlook — the tracker's Progress Bar analog */}
        <div ref={outlookBoxRef}>
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg md:text-2xl font-bold" style={{ color: team.colors.primary }}>
                Season Outlook
              </h2>
              <div className="flex items-center gap-2">
                {picks.size > 0 && (
                  <>
                    <button
                      onClick={handleSaveClick}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: team.colors.primary }}
                    >
                      Save Picks
                    </button>
                    <button
                      onClick={resetPicks}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-opacity hover:opacity-80"
                      style={{ borderColor: team.colors.primary, color: team.colors.primary }}
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: team.colors.primary }}>
                  Projected Record
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {outlook.projWins}-{outlook.projLosses}
                </div>
                {outlook.unpicked > 0 && (
                  <div className="text-xs mt-1 text-gray-600">{outlook.unpicked} games unpicked</div>
                )}
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: team.colors.primary }}>
                  Your Picks
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {picks.size > 0 ? `${outlook.pickWins}-${outlook.pickLosses}` : '—'}
                </div>
                <div className="text-xs mt-1 text-gray-600">{picks.size}/{games.filter(g => g.outcome === 'PENDING').length} picked</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: team.colors.primary }}>
                  Real Record
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {outlook.realWins}-{outlook.realLosses}
                </div>
                <div className="text-xs mt-1 text-gray-600">{outlook.gamesPlayed}/{NFL_SEASON_GAMES} played</div>
              </div>
            </div>

            {/* Progress toward a playoff-pace season */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 h-3 rounded-full bg-gray-200">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                  style={{ width: `${targetProgress}%`, backgroundColor: team.colors.primary }}
                />
              </div>
              <span className="flex-shrink-0 text-xs font-semibold text-gray-500">
                {outlook.projWins}/{NFL_PLAYOFF_TARGET} playoff-pace wins
              </span>
            </div>

            {/* Auto-loaded notice: the page opened with their latest save applied */}
            {autoLoaded && latestSave && picks.size > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500 md:text-sm">
                Loaded your saved picks from{' '}
                <span className="font-bold text-gray-700">
                  {new Date(`${latestSave.savedDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                {latestSave.label ? ` · “${latestSave.label}”` : ''} — change any game and Save Picks to update, or Reset for a blank slate.
              </div>
            )}
            {/* Restore prompt: signed-in user with a previous save and a clean slate */}
            {latestSave && picks.size === 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs md:text-sm text-gray-600">
                <span className="min-w-0 truncate">
                  You saved picks on {new Date(`${latestSave.savedDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {latestSave.label ? ` — “${latestSave.label}”` : ''} ({latestSave.summary.gamesPicked} games, {latestSave.summary.record})
                </span>
                <button
                  onClick={handleRestorePicks}
                  className="font-bold underline whitespace-nowrap hover:opacity-80"
                  style={{ color: team.colors.primary }}
                >
                  Load my last picks
                </button>
              </div>
            )}
            {user && (
              <div className="mt-2 text-xs text-gray-400">
                <Link href="/account?tab=picks" className="underline hover:text-gray-600">My Picks</Link>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-400">
              Been picking all season somewhere else? Make your picks, hit Save, and choose{' '}
              <span className="font-semibold text-gray-500">“Log picks from a past date”</span> to backfill earlier weeks.
            </div>
          </div>
        </div>

        {/* Weekly schedule — every pending game is pickable */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="text-lg md:text-xl font-bold" style={{ color: team.colors.primary }}>
              {season} Schedule
            </h2>
            <span className="text-xs text-gray-400">Tap W or L to pick</span>
          </div>
          {(() => {
            // Bye = a week with no game. Derived from the schedule itself —
            // ESPN's byeWeek field can disagree with the actual game list
            // (2026 Bills: byeWeek said 5, the gameless week was 7).
            const weekRow = (week: number) => {
              const game = games.find(g => g.week === week);
              if (!game) {
                return (
                  <li key={`bye-${week}`} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                    <span className="w-12 flex-shrink-0 text-xs font-bold uppercase tracking-wide text-gray-400">Wk {week}</span>
                    <span className="text-sm font-semibold text-gray-400">Bye week</span>
                  </li>
                );
              }
              const pick = picks.get(game.gameId);
              const final = game.outcome !== 'PENDING';
              const lastMeeting = lastMeetings.get(game.opponent);
              return (
                <li key={game.gameId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-12 flex-shrink-0 text-xs font-bold uppercase tracking-wide text-gray-400">Wk {week}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={game.opponentLogo} alt="" className="h-7 w-7 flex-shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-gray-900">
                      {game.isHome ? 'vs' : '@'}{' '}
                      <span className="sm:hidden">{game.opponent}</span>
                      <span className="hidden sm:inline">{game.opponentName || game.opponent}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {game.date}{!final ? ` · ${game.startTime}` : ''}
                    </div>
                  </div>
                  {/* Context zone (desktop): last meeting */}
                  <div className="hidden min-w-0 flex-1 items-center justify-end gap-2.5 md:flex">
                    {lastMeeting && (
                      <span className="truncate text-xs text-gray-500">
                        Last meeting:{' '}
                        <span className={`font-bold ${lastMeeting.outcome === 'W' ? 'text-green-600' : 'text-red-500'}`}>
                          {lastMeeting.outcome} {lastMeeting.teamScore}-{lastMeeting.opponentScore}
                        </span>
                        {' · '}
                        {lastMeeting.seasonType === 3 ? 'Playoffs, ' : ''}
                        {new Date(`${lastMeeting.isoDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {final ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">{game.teamScore}-{game.opponentScore}</span>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${
                          game.outcome === 'W' ? 'bg-green-600' : 'bg-red-500'
                        }`}
                      >
                        {game.outcome}
                      </span>
                    </div>
                  ) : game.isLive ? (
                    <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-600">
                      Live
                    </span>
                  ) : (
                    // Segmented Win/Loss control: one decision, two states.
                    <div className="flex flex-shrink-0 items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                      {(['W', 'L'] as const).map((o, i) => {
                        const active = pick === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => handlePick(game, o)}
                            aria-pressed={active}
                            aria-label={`Pick ${o === 'W' ? 'win' : 'loss'} vs ${game.opponent} in week ${week}`}
                            className={`flex h-8 items-center justify-center px-2.5 text-sm font-bold transition-colors sm:px-3.5 ${
                              i > 0 ? 'border-l border-gray-200' : ''
                            } ${active ? 'text-white shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
                            style={active ? { backgroundColor: o === 'W' ? team.colors.primary : '#475569' } : undefined}
                          >
                            <span className="sm:hidden">{o}</span>
                            <span className="hidden sm:inline">{o === 'W' ? 'Win' : 'Loss'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            };
            const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
            return <ul className="divide-y divide-gray-100">{weeks.map(weekRow)}</ul>;
          })()}
        </div>

        {/* Footer */}
        <footer className="text-center text-sm mt-8 pb-8 text-gray-500">
          <p className="text-xs mb-2">
            Schedule and scores from ESPN | Picks grade automatically as games finish
          </p>
          <p className="text-xs">
            &copy; {new Date().getFullYear()} JRR Apps. All rights reserved.
          </p>
        </footer>
      </main>

      {/* Saved-picks flow: sign in (shared opt-in account), then confirm the snapshot */}
      {authOpen && (
        <AuthModal
          initialMode="signup"
          reason="Create a free account to save your picks and track your accuracy all season."
          defaultFavoriteTeam={team.id}
          onClose={() => setAuthOpen(false)}
          onSuccess={(u) => {
            setUser(u);
            setAuthOpen(false);
            setSaveModalOpen(true);
          }}
        />
      )}
      {saveModalOpen && (
        <SavePicksModal
          onClose={() => setSaveModalOpen(false)}
          submission={buildWhatIfSubmission()}
          teamName={team.name}
          totalGames={NFL_SEASON_GAMES}
        />
      )}
    </div>
  );
}
