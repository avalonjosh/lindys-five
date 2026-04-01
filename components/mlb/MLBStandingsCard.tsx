'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { fetchMLBStandings, fetchMLBScores } from '@/lib/services/mlbApi';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import type { MLBStandingsTeam, MLBScoreGame } from '@/lib/types/mlb';

interface MLBStandingsCardProps {
  teamAbbrev: string;
  teamColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const DIVISIONS = [
  'American League East', 'American League Central', 'American League West',
  'National League East', 'National League Central', 'National League West',
];

const SHORT_DIVISION: Record<string, string> = {
  'American League East': 'AL East',
  'American League Central': 'AL Central',
  'American League West': 'AL West',
  'National League East': 'NL East',
  'National League Central': 'NL Central',
  'National League West': 'NL West',
};

function findSlug(abbrev: string): string | null {
  const team = Object.values(MLB_TEAMS).find(t => t.abbreviation === abbrev);
  return team?.id || null;
}

export default function MLBStandingsCard({ teamAbbrev, teamColors }: MLBStandingsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [standings, setStandings] = useState<MLBStandingsTeam[]>([]);
  const [todayGames, setTodayGames] = useState<MLBScoreGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'division' | 'wildcard'>('division');
  const [showLiveScores, setShowLiveScores] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  const showScoresView = showLiveScores || isDesktop;
  const accentColor = teamColors.primary;

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Find user's team in standings
  const userTeam = standings.find(s => s.teamAbbrev === teamAbbrev);
  const userDivision = userTeam?.division || '';
  const userLeague = userTeam?.league || '';

  const getPositionText = (): string => {
    if (!userTeam) return '';
    const divTeams = standings
      .filter(s => s.division === userTeam.division)
      .sort((a, b) => b.winPct - a.winPct);
    const rank = divTeams.findIndex(t => t.teamAbbrev === teamAbbrev) + 1;
    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
    const shortDiv = SHORT_DIVISION[userTeam.division] || userTeam.division;
    return `${rank}${suffix} in ${shortDiv}`;
  };

  useEffect(() => {
    if (expanded && standings.length === 0) {
      setLoading(true);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      Promise.all([
        fetchMLBStandings(),
        fetchMLBScores(today),
      ])
        .then(([standingsData, gamesData]) => {
          setStandings(standingsData);
          setTodayGames(gamesData);
          setError(null);
        })
        .catch(() => setError('Failed to load standings'))
        .finally(() => setLoading(false));
    }
  }, [expanded]);

  // Poll today's games for live updates
  useEffect(() => {
    if (!expanded || todayGames.length === 0) return;
    const hasLive = todayGames.some(g => g.gameState === 'In Progress');
    if (!hasLive) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const interval = setInterval(() => {
      fetchMLBScores(today).then(setTodayGames).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [expanded, todayGames.length]);

  // Build game lookup by team abbreviation
  const gamesByTeam = new Map<string, MLBScoreGame>();
  todayGames.forEach(game => {
    gamesByTeam.set(game.awayTeam.abbrev, game);
    gamesByTeam.set(game.homeTeam.abbrev, game);
  });

  return (
    <div className="rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 bg-white border-gray-200">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg md:text-xl font-bold" style={{ color: teamColors.primary }}>
            Standings
          </h3>
          {userTeam && !expanded && (
            <span className="text-sm font-medium ml-2 text-gray-600">
              ({getPositionText()})
            </span>
          )}
        </div>
        <ChevronDown
          size={20}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          style={{ color: accentColor }}
        />
      </button>

      {/* Expandable content — conditional rendering to avoid hidden overflow issues */}
      {expanded && (
        <div className="mt-4">
          {loading && (
            <div className="text-center py-4 text-gray-500">Loading standings...</div>
          )}

          {error && (
            <div className="text-center py-4 text-red-500">{error}</div>
          )}

          {!loading && !error && standings.length > 0 && (
            <div className="space-y-4">
              {/* View Mode Toggle + Scores Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('division')}
                    className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      viewMode === 'division' ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={viewMode === 'division' ? { backgroundColor: accentColor } : undefined}
                  >
                    Division
                  </button>
                  <button
                    onClick={() => setViewMode('wildcard')}
                    className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      viewMode === 'wildcard' ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={viewMode === 'wildcard' ? { backgroundColor: accentColor } : undefined}
                  >
                    Wild Card
                  </button>
                </div>

                {/* Scores Toggle - mobile only (desktop always shows) */}
                <button
                  onClick={() => setShowLiveScores(!showLiveScores)}
                  className="flex items-center gap-2 lg:hidden"
                >
                  <span className="text-xs font-semibold text-gray-500">Scores</span>
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      showLiveScores ? '' : 'bg-gray-300'
                    }`}
                    style={showLiveScores ? { backgroundColor: accentColor } : undefined}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      showLiveScores ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                </button>
              </div>

              {viewMode === 'division' && (
                <DivisionView
                  standings={standings}
                  teamAbbrev={teamAbbrev}
                  accentColor={accentColor}
                  userDivision={userDivision}
                  gamesByTeam={gamesByTeam}
                  showScoresView={showScoresView}
                />
              )}

              {viewMode === 'wildcard' && (
                <WildCardView
                  standings={standings}
                  teamAbbrev={teamAbbrev}
                  accentColor={accentColor}
                  userLeague={userLeague}
                  gamesByTeam={gamesByTeam}
                  showScoresView={showScoresView}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DivisionView({ standings, teamAbbrev, accentColor, userDivision, gamesByTeam, showScoresView }: {
  standings: MLBStandingsTeam[];
  teamAbbrev: string;
  accentColor: string;
  userDivision: string;
  gamesByTeam: Map<string, MLBScoreGame>;
  showScoresView: boolean;
}) {
  // Show user's division first
  const sortedDivisions = [...DIVISIONS].sort((a, b) => {
    if (a === userDivision) return -1;
    if (b === userDivision) return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {sortedDivisions.map(division => {
        const teams = standings
          .filter(s => s.division === division)
          .sort((a, b) => a.divisionRank - b.divisionRank || b.winPct - a.winPct);
        if (teams.length === 0) return null;

        return (
          <div key={division}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 px-2">
              {SHORT_DIVISION[division] || division}
            </h4>
            <StandingsHeader showScoresView={showScoresView} />
            {teams.map((team, idx) => (
              <TeamRow key={team.teamAbbrev} team={team} rank={idx + 1} isUserTeam={team.teamAbbrev === teamAbbrev} accentColor={accentColor} isEven={idx % 2 === 0} game={gamesByTeam.get(team.teamAbbrev)} showScoresView={showScoresView} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function WildCardView({ standings, teamAbbrev, accentColor, userLeague, gamesByTeam, showScoresView }: {
  standings: MLBStandingsTeam[];
  teamAbbrev: string;
  accentColor: string;
  userLeague: string;
  gamesByTeam: Map<string, MLBScoreGame>;
  showScoresView: boolean;
}) {
  const leagues = userLeague
    ? [userLeague, ...['American League', 'National League'].filter(l => l !== userLeague)]
    : ['American League', 'National League'];

  return (
    <div className="space-y-6">
      {leagues.map(league => {
        const leagueTeams = standings
          .filter(s => s.league === league)
          .sort((a, b) => b.winPct - a.winPct);

        // Top 3 division winners
        const divisionWinners = [...new Set(leagueTeams.map(t => t.division))]
          .map(div => leagueTeams.find(t => t.division === div && t.divisionRank === 1))
          .filter(Boolean) as MLBStandingsTeam[];
        divisionWinners.sort((a, b) => b.winPct - a.winPct);

        // Wild card contenders (non-division-winners sorted by record)
        const divWinnerAbbrevs = new Set(divisionWinners.map(t => t.teamAbbrev));
        const wcContenders = leagueTeams.filter(t => !divWinnerAbbrevs.has(t.teamAbbrev));

        const shortLeague = league === 'American League' ? 'AL' : 'NL';

        return (
          <div key={league}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 px-2">
              {shortLeague} Wild Card Race
            </h4>
            <StandingsHeader showScoresView={showScoresView} />
            {/* Division winners */}
            {divisionWinners.map((team, idx) => (
              <TeamRow key={team.teamAbbrev} team={team} rank={idx + 1} isUserTeam={team.teamAbbrev === teamAbbrev} accentColor={accentColor} isEven={idx % 2 === 0} badge="DIV" game={gamesByTeam.get(team.teamAbbrev)} showScoresView={showScoresView} />
            ))}
            {/* Wild card line */}
            {wcContenders.length > 0 && (
              <>
                {/* WC spots: 3 per league */}
                {wcContenders.slice(0, 3).map((team, idx) => (
                  <TeamRow key={team.teamAbbrev} team={team} rank={divisionWinners.length + idx + 1} isUserTeam={team.teamAbbrev === teamAbbrev} accentColor={accentColor} isEven={(divisionWinners.length + idx) % 2 === 0} badge={`WC${idx + 1}`} game={gamesByTeam.get(team.teamAbbrev)} showScoresView={showScoresView} />
                ))}
                {/* Playoff cutoff line */}
                <div className="border-t-2 border-dashed border-red-300 my-1 mx-2" />
                {/* Below the line */}
                {wcContenders.slice(3, 6).map((team, idx) => (
                  <TeamRow key={team.teamAbbrev} team={team} rank={divisionWinners.length + 3 + idx + 1} isUserTeam={team.teamAbbrev === teamAbbrev} accentColor={accentColor} isEven={(divisionWinners.length + 3 + idx) % 2 === 0} game={gamesByTeam.get(team.teamAbbrev)} showScoresView={showScoresView} />
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StandingsHeader({ showScoresView }: { showScoresView: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2 pb-1 text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wide">
      <span className="w-5 text-center">#</span>
      <span className="w-6" />
      <span className="w-14 min-w-[3.5rem]">Team</span>
      <span className="w-8 text-right">W</span>
      <span className="w-8 text-right">L</span>
      <span className="w-10 text-right">PCT</span>
      <span className="w-8 text-right">GB</span>
      <span className="w-12 text-right hidden sm:block">L10</span>
      <span className="w-14 text-right hidden lg:block">HOME</span>
      <span className="w-14 text-right hidden lg:block">AWAY</span>
      <span className="w-10 text-right hidden lg:block">RS</span>
      <span className="w-10 text-right hidden lg:block">RA</span>
      <span className="w-12 text-right hidden lg:block">DIFF</span>
      <span className="w-10 text-right hidden lg:block">WCGB</span>
      <span className="w-14 text-right hidden lg:block">xW-L</span>
      <span className="w-12 text-right hidden sm:block">STRK</span>
      <span className={`w-20 lg:w-28 text-center ${showScoresView ? '' : 'hidden lg:block'}`}>Today</span>
    </div>
  );
}

function TeamRow({ team, rank, isUserTeam, accentColor, isEven, badge, game, showScoresView }: {
  team: MLBStandingsTeam;
  rank: number;
  isUserTeam: boolean;
  accentColor: string;
  isEven: boolean;
  badge?: string;
  game?: MLBScoreGame;
  showScoresView?: boolean;
}) {
  const slug = findSlug(team.teamAbbrev);

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${
        isUserTeam ? 'bg-blue-50' : isEven ? 'bg-gray-50/50' : ''
      }`}
      style={isUserTeam ? {
        backgroundColor: `${accentColor}10`,
        borderLeft: `3px solid ${accentColor}`,
        paddingLeft: `calc(0.5rem - 3px)`,
      } : undefined}
    >
      <span className="w-5 text-center text-xs text-gray-400 font-medium">{rank}</span>
      <span className="w-6">
        {slug ? (
          <Link href={`/mlb/${slug}`}>
            <img src={team.teamLogo} alt={team.teamAbbrev} className="w-6 h-6 hover:scale-110 transition-transform" />
          </Link>
        ) : (
          <img src={team.teamLogo} alt={team.teamAbbrev} className="w-6 h-6" />
        )}
      </span>
      <span className={`w-14 min-w-[3.5rem] text-xs md:text-sm font-semibold ${isUserTeam ? '' : 'text-gray-800'}`} style={isUserTeam ? { color: accentColor } : undefined}>
        {team.teamAbbrev}
        {badge && (
          <span className="ml-1.5 text-[9px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
            {badge}
          </span>
        )}
      </span>
      <span className="w-8 text-right text-xs font-semibold text-gray-700">{team.wins}</span>
      <span className="w-8 text-right text-xs text-gray-500">{team.losses}</span>
      <span className="w-10 text-right text-xs font-semibold text-gray-700">
        .{(team.winPct * 1000).toFixed(0).padStart(3, '0')}
      </span>
      <span className="w-8 text-right text-xs text-gray-500">
        {team.gamesBack === 0 ? '—' : team.gamesBack.toFixed(1)}
      </span>
      <span className="w-12 text-right text-xs text-gray-500 hidden sm:block">
        {team.last10 || '—'}
      </span>
      <span className="w-14 text-right text-xs text-gray-500 hidden lg:block">
        {team.homeRecord || '—'}
      </span>
      <span className="w-14 text-right text-xs text-gray-500 hidden lg:block">
        {team.awayRecord || '—'}
      </span>
      <span className="w-10 text-right text-xs text-gray-500 hidden lg:block">
        {team.runsScored}
      </span>
      <span className="w-10 text-right text-xs text-gray-500 hidden lg:block">
        {team.runsAllowed}
      </span>
      <span className={`w-12 text-right text-xs font-semibold hidden lg:block ${
        team.runDifferential > 0 ? 'text-emerald-600' : team.runDifferential < 0 ? 'text-red-500' : 'text-gray-500'
      }`}>
        {team.runDifferential > 0 ? '+' : ''}{team.runDifferential}
      </span>
      <span className="w-10 text-right text-xs text-gray-500 hidden lg:block">
        {!team.wildCardGamesBack || team.wildCardGamesBack === 0 ? '—' : team.wildCardGamesBack.toFixed(1)}
      </span>
      <span className="w-14 text-right text-xs text-gray-500 hidden lg:block">
        {team.expectedWins || team.expectedLosses ? `${team.expectedWins}-${team.expectedLosses}` : '—'}
      </span>
      <span className="w-12 text-right text-xs text-gray-500 hidden sm:block">
        {team.streak || '—'}
      </span>
      {/* Today column */}
      <span className={`w-20 lg:w-28 text-center ${showScoresView ? '' : 'hidden lg:block'}`}>
        {game ? (() => {
          const isHome = game.homeTeam.abbrev === team.teamAbbrev;
          const opponent = isHome ? game.awayTeam : game.homeTeam;
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const oppScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          const isLive = game.gameState === 'In Progress';
          const isComplete = game.gameState === 'Final' || game.gameState === 'Completed Early';

          const content = (
            <div className="flex flex-col items-center">
              {isLive ? (
                <>
                  <span className="text-xs font-semibold flex items-center gap-1 text-green-600">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {game.inningHalf === 'Top' ? 'T' : 'B'}{game.inning}
                  </span>
                  <span className="text-xs text-gray-500">
                    {team.teamAbbrev} {teamScore}-{opponent.abbrev} {oppScore}
                  </span>
                </>
              ) : isComplete ? (
                <>
                  <span className="text-xs text-gray-500">
                    {team.teamAbbrev} {teamScore}-{opponent.abbrev} {oppScore}
                  </span>
                  <span className="text-[10px] text-gray-400">F</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-gray-500">{isHome ? 'vs' : '@'} {opponent.abbrev}</span>
                  <span className="text-[10px] text-gray-400">{game.startTime || 'TBD'}</span>
                </>
              )}
            </div>
          );

          if (game.gameId) {
            return <Link href={`/mlb/scores/${game.gameId}`} className="hover:underline">{content}</Link>;
          }
          return content;
        })() : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </span>
    </div>
  );
}
