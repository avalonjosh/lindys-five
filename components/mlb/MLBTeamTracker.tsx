'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MLBGameChunk, MLBSeasonStats, MLBGameResult } from '@/lib/types/mlb';
import { fetchMLBSchedule, fetchMLBLastSeasonComparison } from '@/lib/services/mlbApi';
import { calculateMLBChunks, calculateMLBSeasonStats, MLB_TOTAL_GAMES, MLB_PLAYOFF_TARGET_WINS } from '@/lib/utils/mlbChunkCalculator';
import type { MLBTeamConfig } from '@/lib/teamConfig/mlbTeams';
import MLBChunkCard from './MLBChunkCard';
import MLBProgressBar from './MLBProgressBar';
import MLBTeamNav from './MLBTeamNav';
import MLBStandingsCard from './MLBStandingsCard';
import MerchCTA from '@/components/affiliate/MerchCTA';
import GamePromo from '@/components/perfectseason/GamePromo';
import WhatIfStickyBar from '@/components/WhatIfStickyBar';
import { useCurrentUser } from '@/components/perfectseason/useCurrentUser';
import AuthModal from '@/components/perfectseason/board/AuthModal';
import SavePicksModal from '@/components/whatif/SavePicksModal';
import { fetchLatestWhatIfSave } from '@/lib/whatif/client';
import type { WhatIfSave, WhatIfSubmission } from '@/lib/whatif/types';

// Teams whose logo blends into their header background color
const mlbBgTeamIds = ['orioles', 'reds', 'cardinals', 'angels', 'phillies', 'nationals', 'rays', 'tigers', 'royals', 'twins', 'dodgers', 'giants', 'rockies', 'padres'];

interface MLBTeamTrackerProps {
  team: MLBTeamConfig;
}

export default function MLBTeamTracker({ team }: MLBTeamTrackerProps) {
  const router = useRouter();
  const [chunks, setChunks] = useState<MLBGameChunk[]>([]);
  const [stats, setStats] = useState<MLBSeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [hypotheticalResults, setHypotheticalResults] = useState<Map<number, MLBGameResult>>(new Map());
  // Sticky What-If bar: mirrors the box's odds and shows once the box scrolls off.
  const [whatIfProbability, setWhatIfProbability] = useState(0);
  // Saved-picks flow: opt-in account (shared with Perfect Season), save modal,
  // and the user's most recent save for this team (for the restore prompt).
  const { user, setUser } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [latestSave, setLatestSave] = useState<WhatIfSave | null>(null);
  const [boxOffscreen, setBoxOffscreen] = useState(false);
  const progressBoxRef = useRef<HTMLDivElement | null>(null);
  const [yearOverYearMode, setYearOverYearMode] = useState(false);
  const [yearOverYearLoading, setYearOverYearLoading] = useState(false);
  const [lastSeasonData, setLastSeasonData] = useState<{ winsLastYear: number; lossesLastYear: number; recordLastYear: string } | null>(null);
  const pollingIntervalRef = useRef(60000);

  const fullName = `${team.city} ${team.name}`;

  // Find the current active set
  const getCurrentSet = (): MLBGameChunk | null => {
    return chunks.find(chunk =>
      chunk.games.some(g => g.outcome === 'PENDING') &&
      chunk.games.some(g => g.outcome !== 'PENDING')
    ) || chunks.find(chunk =>
      chunk.games.every(g => g.outcome === 'PENDING')
    ) || null;
  };

  // Get sets available for What If mode (current + next 2)
  const getWhatIfSets = (): MLBGameChunk[] => {
    const currentSet = getCurrentSet();
    if (!currentSet) return [];
    const currentIndex = chunks.findIndex(c => c.chunkNumber === currentSet.chunkNumber);
    if (currentIndex === -1) return [];
    return chunks.slice(currentIndex, currentIndex + 3);
  };

  // Check if a completed set should be hidden — hide 1 day after the last game in the set
  const shouldHideCompletedSet = (chunk: MLBGameChunk): boolean => {
    if (!chunk.isComplete) return false;
    const lastGame = chunk.games[chunk.games.length - 1];
    if (!lastGame?.date) return true;
    const lastGameDate = new Date(lastGame.date);
    const hideAfter = new Date(lastGameDate);
    hideAfter.setDate(hideAfter.getDate() + 1);
    return new Date() >= hideAfter;
  };

  // Apply hypothetical results to chunks
  const getChunksWithHypotheticals = (): MLBGameChunk[] => {
    if (!whatIfMode || hypotheticalResults.size === 0) return chunks;
    return chunks.map(chunk => ({
      ...chunk,
      games: chunk.games.map(game => {
        const hypothetical = hypotheticalResults.get(game.gameId || 0);
        return hypothetical || game;
      }),
      wins: chunk.games.filter(g => {
        const hypo = hypotheticalResults.get(g.gameId || 0);
        return (hypo || g).outcome === 'W';
      }).length,
      losses: chunk.games.filter(g => {
        const hypo = hypotheticalResults.get(g.gameId || 0);
        return (hypo || g).outcome === 'L';
      }).length,
    }));
  };

  const handleGameClick = (gameId: number, currentGame: MLBGameResult, outcome: 'W' | 'L') => {
    if (!whatIfMode || currentGame.outcome !== 'PENDING') return;
    const whatIfSets = getWhatIfSets();
    if (whatIfSets.length === 0) return;
    const isInWhatIfSets = whatIfSets.some(set => set.games.some(g => g.gameId === gameId));
    if (!isInWhatIfSets) return;

    const currentHypo = hypotheticalResults.get(gameId);
    if (currentHypo?.outcome === outcome) {
      setHypotheticalResults(prev => { const m = new Map(prev); m.delete(gameId); return m; });
      return;
    }

    const hypotheticalGame: MLBGameResult = {
      ...currentGame,
      outcome,
      teamScore: outcome === 'W' ? 5 : 1,
      opponentScore: outcome === 'W' ? 2 : 4,
    };

    setHypotheticalResults(prev => { const m = new Map(prev); m.set(gameId, hypotheticalGame); return m; });
  };

  // MLB seasons are a single calendar year (the same year loadData fetches).
  const season = String(new Date().getFullYear());

  // Show the sticky What-If bar only once the Season Progress box scrolls out of
  // view, so it never doubles up with the box itself.
  useEffect(() => {
    if (!whatIfMode) {
      setBoxOffscreen(false);
      return;
    }
    const el = progressBoxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setBoxOffscreen(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [whatIfMode]);

  const scrollToProgressBox = () => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    progressBoxRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  // Fetch the user's most recent save for this team when What If mode turns on,
  // to power the "load my last picks" prompt.
  useEffect(() => {
    if (!whatIfMode || !user) {
      setLatestSave(null);
      return;
    }
    let cancelled = false;
    fetchLatestWhatIfSave('mlb', team.id, season).then(save => {
      if (!cancelled) setLatestSave(save);
    });
    return () => { cancelled = true; };
  }, [whatIfMode, user, team.id, season]);

  // Snapshot the current What-If state as a save payload. Recomputes the stats
  // the same way the sticky bar does so the saved summary matches the screen.
  // "Points" fields carry wins for MLB (see WhatIfSummary).
  const buildWhatIfSubmission = (): WhatIfSubmission => {
    const hypos = [...hypotheticalResults.values()];
    const simStats = hypotheticalResults.size > 0
      ? calculateMLBSeasonStats(getChunksWithHypotheticals())
      : stats;
    const picks = chunks.flatMap(chunk =>
      chunk.games
        .filter(g => g.gameId != null && hypotheticalResults.has(g.gameId))
        .map(g => {
          const hypo = hypotheticalResults.get(g.gameId!)!;
          return {
            gameId: g.gameId!,
            date: g.isoDate ?? g.date,
            opponentAbbrev: g.opponent,
            isHome: g.isHome,
            outcome: hypo.outcome as 'W' | 'L',
          };
        })
    );
    const setsCovered = chunks
      .map(chunk => ({
        set: chunk.chunkNumber,
        picked: chunk.games.filter(g => g.gameId != null && hypotheticalResults.has(g.gameId)).length,
        of: chunk.games.length,
      }))
      .filter(s => s.picked > 0);
    return {
      sport: 'mlb',
      teamId: team.id,
      season,
      picks,
      summary: {
        gamesPicked: picks.length,
        record: `${hypos.filter(g => g.outcome === 'W').length}-${hypos.filter(g => g.outcome === 'L').length}`,
        projectedPoints: simStats?.projectedWins ?? 0,
        playoffOdds: whatIfProbability,
        totalPoints: simStats?.totalWins ?? 0,
        gamesPlayed: stats?.gamesPlayed ?? 0,
        setsCovered,
      },
    };
  };

  const handleSaveClick = () => {
    if (hypotheticalResults.size === 0) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setSaveModalOpen(true);
  };

  // Re-apply a previous save: only games that are still pending and still inside
  // the editable What-If sets take effect; everything else silently drops.
  const handleRestorePicks = () => {
    if (!latestSave) return;
    const whatIfSets = getWhatIfSets();
    const editableIds = new Set(
      whatIfSets.flatMap(set => set.games.filter(g => g.outcome === 'PENDING').map(g => g.gameId))
    );
    const restored = new Map<number, MLBGameResult>();
    for (const pick of latestSave.picks) {
      if (pick.outcome === 'OTL' || !editableIds.has(pick.gameId)) continue;
      const game = chunks.flatMap(c => c.games).find(g => g.gameId === pick.gameId);
      if (!game) continue;
      restored.set(pick.gameId, {
        ...game,
        outcome: pick.outcome,
        teamScore: pick.outcome === 'W' ? 5 : 1,
        opponentScore: pick.outcome === 'W' ? 2 : 4,
      });
    }
    setHypotheticalResults(restored);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(false);
      const season = new Date().getFullYear();
      const games = await fetchMLBSchedule(team.mlbId, season);
      const calculatedChunks = calculateMLBChunks(games);
      const seasonStats = calculateMLBSeasonStats(calculatedChunks);
      setChunks(calculatedChunks);
      setStats(seasonStats);

      // Detect live games for faster polling
      const hasLiveGames = games.some(g => g.gameState === 'In Progress');
      pollingIntervalRef.current = hasLiveGames ? 15000 : 60000;
    } catch (err) {
      console.error('Failed to load MLB data:', err);
      if (chunks.length === 0) setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      timer = setTimeout(() => {
        loadData().then(poll);
      }, pollingIntervalRef.current);
    };
    poll();
    return () => clearTimeout(timer);
  }, [team.mlbId]);

  // Reset year-over-year state when team changes
  useEffect(() => {
    setYearOverYearMode(false);
    setLastSeasonData(null);
  }, [team.mlbId]);

  // Fetch prior-season comparison when YoY is enabled
  useEffect(() => {
    if (!yearOverYearMode || !stats || stats.gamesPlayed === 0) return;
    if (lastSeasonData) return; // already loaded for this team

    let cancelled = false;
    setYearOverYearLoading(true);
    fetchMLBLastSeasonComparison(stats.gamesPlayed, team.mlbId)
      .then((data) => { if (!cancelled) setLastSeasonData(data); })
      .catch(() => { if (!cancelled) setLastSeasonData(null); })
      .finally(() => { if (!cancelled) setYearOverYearLoading(false); });
    return () => { cancelled = true; };
  }, [yearOverYearMode, stats?.gamesPlayed, team.mlbId, lastSeasonData, stats]);

  if (loading && chunks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-2xl" style={{ color: team.colors.secondary }}>Loading {team.name} data...</div>
      </div>
    );
  }

  if (error && chunks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-2xl mb-4" style={{ color: team.colors.secondary }}>Failed to load {team.name} data</div>
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

  // Determine team name color (matches NHL logic)
  const teamNameColor = team.colors.accent !== team.colors.primary
    ? team.colors.accent
    : team.colors.secondary !== '#FFFFFF'
    ? team.colors.secondary
    : '#FFFFFF';

  // Summary values for the sticky What-If bar (mirrors the box's numbers;
  // wins stand in for the bar's "points" fields).
  const whatIfHypos = [...hypotheticalResults.values()];
  const whatIfBarStats = whatIfMode
    ? (hypotheticalResults.size > 0 ? calculateMLBSeasonStats(getChunksWithHypotheticals()) : stats)
    : null;
  const whatIfBarRecord = `${whatIfHypos.filter(g => g.outcome === 'W').length}-${whatIfHypos.filter(g => g.outcome === 'L').length}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sticky What-If bar — follows the user down the page while simulating */}
      <WhatIfStickyBar
        show={whatIfMode && boxOffscreen}
        gamesSimulated={hypotheticalResults.size}
        record={whatIfBarRecord}
        projectedPoints={whatIfBarStats?.projectedWins ?? 0}
        odds={whatIfProbability}
        totalPoints={whatIfBarStats?.totalWins ?? 0}
        gamesPlayed={whatIfBarStats?.gamesPlayed ?? 0}
        totalGames={whatIfBarStats?.totalGames ?? MLB_TOTAL_GAMES}
        playoffTarget={whatIfBarStats?.playoffTarget ?? MLB_PLAYOFF_TARGET_WINS}
        projectionReady={true}
        onReset={() => setHypotheticalResults(new Map())}
        onSave={handleSaveClick}
        onJumpToBox={scrollToProgressBox}
        isGoatMode={false}
        teamColors={{ primary: team.colors.primary, accent: team.colors.accent }}
        darkModeColors={{ accent: team.colors.secondary, background: team.colors.primary }}
      />

      {/* Header — matches NHL classic mode exactly */}
      <header
        className="shadow-xl border-b-4"
        style={{
          background: team.colors.primary,
          borderBottomColor: team.colors.secondary,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col items-center text-center relative">
            {/* Team Navigation (same position as NHL TeamNav) */}
            <div className="absolute left-0 top-0">
              <MLBTeamNav currentTeamId={team.id} teamColors={team.colors} />
            </div>

            <button
              onClick={() => router.push('/')}
              className="hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded-lg"
              title="Back to Home"
            >
              {mlbBgTeamIds.includes(team.id) ? (
                <div className="mb-2 md:mb-3 p-3 md:p-4 rounded-full bg-white">
                  <img
                    src={team.logo}
                    alt={`${fullName} Logo`}
                    className="w-12 h-12 md:w-18 md:h-18"
                  />
                </div>
              ) : (
                <img
                  src={team.headerLogo || team.logo}
                  alt={`${fullName} Logo`}
                  className="w-16 h-16 md:w-24 md:h-24 mb-2 md:mb-3"
                />
              )}
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
              {fullName} Playoff Tracker 2026
            </h1>
            <p className="text-xs md:text-base opacity-90 px-2 leading-tight text-white">
              5-Game Set Analysis &bull; Target: 3+ wins per set
            </p>
            <div className="mt-2">
              <MerchCTA
                teamCity={team.city}
                teamName={team.name}
                sport="mlb"
                variant="compact"
                primaryColor={team.colors.secondary}
                teamSlug={team.slug}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Progress Bar — wrapped in a ref'd container so the sticky What-If
            bar knows when it scrolls off. */}
        <div ref={progressBoxRef}>
        {stats && (
          <MLBProgressBar
            onProbabilityComputed={setWhatIfProbability}
            stats={whatIfMode && hypotheticalResults.size > 0 ? calculateMLBSeasonStats(getChunksWithHypotheticals()) : stats}
            teamColors={team.colors}
            teamAbbrev={team.abbreviation}
            teamName={fullName}
            teamSlug={team.slug}
            yearOverYearMode={yearOverYearMode}
            yearOverYearLoading={yearOverYearLoading}
            onYearOverYearToggle={() => setYearOverYearMode((v) => !v)}
            lastSeasonStats={yearOverYearMode && lastSeasonData && stats.gamesPlayed > 0 ? {
              totalWins: lastSeasonData.winsLastYear,
              totalLosses: lastSeasonData.lossesLastYear,
              gamesPlayed: stats.gamesPlayed,
              gamesRemaining: MLB_TOTAL_GAMES - stats.gamesPlayed,
              totalGames: MLB_TOTAL_GAMES,
              winPct: stats.gamesPlayed > 0 ? lastSeasonData.winsLastYear / stats.gamesPlayed : 0,
              projectedWins: Math.round((lastSeasonData.winsLastYear / stats.gamesPlayed) * MLB_TOTAL_GAMES),
              playoffTarget: MLB_PLAYOFF_TARGET_WINS,
              winsAboveBelow: Math.round((lastSeasonData.winsLastYear / stats.gamesPlayed) * MLB_TOTAL_GAMES) - MLB_PLAYOFF_TARGET_WINS,
            } : undefined}
            showShareButton={true}
          />
        )}
        </div>

        {/* Standings */}
        <MLBStandingsCard teamAbbrev={team.abbreviation} teamColors={team.colors} />

        {/* What If Mode Banner — matches NHL exactly */}
        {whatIfMode && (
          <div
            className="mt-4 mb-4 p-3 rounded-lg border-2"
            style={{
              backgroundColor: `${team.colors.primary}15`,
              borderColor: team.colors.primary,
              color: team.colors.primary,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 flex-1 min-w-0">
                <span className="font-semibold text-sm md:text-base">What If Mode Active</span>
                <span className="text-xs md:text-sm opacity-80"><span className="hidden md:inline">- </span>Simulate pending games in the next 3 sets</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {hypotheticalResults.size > 0 && (
                  <button
                    onClick={handleSaveClick}
                    className="px-3 py-1 rounded text-sm font-semibold transition-all whitespace-nowrap text-white hover:opacity-90"
                    style={{ backgroundColor: team.colors.primary }}
                  >
                    Save Picks
                  </button>
                )}
                <button
                  onClick={() => setHypotheticalResults(new Map())}
                  className="px-3 py-1 rounded text-sm font-semibold transition-all whitespace-nowrap border-2 hover:opacity-80"
                  style={{ borderColor: team.colors.primary, color: team.colors.primary }}
                >
                  Reset
                </button>
              </div>
            </div>
            {/* Restore prompt: signed-in user with a previous save and a clean slate */}
            {latestSave && hypotheticalResults.size === 0 && (
              <div className="mt-2 pt-2 border-t border-current/20 flex items-center justify-between gap-2 text-xs md:text-sm">
                <span className="opacity-80 min-w-0 truncate">
                  You saved picks on {new Date(`${latestSave.savedDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({latestSave.summary.gamesPicked} games, {latestSave.summary.record})
                </span>
                <button
                  onClick={handleRestorePicks}
                  className="font-bold underline whitespace-nowrap hover:opacity-80"
                >
                  Load my last picks
                </button>
              </div>
            )}
            {user && (
              <div className="mt-1.5 text-xs opacity-70">
                <Link href="/account" className="underline hover:opacity-80">My Picks</Link>
              </div>
            )}
          </div>
        )}

        {/* Set Grid — matches NHL layout exactly */}
        <div className={`mb-4 ${whatIfMode ? '' : 'mt-4'}`}>
          <div className="flex justify-between items-center mb-3 gap-2">
            <h2
              className="text-lg md:text-2xl font-bold"
              style={{ color: team.colors.secondary !== '#FFFFFF' ? team.colors.secondary : '#111827' }}
            >
              Game Sets
            </h2>
            <div className="flex items-center gap-1.5 md:gap-3">
              {/* What If Toggle — matches NHL exactly */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <span
                  className={`text-xs md:text-sm font-semibold ${whatIfMode ? '' : 'text-gray-500'}`}
                  style={whatIfMode ? { color: team.colors.primary } : undefined}
                >
                  What If
                </span>
                <button
                  onClick={() => {
                    setWhatIfMode(!whatIfMode);
                    if (whatIfMode) setHypotheticalResults(new Map());
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    whatIfMode ? '' : 'bg-gray-400'
                  }`}
                  style={whatIfMode ? {
                    backgroundColor: team.colors.primary,
                    boxShadow: `0 0 0 2px ${team.colors.primary}`,
                  } : undefined}
                  role="switch"
                  aria-checked={whatIfMode}
                  title={whatIfMode ? 'Turn off What If Mode' : 'Turn on What If Mode'}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    whatIfMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Hide Completed Button — matches NHL exactly */}
              <button
                onClick={() => setHideCompleted(!hideCompleted)}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                  hideCompleted ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                style={hideCompleted ? { backgroundColor: team.colors.primary, color: '#FFFFFF' } : undefined}
              >
                <span className="hidden sm:inline">{hideCompleted ? 'Show All Sets' : 'Hide Completed Sets'}</span>
                <span className="sm:hidden">{hideCompleted ? 'Show All' : 'Hide Done'}</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {chunks
              .filter(chunk => !hideCompleted || !shouldHideCompletedSet(chunk))
              .map((chunk) => {
                const whatIfSets = getWhatIfSets();
                const isWhatIfSet = whatIfSets.some(set => set.chunkNumber === chunk.chunkNumber);

                return (
                  <MLBChunkCard
                    key={chunk.chunkNumber}
                    chunk={chunk}
                    teamColors={team.colors}
                    teamAbbrev={team.abbreviation}
                    whatIfMode={whatIfMode && isWhatIfSet}
                    onGameClick={handleGameClick}
                    hypotheticalResults={hypotheticalResults}
                  />
                );
              })}
          </div>

          {chunks.filter(chunk => !hideCompleted || !shouldHideCompletedSet(chunk)).length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No games scheduled yet for the 2026 season.</p>
            </div>
          )}
        </div>

        <div className="mt-8 max-w-2xl mx-auto">
          <GamePromo sport="mlb" />
        </div>

        {/* Footer — matches NHL */}
        <footer className="text-center text-sm mt-8 pb-8 text-gray-500">
          <p className="text-xs mb-2">
            Data provided by MLB Stats API | Updates automatically every minute
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
          reason="Create a free account to save your What-If picks and track your predictions over time."
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
          totalGames={MLB_TOTAL_GAMES}
        />
      )}
    </div>
  );
}
