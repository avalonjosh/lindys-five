import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

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
  goalDifferential?: number;
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
      const today = new Date().toISOString().split('T')[0];
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
        goalDifferential: team.goalDifferential || 0,
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

  // Get user's team position
  const userTeam = standings.find(t => t.teamAbbrev === teamAbbrev);

  // Filter standings by user's division
  const divisionTeams = standings
    .filter(t => t.divisionName === userTeamDivision)
    .sort((a, b) => a.divisionRank - b.divisionRank);

  // Get wild card teams in user's conference (teams ranked 4+ in their division)
  const wildcardTeams = standings
    .filter(t => t.conferenceName === userTeamConference && t.divisionRank > 3)
    .sort((a, b) => b.points - a.points || a.gamesPlayed - b.gamesPlayed)
    .slice(0, 4); // Top 4 wild card contenders

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
          expanded ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'
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
            {/* Division Standings */}
            <div>
              <h4
                className={`text-sm font-semibold mb-2 ${
                  isGoatMode ? 'text-zinc-300' : 'text-gray-700'
                }`}
              >
                {userTeamDivision} Division
              </h4>
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
          </div>
        )}
      </div>
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
  wildcardPosition
}: {
  team: StandingTeam;
  isUserTeam: boolean;
  isGoatMode: boolean;
  accentColor: string;
  showDivisionRank?: boolean;
  wildcardPosition?: number;
}) {
  const rank = showDivisionRank ? team.divisionRank : wildcardPosition;
  const inPlayoffPosition = showDivisionRank ? team.divisionRank <= 3 : (wildcardPosition && wildcardPosition <= 2);

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${
        isUserTeam
          ? isGoatMode
            ? 'bg-zinc-800'
            : 'bg-blue-50'
          : ''
      }`}
      style={isUserTeam ? {
        borderLeft: `3px solid ${accentColor}`
      } : undefined}
    >
      {/* Rank */}
      <span
        className={`w-5 text-center text-sm ${
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
        className={`w-10 text-sm font-semibold ${
          isUserTeam
            ? ''
            : isGoatMode ? 'text-zinc-300' : 'text-gray-700'
        }`}
        style={isUserTeam ? { color: accentColor } : undefined}
      >
        {team.teamAbbrev}
      </span>

      {/* Record */}
      <span
        className={`flex-1 text-xs ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}
      >
        {team.wins}-{team.losses}-{team.otLosses}
      </span>

      {/* Points */}
      <span
        className={`text-sm font-bold ${
          isUserTeam
            ? ''
            : isGoatMode ? 'text-zinc-200' : 'text-gray-800'
        }`}
        style={isUserTeam ? { color: accentColor } : undefined}
      >
        {team.points} pts
      </span>
    </div>
  );
}
