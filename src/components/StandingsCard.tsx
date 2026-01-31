import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NHLGame } from '../types';
import { fetchScoresByDate } from '../services/nhlApi';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  cardBackground?: string;
  accent: string;
  border: string;
  text: string;
}

interface StandingTeam {
  teamAbbrev: string;
  teamName: string;
  teamLogo: string;
  points: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  divisionRank: number;
  conferenceRank: number;
  wildcardRank: number;
  divisionName: string;
  conferenceName: string;
  streakCode?: string;
  streakCount?: number;
  goalDifferential?: number;
  pointPctg?: number;
  // Additional stats for desktop view
  regulationWins: number;
  regulationPlusOtWins: number;
  goalsFor: number;
  goalsAgainst: number;
  homeWins: number;
  homeLosses: number;
  homeOtLosses: number;
  roadWins: number;
  roadLosses: number;
  roadOtLosses: number;
  l10Wins: number;
  l10Losses: number;
  l10OtLosses: number;
}

interface StandingsCardProps {
  teamAbbrev: string;
  isGoatMode: boolean;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
}

export default function StandingsCard({
  teamAbbrev,
  isGoatMode,
  teamColors,
  darkModeColors
}: StandingsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [standings, setStandings] = useState<StandingTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTeamDivision, setUserTeamDivision] = useState<string | null>(null);
  const [userTeamConference, setUserTeamConference] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'division' | 'wildcard'>('wildcard');
  const [sortBy, setSortBy] = useState<'points' | 'pointPctg'>('points');
  const [showLiveScores, setShowLiveScores] = useState(false);
  const [todayGames, setTodayGames] = useState<NHLGame[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  // Track screen size for responsive behavior
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // On desktop, always show scores view
  const showScoresView = showLiveScores || isDesktop;

  // Fetch standings when expanded
  useEffect(() => {
    if (expanded && standings.length === 0 && !loading) {
      fetchStandings();
    }
  }, [expanded]);

  const fetchStandings = async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const response = await fetch(`/api/v1/standings/${today}`);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data.standings || !Array.isArray(data.standings)) {
        throw new Error('Invalid standings data');
      }

      const parsedStandings: StandingTeam[] = data.standings.map((team: any) => ({
        teamAbbrev: team.teamAbbrev?.default || '',
        teamName: team.teamName?.default || team.teamCommonName?.default || '',
        teamLogo: team.teamLogo || `https://assets.nhle.com/logos/nhl/svg/${team.teamAbbrev?.default}_light.svg`,
        points: team.points || 0,
        gamesPlayed: team.gamesPlayed || 0,
        wins: team.wins || 0,
        losses: team.losses || 0,
        otLosses: team.otLosses || 0,
        divisionRank: team.divisionSequence || 0,
        conferenceRank: team.conferenceSequence || 0,
        wildcardRank: team.wildcardSequence || 0,
        divisionName: team.divisionName || '',
        conferenceName: team.conferenceName || '',
        streakCode: team.streakCode || '',
        streakCount: team.streakCount || 0,
        goalDifferential: team.goalDifferential || 0,
        pointPctg: team.pointPctg || 0,
        // Additional stats for desktop view
        regulationWins: team.regulationWins || 0,
        regulationPlusOtWins: team.regulationPlusOtWins || 0,
        goalsFor: team.goalFor || 0,
        goalsAgainst: team.goalAgainst || 0,
        homeWins: team.homeWins || 0,
        homeLosses: team.homeLosses || 0,
        homeOtLosses: team.homeOtLosses || 0,
        roadWins: team.roadWins || 0,
        roadLosses: team.roadLosses || 0,
        roadOtLosses: team.roadOtLosses || 0,
        l10Wins: team.l10Wins || 0,
        l10Losses: team.l10Losses || 0,
        l10OtLosses: team.l10OtLosses || 0,
      }));

      setStandings(parsedStandings);

      // Find user's team division and conference
      const userTeam = parsedStandings.find(t => t.teamAbbrev === teamAbbrev);
      if (userTeam) {
        setUserTeamDivision(userTeam.divisionName);
        setUserTeamConference(userTeam.conferenceName);
      }
    } catch (err) {
      console.error('Error fetching standings:', err);
      setError('Failed to load standings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch today's games for live scores view
  const fetchTodayGames = useCallback(async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const games = await fetchScoresByDate(today);
      setTodayGames(games);
    } catch (err) {
      console.error('Error fetching today\'s games:', err);
    }
  }, []);

  // Fetch games when standings is expanded (always needed for desktop, toggle-controlled for mobile)
  useEffect(() => {
    if (expanded) {
      fetchTodayGames();

      // Check if any games are live
      const hasLiveGames = todayGames.some(
        g => g.gameState === 'LIVE' || g.gameState === 'CRIT'
      );

      // Poll more frequently if there are live games
      const pollInterval = hasLiveGames ? 15000 : 60000;
      const interval = setInterval(fetchTodayGames, pollInterval);

      return () => clearInterval(interval);
    }
  }, [expanded, fetchTodayGames, todayGames.length]);

  // Create a lookup map for today's games by team abbreviation
  const gamesByTeam = new Map<string, NHLGame>();
  todayGames.forEach(game => {
    gamesByTeam.set(game.homeTeam.abbrev, game);
    gamesByTeam.set(game.awayTeam.abbrev, game);
  });

  // Get user's team position
  const userTeam = standings.find(t => t.teamAbbrev === teamAbbrev);

  // Sort function based on sortBy state
  const sortTeams = (a: StandingTeam, b: StandingTeam) => {
    if (sortBy === 'pointPctg') {
      return (b.pointPctg || 0) - (a.pointPctg || 0) || b.points - a.points;
    }
    return b.points - a.points || a.gamesPlayed - b.gamesPlayed;
  };

  // Filter standings by user's division
  const divisionTeams = standings
    .filter(t => t.divisionName === userTeamDivision)
    .sort(sortBy === 'points' ? (a, b) => a.divisionRank - b.divisionRank : sortTeams);

  // Get wild card teams in user's conference (teams ranked 4+ in their division)
  const wildcardTeams = standings
    .filter(t => t.conferenceName === userTeamConference && t.divisionRank > 3)
    .sort(sortTeams)
    .slice(0, 4); // Top 4 wild card contenders

  // Get all divisions in the user's conference (for wild card view)
  const conferenceDivisions = [...new Set(
    standings
      .filter(t => t.conferenceName === userTeamConference)
      .map(t => t.divisionName)
  )];

  // Get top 3 teams from each division in the conference
  const getDivisionTop3 = (divisionName: string) =>
    standings
      .filter(t => t.divisionName === divisionName)
      .sort(sortBy === 'points' ? (a, b) => a.divisionRank - b.divisionRank : sortTeams)
      .slice(0, 3);

  // Get all wild card contenders (teams ranked 4+ from both divisions in conference)
  const allWildcardTeams = standings
    .filter(t => t.conferenceName === userTeamConference && t.divisionRank > 3)
    .sort(sortTeams);

  // Accent color for highlights
  const accentColor = isGoatMode ? darkModeColors.accent : teamColors.primary;

  // Get position text
  const getPositionText = () => {
    if (!userTeam) return '';

    if (userTeam.divisionRank <= 3) {
      return `${userTeam.divisionRank}${getOrdinalSuffix(userTeam.divisionRank)} in ${userTeam.divisionName}`;
    } else if (userTeam.wildcardRank > 0 && userTeam.wildcardRank <= 2) {
      return `Wild Card ${userTeam.wildcardRank}`;
    } else {
      return `${userTeam.conferenceRank}${getOrdinalSuffix(userTeam.conferenceRank)} in ${userTeam.conferenceName}`;
    }
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return (
    <div
      className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 ${
        isGoatMode
          ? (darkModeColors.cardBackground ? '' : 'bg-zinc-900')
          : 'bg-white border-gray-200'
      }`}
      style={isGoatMode ? {
        backgroundColor: darkModeColors.cardBackground || darkModeColors.background,
        borderColor: darkModeColors.border
      } : undefined}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h3
            className={`text-lg md:text-xl font-bold ${
              isGoatMode ? '' : ''
            }`}
            style={isGoatMode
              ? { color: darkModeColors.accent }
              : { color: teamColors.primary }
            }
          >
            Standings
          </h3>
          {userTeam && !expanded && (
            <span
              className={`text-sm font-medium ml-2 ${
                isGoatMode ? 'text-zinc-400' : 'text-gray-600'
              }`}
            >
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

      {/* Expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? 'max-h-[900px] opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}
      >
        {loading && (
          <div className={`text-center py-4 ${isGoatMode ? 'text-zinc-400' : 'text-gray-500'}`}>
            Loading standings...
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && standings.length > 0 && (
          <div className="space-y-4">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('wildcard')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    viewMode === 'wildcard'
                      ? 'text-white'
                      : isGoatMode
                        ? 'text-zinc-400 hover:text-zinc-300'
                        : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={viewMode === 'wildcard' ? { backgroundColor: accentColor } : undefined}
                >
                  Wild Card
                </button>
                <button
                  onClick={() => setViewMode('division')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                    viewMode === 'division'
                      ? 'text-white'
                      : isGoatMode
                        ? 'text-zinc-400 hover:text-zinc-300'
                        : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={viewMode === 'division' ? { backgroundColor: accentColor } : undefined}
                >
                  Division
                </button>
              </div>

              {/* Scores Toggle - mobile only (desktop always shows scores) */}
              <button
                onClick={() => setShowLiveScores(!showLiveScores)}
                className="flex items-center gap-2 lg:hidden"
              >
                <span className={`text-xs font-semibold ${
                  isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
                  Scores
                </span>
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    showLiveScores
                      ? ''
                      : isGoatMode
                        ? 'bg-zinc-700'
                        : 'bg-gray-300'
                  }`}
                  style={showLiveScores ? { backgroundColor: accentColor } : undefined}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      showLiveScores ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* Division View */}
            {viewMode === 'division' && (
              <>
                {/* Division Standings */}
                <div>
                  <h4
                    className={`text-sm font-semibold mb-2 ${
                      isGoatMode ? 'text-zinc-300' : 'text-gray-700'
                    }`}
                  >
                    {userTeamDivision} Division
                  </h4>
                  {showScoresView ? (
                    <>
                      <ScoresHeader isGoatMode={isGoatMode} />
                      <div className="space-y-1">
                        {divisionTeams.map((team) => (
                          <ScoresRow
                            key={team.teamAbbrev}
                            team={team}
                            isUserTeam={team.teamAbbrev === teamAbbrev}
                            isGoatMode={isGoatMode}
                            accentColor={accentColor}
                            rank={team.divisionRank}
                            inPlayoffPosition={team.divisionRank <= 3}
                            game={gamesByTeam.get(team.teamAbbrev)}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <StandingsHeader isGoatMode={isGoatMode} sortBy={sortBy} onSortChange={setSortBy} accentColor={accentColor} />
                      <div className="space-y-1">
                        {divisionTeams.map((team) => (
                          <TeamRow
                            key={team.teamAbbrev}
                            team={team}
                            isUserTeam={team.teamAbbrev === teamAbbrev}
                            isGoatMode={isGoatMode}
                            accentColor={accentColor}
                            showDivisionRank
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Wild Card Race */}
                {wildcardTeams.length > 0 && (
                  <div>
                    <h4
                      className={`text-sm font-semibold mb-2 ${
                        isGoatMode ? 'text-zinc-300' : 'text-gray-700'
                      }`}
                    >
                      Wild Card Race
                    </h4>
                    {showScoresView ? (
                      <>
                        <ScoresHeader isGoatMode={isGoatMode} />
                        <div className="space-y-1">
                          {wildcardTeams.map((team, index) => (
                            <ScoresRow
                              key={team.teamAbbrev}
                              team={team}
                              isUserTeam={team.teamAbbrev === teamAbbrev}
                              isGoatMode={isGoatMode}
                              accentColor={accentColor}
                              rank={index + 1}
                              inPlayoffPosition={index < 2}
                              game={gamesByTeam.get(team.teamAbbrev)}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <StandingsHeader isGoatMode={isGoatMode} sortBy={sortBy} onSortChange={setSortBy} accentColor={accentColor} />
                        <div className="space-y-1">
                          {wildcardTeams.map((team, index) => (
                            <TeamRow
                              key={team.teamAbbrev}
                              team={team}
                              isUserTeam={team.teamAbbrev === teamAbbrev}
                              isGoatMode={isGoatMode}
                              accentColor={accentColor}
                              wildcardPosition={index + 1}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {wildcardTeams.length >= 2 && (
                      <div
                        className={`mt-2 text-xs ${
                          isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                        }`}
                      >
                        Top 2 wild cards make playoffs
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Wild Card View */}
            {viewMode === 'wildcard' && (
              <div className="space-y-4">
                {/* Both divisions in conference - top 3 from each */}
                {conferenceDivisions.map((divisionName) => (
                  <div key={divisionName}>
                    <h4
                      className={`text-sm font-semibold mb-2 ${
                        isGoatMode ? 'text-zinc-300' : 'text-gray-700'
                      }`}
                    >
                      {divisionName}
                    </h4>
                    {showScoresView ? (
                      <>
                        <ScoresHeader isGoatMode={isGoatMode} />
                        <div className="space-y-1">
                          {getDivisionTop3(divisionName).map((team) => (
                            <ScoresRow
                              key={team.teamAbbrev}
                              team={team}
                              isUserTeam={team.teamAbbrev === teamAbbrev}
                              isGoatMode={isGoatMode}
                              accentColor={accentColor}
                              rank={team.divisionRank}
                              inPlayoffPosition={team.divisionRank <= 3}
                              game={gamesByTeam.get(team.teamAbbrev)}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <StandingsHeader isGoatMode={isGoatMode} sortBy={sortBy} onSortChange={setSortBy} accentColor={accentColor} />
                        <div className="space-y-1">
                          {getDivisionTop3(divisionName).map((team) => (
                            <TeamRow
                              key={team.teamAbbrev}
                              team={team}
                              isUserTeam={team.teamAbbrev === teamAbbrev}
                              isGoatMode={isGoatMode}
                              accentColor={accentColor}
                              showDivisionRank
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Wild Card section - all teams ranked 4+ from both divisions */}
                {allWildcardTeams.length > 0 && (
                  <div>
                    <h4
                      className={`text-sm font-semibold mb-2 ${
                        isGoatMode ? 'text-zinc-300' : 'text-gray-700'
                      }`}
                    >
                      Wild Card
                    </h4>
                    {showScoresView ? (
                      <>
                        <ScoresHeader isGoatMode={isGoatMode} />
                        <div className="space-y-1">
                          {allWildcardTeams.map((team, index) => (
                            <div key={team.teamAbbrev}>
                              <ScoresRow
                                team={team}
                                isUserTeam={team.teamAbbrev === teamAbbrev}
                                isGoatMode={isGoatMode}
                                accentColor={accentColor}
                                rank={index + 1}
                                inPlayoffPosition={index < 2}
                                game={gamesByTeam.get(team.teamAbbrev)}
                              />
                              {/* Playoff cutoff line after position 2 */}
                              {index === 1 && (
                                <div
                                  className={`my-2 border-t-2 border-dashed ${
                                    isGoatMode ? 'border-zinc-600' : 'border-gray-300'
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <StandingsHeader isGoatMode={isGoatMode} sortBy={sortBy} onSortChange={setSortBy} accentColor={accentColor} />
                        <div className="space-y-1">
                          {allWildcardTeams.map((team, index) => (
                            <div key={team.teamAbbrev}>
                              <TeamRow
                                team={team}
                                isUserTeam={team.teamAbbrev === teamAbbrev}
                                isGoatMode={isGoatMode}
                                accentColor={accentColor}
                                wildcardPosition={index + 1}
                              />
                              {/* Playoff cutoff line after position 2 */}
                              {index === 1 && (
                                <div
                                  className={`my-2 border-t-2 border-dashed ${
                                    isGoatMode ? 'border-zinc-600' : 'border-gray-300'
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div
                      className={`mt-2 text-xs ${
                        isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                      }`}
                    >
                      Top 2 make playoffs
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Column header component
function StandingsHeader({
  isGoatMode,
  sortBy,
  onSortChange,
  accentColor
}: {
  isGoatMode: boolean;
  sortBy: 'points' | 'pointPctg';
  onSortChange: (sort: 'points' | 'pointPctg') => void;
  accentColor: string;
}) {
  const headerColor = isGoatMode ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className={`flex items-center gap-2 lg:gap-4 px-2 pb-1 text-xs font-medium ${headerColor}`} style={{ borderLeft: '3px solid transparent' }}>
      {/* Rank column */}
      <span className="w-5 text-center">#</span>
      {/* Logo spacer */}
      <span className="w-6"></span>
      {/* Team */}
      <span className="w-10 lg:w-12">Team</span>
      {/* W */}
      <span className="w-6 lg:w-8 text-right">W</span>
      {/* L */}
      <span className="w-6 lg:w-8 text-right">L</span>
      {/* OT */}
      <span className="w-6 lg:w-8 text-right">OT</span>
      {/* Desktop-only columns */}
      <span className="hidden lg:block w-10 text-right">RW</span>
      <span className="hidden lg:block w-12 text-right">ROW</span>
      <span className="hidden lg:block w-20 text-right">HOME</span>
      <span className="hidden lg:block w-20 text-right">AWAY</span>
      <span className="hidden lg:block w-10 text-right">GF</span>
      <span className="hidden lg:block w-10 text-right">GA</span>
      <span className="hidden lg:block w-12 text-right">DIFF</span>
      <span className="hidden lg:block w-20 text-right">L10</span>
      <span className="hidden lg:block w-12 text-right">STRK</span>
      {/* Spacer to push GP/PTS to right */}
      <span className="flex-1"></span>
      {/* GP */}
      <span className="w-8 lg:w-10 text-right">GP</span>
      {/* PTS - clickable */}
      <button
        onClick={() => onSortChange('points')}
        className={`w-8 lg:w-10 text-right cursor-pointer transition-colors ${
          sortBy === 'points' ? 'font-bold' : ''
        }`}
        style={sortBy === 'points' ? { color: accentColor } : undefined}
        title="Sort by Points"
      >
        PTS
      </button>
      {/* Points Percentage - clickable */}
      <button
        onClick={() => onSortChange('pointPctg')}
        className={`w-10 lg:w-12 text-right cursor-pointer transition-colors ${
          sortBy === 'pointPctg' ? 'font-bold' : ''
        }`}
        style={sortBy === 'pointPctg' ? { color: accentColor } : undefined}
        title="Sort by Points Percentage"
      >
        P%
      </button>
    </div>
  );
}

// Team row component
function TeamRow({
  team,
  isUserTeam,
  isGoatMode,
  accentColor,
  showDivisionRank,
  wildcardPosition,
  conferenceRank
}: {
  team: StandingTeam;
  isUserTeam: boolean;
  isGoatMode: boolean;
  accentColor: string;
  showDivisionRank?: boolean;
  wildcardPosition?: number;
  conferenceRank?: number;
}) {
  const rank = showDivisionRank ? team.divisionRank : (conferenceRank ?? wildcardPosition);
  const inPlayoffPosition = showDivisionRank
    ? team.divisionRank <= 3
    : conferenceRank
      ? conferenceRank <= 8
      : (wildcardPosition && wildcardPosition <= 2);

  return (
    <div
      className={`flex items-center gap-2 lg:gap-4 py-1.5 px-2 rounded-lg transition-colors ${
        isUserTeam
          ? isGoatMode
            ? 'bg-zinc-800'
            : 'bg-blue-50'
          : ''
      }`}
      style={{
        borderLeft: `3px solid ${isUserTeam ? accentColor : 'transparent'}`
      }}
    >
      {/* Rank */}
      <span
        className={`w-5 text-center text-sm tabular-nums ${
          inPlayoffPosition
            ? `font-bold ${isGoatMode ? 'text-zinc-200' : 'text-gray-800'}`
            : `font-normal ${isGoatMode ? 'text-zinc-500' : 'text-gray-400'}`
        }`}
      >
        {rank}
      </span>

      {/* Team logo */}
      <img
        src={team.teamLogo}
        alt={team.teamAbbrev}
        className="w-6 h-6 object-contain"
      />

      {/* Team abbrev */}
      <span
        className={`w-10 lg:w-12 text-sm font-semibold ${
          isUserTeam
            ? ''
            : isGoatMode ? 'text-zinc-300' : 'text-gray-700'
        }`}
        style={isUserTeam ? { color: accentColor } : undefined}
      >
        {team.teamAbbrev}
      </span>

      {/* Wins */}
      <span
        className={`w-6 lg:w-8 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.wins}
      </span>

      {/* Losses */}
      <span
        className={`w-6 lg:w-8 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.losses}
      </span>

      {/* OT Losses */}
      <span
        className={`w-6 lg:w-8 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.otLosses}
      </span>

      {/* Desktop-only columns */}
      {/* Regulation Wins */}
      <span
        className={`hidden lg:block w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.regulationWins}
      </span>

      {/* Regulation + OT Wins */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.regulationPlusOtWins}
      </span>

      {/* Home Record */}
      <span
        className={`hidden lg:block w-20 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.homeWins}-{team.homeLosses}-{team.homeOtLosses}
      </span>

      {/* Away Record */}
      <span
        className={`hidden lg:block w-20 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.roadWins}-{team.roadLosses}-{team.roadOtLosses}
      </span>

      {/* Goals For */}
      <span
        className={`hidden lg:block w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.goalsFor}
      </span>

      {/* Goals Against */}
      <span
        className={`hidden lg:block w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.goalsAgainst}
      </span>

      {/* Goal Differential */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {(team.goalDifferential || 0) > 0 ? '+' : ''}{team.goalDifferential}
      </span>

      {/* Last 10 Games */}
      <span
        className={`hidden lg:block w-20 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.l10Wins}-{team.l10Losses}-{team.l10OtLosses}
      </span>

      {/* Streak */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.streakCode ? `${team.streakCode}${team.streakCount || ''}` : '-'}
      </span>

      {/* Spacer to push GP/PTS to right */}
      <span className="flex-1"></span>

      {/* Games Played */}
      <span
        className={`w-8 lg:w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-500' : 'text-gray-400'
        }`}
      >
        {team.gamesPlayed}
      </span>

      {/* Points */}
      <span
        className={`w-8 lg:w-10 text-right text-sm font-bold tabular-nums ${
          isUserTeam
            ? ''
            : isGoatMode ? 'text-zinc-200' : 'text-gray-800'
        }`}
        style={isUserTeam ? { color: accentColor } : undefined}
      >
        {team.points}
      </span>

      {/* Points Percentage */}
      <span
        className={`w-10 lg:w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.pointPctg ? `.${Math.round(team.pointPctg * 1000).toString().padStart(3, '0')}` : '-'}
      </span>
    </div>
  );
}

// Simplified header for live scores view
function ScoresHeader({ isGoatMode }: { isGoatMode: boolean }) {
  const headerColor = isGoatMode ? 'text-zinc-500' : 'text-gray-400';

  return (
    <div className={`flex items-center gap-2 lg:gap-4 px-2 pb-1 text-xs font-medium ${headerColor}`} style={{ borderLeft: '3px solid transparent' }}>
      <span className="w-5 text-center">#</span>
      <span className="w-6"></span>
      <span className="w-10 lg:w-12">Team</span>
      <span className="w-6 lg:w-8 text-right">W</span>
      <span className="w-6 lg:w-8 text-right">L</span>
      <span className="w-6 lg:w-8 text-right">OT</span>
      {/* Desktop-only columns */}
      <span className="hidden lg:block w-10 text-right">RW</span>
      <span className="hidden lg:block w-12 text-right">ROW</span>
      <span className="hidden lg:block w-20 text-right">HOME</span>
      <span className="hidden lg:block w-20 text-right">AWAY</span>
      <span className="hidden lg:block w-10 text-right">GF</span>
      <span className="hidden lg:block w-10 text-right">GA</span>
      <span className="hidden lg:block w-12 text-right">DIFF</span>
      <span className="hidden lg:block w-20 text-right">L10</span>
      <span className="hidden lg:block w-12 text-right">STRK</span>
      <span className="flex-1"></span>
      <span className="w-6 lg:w-10 text-right">GP</span>
      <span className="w-8 lg:w-10 text-right">PTS</span>
      <span className="hidden lg:block w-12 text-right">P%</span>
      <span className="w-24 lg:w-28 text-center">Tonight</span>
    </div>
  );
}

// Format start time in Eastern timezone
const formatStartTime = (utcTime: string): string => {
  const date = new Date(utcTime);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Get game status display
const getGameStatusDisplay = (game: NHLGame, teamAbbrev: string): { text: string; isLive: boolean; score?: string } => {
  const isHome = game.homeTeam.abbrev === teamAbbrev;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
  const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;

  if (game.gameState === 'LIVE' || game.gameState === 'CRIT') {
    const period = game.periodDescriptor?.number || game.period;
    let periodText = '';
    if (game.periodDescriptor?.periodType === 'OT') {
      periodText = 'OT';
    } else if (game.periodDescriptor?.periodType === 'SO') {
      periodText = 'SO';
    } else if (period) {
      periodText = period === 1 ? '1st' : period === 2 ? '2nd' : period === 3 ? '3rd' : `${period}th`;
    }
    const timeText = game.clock?.inIntermission ? 'INT' : game.clock?.timeRemaining || '';
    return {
      text: `${isHome ? 'vs' : '@'} ${opponent.abbrev}`,
      isLive: true,
      score: `${teamScore}-${opponentScore} ${periodText} ${timeText}`.trim()
    };
  }

  if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
    const periodType = game.gameOutcome?.lastPeriodType;
    const suffix = periodType === 'OT' ? '/OT' : periodType === 'SO' ? '/SO' : '';
    return {
      text: `${isHome ? 'vs' : '@'} ${opponent.abbrev}`,
      isLive: false,
      score: `${teamScore}-${opponentScore} F${suffix}`
    };
  }

  // Future game
  const timeStr = game.startTimeUTC ? formatStartTime(game.startTimeUTC) : 'TBD';
  return {
    text: `${isHome ? 'vs' : '@'} ${opponent.abbrev}`,
    isLive: false,
    score: timeStr
  };
};

// Simplified team row for live scores view
function ScoresRow({
  team,
  isUserTeam,
  isGoatMode,
  accentColor,
  rank,
  inPlayoffPosition,
  game
}: {
  team: StandingTeam;
  isUserTeam: boolean;
  isGoatMode: boolean;
  accentColor: string;
  rank: number;
  inPlayoffPosition: boolean;
  game: NHLGame | undefined;
}) {
  const gameStatus = game ? getGameStatusDisplay(game, team.teamAbbrev) : null;

  return (
    <div
      className={`flex items-center gap-2 lg:gap-4 py-1.5 px-2 rounded-lg transition-colors ${
        isUserTeam
          ? isGoatMode
            ? 'bg-zinc-800'
            : 'bg-blue-50'
          : ''
      }`}
      style={{
        borderLeft: `3px solid ${isUserTeam ? accentColor : 'transparent'}`
      }}
    >
      {/* Rank */}
      <span
        className={`w-5 text-center text-sm tabular-nums ${
          inPlayoffPosition
            ? `font-bold ${isGoatMode ? 'text-zinc-200' : 'text-gray-800'}`
            : `font-normal ${isGoatMode ? 'text-zinc-500' : 'text-gray-400'}`
        }`}
      >
        {rank}
      </span>

      {/* Team logo */}
      <img
        src={team.teamLogo}
        alt={team.teamAbbrev}
        className="w-6 h-6 object-contain"
      />

      {/* Team abbrev */}
      <span
        className={`w-10 lg:w-12 text-sm font-semibold ${
          isUserTeam
            ? ''
            : isGoatMode ? 'text-zinc-300' : 'text-gray-700'
        }`}
        style={isUserTeam ? { color: accentColor } : undefined}
      >
        {team.teamAbbrev}
      </span>

      {/* Wins */}
      <span
        className={`w-6 lg:w-8 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.wins}
      </span>

      {/* Losses */}
      <span
        className={`w-6 lg:w-8 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.losses}
      </span>

      {/* OT Losses */}
      <span
        className={`w-6 lg:w-8 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.otLosses}
      </span>

      {/* Desktop-only columns */}
      {/* Regulation Wins */}
      <span
        className={`hidden lg:block w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.regulationWins}
      </span>

      {/* Regulation + OT Wins */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.regulationPlusOtWins}
      </span>

      {/* Home Record */}
      <span
        className={`hidden lg:block w-20 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.homeWins}-{team.homeLosses}-{team.homeOtLosses}
      </span>

      {/* Away Record */}
      <span
        className={`hidden lg:block w-20 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.roadWins}-{team.roadLosses}-{team.roadOtLosses}
      </span>

      {/* Goals For */}
      <span
        className={`hidden lg:block w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.goalsFor}
      </span>

      {/* Goals Against */}
      <span
        className={`hidden lg:block w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.goalsAgainst}
      </span>

      {/* Goal Differential */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {(team.goalDifferential || 0) > 0 ? '+' : ''}{team.goalDifferential}
      </span>

      {/* Last 10 Games */}
      <span
        className={`hidden lg:block w-20 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.l10Wins}-{team.l10Losses}-{team.l10OtLosses}
      </span>

      {/* Streak */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.streakCode ? `${team.streakCode}${team.streakCount || ''}` : '-'}
      </span>

      {/* Spacer */}
      <span className="flex-1"></span>

      {/* Games Played */}
      <span
        className={`w-6 lg:w-10 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-500' : 'text-gray-400'
        }`}
      >
        {team.gamesPlayed}
      </span>

      {/* Points */}
      <span
        className={`w-8 lg:w-10 text-right text-sm font-bold tabular-nums ${
          isUserTeam
            ? ''
            : isGoatMode ? 'text-zinc-200' : 'text-gray-800'
        }`}
        style={isUserTeam ? { color: accentColor } : undefined}
      >
        {team.points}
      </span>

      {/* Points Percentage - desktop only */}
      <span
        className={`hidden lg:block w-12 text-right text-xs tabular-nums ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.pointPctg ? `.${Math.round(team.pointPctg * 1000).toString().padStart(3, '0')}` : '-'}
      </span>

      {/* Tonight's game info */}
      <div className="w-24 lg:w-28 text-center">
        {gameStatus ? (
          <div className="flex flex-col items-center">
            <span className={`text-xs ${isGoatMode ? 'text-zinc-400' : 'text-gray-500'}`}>
              {gameStatus.text}
            </span>
            <span className={`text-xs font-semibold flex items-center gap-1 ${
              gameStatus.isLive
                ? 'text-red-500'
                : isGoatMode ? 'text-zinc-300' : 'text-gray-700'
            }`}>
              {gameStatus.isLive && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              {gameStatus.score}
            </span>
          </div>
        ) : (
          <span className={`text-xs ${isGoatMode ? 'text-zinc-500' : 'text-gray-400'}`}>
            —
          </span>
        )}
      </div>
    </div>
  );
}
