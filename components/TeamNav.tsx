'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import { fetchTeamStandings, type TeamStandings } from '@/lib/services/nhlApi';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import type { MLBStandingsTeam } from '@/lib/types/mlb';
import AboutModal from './AboutModal';

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  accent: string;
  border: string;
  text: string;
}

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface TeamNavProps {
  currentTeamId: string;
  isGoatMode: boolean;
  darkModeColors: DarkModeColors;
  teamColors: TeamColors;
  refreshTrigger?: number; // Timestamp to trigger refresh
}

export default function TeamNav({ currentTeamId, isGoatMode, darkModeColors, teamColors, refreshTrigger }: TeamNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('favorite-teams');
    return saved ? JSON.parse(saved) : [];
  });
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return { 'Atlantic Division': true, 'Metropolitan Division': true };
    const saved = localStorage.getItem('expanded-divisions');
    return saved ? JSON.parse(saved) : {
      'Atlantic Division': true,
      'Metropolitan Division': true,
    };
  });
  const [teamStandings, setTeamStandings] = useState<Map<string, TeamStandings>>(new Map());
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [activeTab, setActiveTab] = useState<'nhl' | 'mlb'>('nhl');
  const [mlbStandings, setMlbStandings] = useState<MLBStandingsTeam[]>([]);
  const [nhlPlayoffsActive, setNhlPlayoffsActive] = useState(false);
  const [mlbExpandedDivisions, setMlbExpandedDivisions] = useState<Record<string, boolean>>({
    'AL East': true, 'NL East': true,
  });
  const router = useRouter();

  // For vintage Jets (dark mode), use classic sidebar styling
  const useClassicStyling = currentTeamId === 'jets' && isGoatMode ? false : isGoatMode;

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favorite-teams', JSON.stringify(favorites));
  }, [favorites]);

  // Detect whether the NHL playoffs are currently active — used to hide the redundant
  // "Playoff Odds" nav item once the full bracket/odds/schedule page has gone live.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/playoffs/bracket')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        interface BracketRoundLite { series?: Array<unknown> }
        const rounds = (data?.bracket?.rounds || []) as BracketRoundLite[];
        const hasSeries = rounds.some((r) => (r.series?.length || 0) > 0);
        setNhlPlayoffsActive(hasSeries);
      })
      .catch(() => {
        /* silent — assume not in playoffs */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save expanded divisions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('expanded-divisions', JSON.stringify(expandedDivisions));
  }, [expandedDivisions]);

  // Fetch team standings when menu opens or when refresh is triggered
  useEffect(() => {
    const fetchAllStandings = async () => {
      // Fetch if menu is open and not currently loading
      // Also fetch on initial open (teamStandings.size === 0) or when refreshTrigger changes
      if (isOpen && !loadingStandings) {
        setLoadingStandings(true);
        const standingsMap = new Map<string, TeamStandings>();

        try {
          // Get today's date in YYYY-MM-DD format
          const today = new Date().toISOString().split('T')[0];

          // Fetch all standings at once from the NHL API with today's date
          let response = await fetch(`/api/v1/standings/${today}`);

          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }

          let data = await response.json();

          // Post-regular-season dates return an empty array — fall back to /standings/now
          if (Array.isArray(data?.standings) && data.standings.length === 0) {
            response = await fetch(`/api/v1/standings/now`);
            if (response.ok) {
              data = await response.json();
            }
          }

          console.log('📊 Standings API response:', data);

          if (data.standings) {
            // Map each team's standings data
            const allTeams = Object.values(TEAMS);
            allTeams.forEach((team) => {
              const standing = data.standings.find((s: any) =>
                s.teamAbbrev?.default === team.abbreviation
              );

              if (standing) {
                console.log(`📊 Found standing for ${team.abbreviation}:`, {
                  points: standing.points,
                  divisionSequence: standing.divisionSequence
                });
                standingsMap.set(team.id, {
                  teamId: team.nhlId,
                  teamAbbrev: team.abbreviation,
                  points: standing.points || 0,
                  gamesPlayed: standing.gamesPlayed || 0,
                  wins: standing.wins || 0,
                  losses: standing.losses || 0,
                  otLosses: standing.otLosses || 0,
                  divisionSequence: standing.divisionSequence
                });
              }
            });

            console.log('📊 Final standingsMap size:', standingsMap.size);

            // Only update standings if we successfully fetched data
            if (standingsMap.size > 0) {
              setTeamStandings(standingsMap);
            } else {
              console.warn('⚠️ No standings data found, keeping existing data');
            }
          } else {
            throw new Error('Invalid standings API response');
          }
        } catch (error) {
          console.error('❌ Error fetching standings:', error);

          // Fallback: Try individual team fetches, but only if we don't have existing data
          if (teamStandings.size === 0) {
            console.log('📊 Attempting fallback: fetching standings individually');
            try {
              const allTeams = Object.values(TEAMS);
              const promises = allTeams.map(async (team) => {
                const standings = await fetchTeamStandings(team.abbreviation, team.nhlId);
                if (standings) {
                  standingsMap.set(team.id, standings);
                }
              });
              await Promise.all(promises);

              if (standingsMap.size > 0) {
                setTeamStandings(standingsMap);
                console.log('✅ Fallback successful, fetched', standingsMap.size, 'team standings');
              }
            } catch (fallbackError) {
              console.error('❌ Fallback fetch also failed:', fallbackError);
              // Keep existing standings data - don't clear it
            }
          } else {
            console.log('⚠️ Keeping existing standings data due to API error');
          }
        }

        setLoadingStandings(false);
      }
    };

    fetchAllStandings();
  }, [isOpen, refreshTrigger]);

  // Fetch MLB standings when MLB tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'mlb' && mlbStandings.length === 0) {
      fetchMLBStandings().then(setMlbStandings).catch(() => {});
    }
  }, [isOpen, activeTab]);

  const MLB_DIVISIONS: Record<string, string[]> = {
    'AL East': ['orioles', 'redsox', 'yankees', 'rays', 'bluejays'],
    'AL Central': ['whitesox', 'guardians', 'tigers', 'royals', 'twins'],
    'AL West': ['astros', 'angels', 'athletics', 'mariners', 'txrangers'],
    'NL East': ['braves', 'marlins', 'mets', 'phillies', 'nationals'],
    'NL Central': ['cubs', 'reds', 'brewers', 'pirates', 'cardinals'],
    'NL West': ['diamondbacks', 'rockies', 'dodgers', 'padres', 'giants'],
  };

  const getMLBStanding = (teamId: string) => {
    const team = MLB_TEAMS[teamId];
    if (!team) return null;
    return mlbStandings.find(s => s.teamAbbrev === team.abbreviation) || null;
  };

  const sortMLBByWins = (teamIds: string[]) => {
    return [...teamIds].sort((a, b) => {
      const aS = getMLBStanding(a);
      const bS = getMLBStanding(b);
      if (!aS || !bS) return 0;
      return bS.wins - aS.wins;
    });
  };

  const toggleMlbDivision = (division: string) => {
    setMlbExpandedDivisions(prev => ({ ...prev, [division]: !prev[division] }));
  };

  const mlbFavorites = favorites.filter(id => MLB_TEAMS[id]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const toggleFavorite = (teamId: string) => {
    setFavorites(prev => {
      const wasAlreadyFavorite = prev.includes(teamId);
      const next = wasAlreadyFavorite
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId];

      // Dispatch event when a team is starred (not un-starred)
      // Deferred to avoid setState-during-render warning
      if (!wasAlreadyFavorite) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('team-starred', { detail: { teamId } }));
        }, 0);
      }

      return next;
    });
  };

  const toggleDivision = (division: string) => {
    setExpandedDivisions(prev => ({
      ...prev,
      [division]: !prev[division]
    }));
  };

  // Sort function for teams by points
  const sortTeamsByPoints = (teams: typeof TEAMS[keyof typeof TEAMS][]) => {
    return [...teams].sort((a, b) => {
      const aStandings = teamStandings.get(a.id);
      const bStandings = teamStandings.get(b.id);

      // If standings not loaded yet, maintain original order
      if (!aStandings || !bStandings) return 0;

      // If divisionSequence is available, use it (lower is better - 1st place = 1)
      if (aStandings.divisionSequence !== undefined && bStandings.divisionSequence !== undefined) {
        return aStandings.divisionSequence - bStandings.divisionSequence;
      }

      // Fallback: Sort by points (descending), then alphabetically by city
      if (bStandings.points !== aStandings.points) {
        return bStandings.points - aStandings.points;
      }
      return a.city.localeCompare(b.city);
    });
  };

  // Organize teams by division (will be sorted by points when displayed)
  const divisions = {
    'Atlantic Division': [
      TEAMS.bruins,      // Boston
      TEAMS.sabres,      // Buffalo
      TEAMS.redwings,    // Detroit
      TEAMS.panthers,    // Florida
      TEAMS.canadiens,   // Montreal
      TEAMS.senators,    // Ottawa
      TEAMS.lightning,   // Tampa Bay
      TEAMS.mapleleafs,  // Toronto
      // Add more Atlantic teams here
    ],
    'Metropolitan Division': [
      TEAMS.hurricanes,   // Carolina
      TEAMS.bluejackets,  // Columbus
      TEAMS.devils,       // New Jersey
      TEAMS.islanders,    // New York (Islanders)
      TEAMS.rangers,      // New York (Rangers)
      TEAMS.flyers,       // Philadelphia
      TEAMS.penguins,     // Pittsburgh
      TEAMS.capitals,     // Washington
    ],
    'Central Division': [
      TEAMS.blackhawks,   // Chicago
      TEAMS.avalanche,    // Colorado
      TEAMS.stars,        // Dallas
      TEAMS.wild,         // Minnesota
      TEAMS.predators,    // Nashville
      TEAMS.blues,        // St. Louis
      TEAMS.utah,         // Utah
      TEAMS.jets,         // Winnipeg
    ],
    'Pacific Division': [
      TEAMS.ducks,         // Anaheim
      TEAMS.flames,        // Calgary
      TEAMS.oilers,        // Edmonton
      TEAMS.kings,         // Los Angeles
      TEAMS.sharks,        // San Jose
      TEAMS.kraken,        // Seattle
      TEAMS.canucks,       // Vancouver
      TEAMS.goldenknights, // Vegas
    ],
  };

  // Get all teams as a flat array
  const allTeams = Object.values(divisions).flat();

  // Get favorite teams
  const favoriteTeams = allTeams.filter(team => favorites.includes(team.id));

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center justify-center p-1 transition-all focus:outline-none"
        aria-label="Open teams menu"
        title="Teams"
      >
        <svg
          className="w-6 h-6 md:w-7 md:h-7"
          fill="none"
          stroke="white"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] z-50 transform transition-transform duration-300 ease-in-out border-r-2 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          useClassicStyling
            ? ''
            : 'bg-white border-blue-300'
        }`}
        style={useClassicStyling ? {
          backgroundColor: darkModeColors.background,
          borderRightColor: darkModeColors.border
        } : undefined}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-4 border-b-2 ${
            useClassicStyling ? 'border-zinc-800' : 'border-gray-200'
          }`} style={{ background: useClassicStyling ? darkModeColors.background : '#003087' }}>
            <button
              onClick={() => handleNavigation('/')}
              className="w-full text-center text-2xl font-bold text-white hover:text-white/80 transition-colors"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </button>
          </div>

          {/* Navigation List */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Sport Tabs */}
            <div className={`flex rounded-lg p-1 mb-4 ${
              useClassicStyling ? 'bg-zinc-800' : 'bg-gray-100'
            }`}>
              <button
                onClick={() => setActiveTab('nhl')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === 'nhl'
                    ? useClassicStyling
                      ? 'bg-zinc-600 text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : useClassicStyling
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <img src={`https://assets.nhle.com/logos/nhl/svg/NHL_${useClassicStyling ? 'light' : 'dark'}.svg`} alt="NHL" className="w-5 h-5" />
                NHL
              </button>
              <button
                onClick={() => setActiveTab('mlb')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === 'mlb'
                    ? useClassicStyling
                      ? 'bg-zinc-600 text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : useClassicStyling
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <img src={`https://www.mlbstatic.com/team-logos/${useClassicStyling ? 'league-on-dark' : 'league-on-light'}/1.svg`} alt="MLB" className="w-4 h-4" />
                MLB
              </button>
            </div>

            {/* NHL Nav Links */}
            {activeTab === 'nhl' && (
              <>
                <button
                  onClick={() => handleNavigation('/nhl/scores')}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                    useClassicStyling ? 'hover:bg-zinc-800 text-white' : 'hover:bg-blue-50 text-gray-900'
                  }`}
                >
                  Scores
                </button>
                {!nhlPlayoffsActive && (
                  <button
                    onClick={() => handleNavigation('/nhl-playoff-odds')}
                    className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                      useClassicStyling ? 'hover:bg-zinc-800 text-white' : 'hover:bg-blue-50 text-gray-900'
                    }`}
                  >
                    Playoff Odds
                  </button>
                )}
                <button
                  onClick={() => handleNavigation('/playoffs')}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                    useClassicStyling ? 'hover:bg-zinc-800 text-white' : 'hover:bg-blue-50 text-gray-900'
                  }`}
                >
                  Playoff Bracket
                </button>
              </>
            )}

            {/* MLB Nav Links */}
            {activeTab === 'mlb' && (
              <>
                <button
                  onClick={() => handleNavigation('/mlb/scores')}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                    useClassicStyling ? 'hover:bg-zinc-800 text-white' : 'hover:bg-blue-50 text-gray-900'
                  }`}
                >
                  Scores
                </button>
                <button
                  onClick={() => handleNavigation('/mlb/playoff-odds')}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                    useClassicStyling ? 'hover:bg-zinc-800 text-white' : 'hover:bg-blue-50 text-gray-900'
                  }`}
                >
                  Playoff Odds
                </button>
              </>
            )}

            {/* Divider */}
            <div className={`my-4 border-t ${
              useClassicStyling ? 'border-zinc-800' : 'border-gray-200'
            }`} />

            {/* NHL Teams */}
            {activeTab === 'nhl' && (
              <>
                {/* Favorite Teams Section */}
                {favoriteTeams.length > 0 && (
                  <div className="mb-6">
                    <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 px-4 ${
                      useClassicStyling ? 'text-zinc-500' : 'text-gray-500'
                    }`}>
                      Favorite Teams
                    </h3>
                    <div className="space-y-1">
                      {sortTeamsByPoints(favoriteTeams).map((team) => {
                        const isActive = team.id === currentTeamId;
                        const isFavorite = favorites.includes(team.id);
                        return (
                          <div key={team.id} className="relative group">
                            <button
                              onClick={() => handleNavigation(`/nhl/${team.slug}`)}
                              className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                                isActive
                                  ? useClassicStyling
                                    ? 'bg-red-900/50 text-red-400 border-2 border-red-600'
                                    : 'bg-blue-100 border-2'
                                  : useClassicStyling
                                    ? 'hover:bg-zinc-800 text-zinc-300'
                                    : 'hover:bg-gray-100 text-gray-700'
                              }`}
                              style={isActive && !isGoatMode ? {
                                backgroundColor: `${team.colors.primary}15`,
                                borderColor: team.colors.primary,
                                color: team.colors.primary
                              } : undefined}
                            >
                              <img
                                src={team.logo}
                                alt={`${team.city} ${team.name}`}
                                className="w-8 h-8 object-contain flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold truncate">{team.city} {team.name}</div>
                                <div className={`text-xs flex items-center gap-1.5 ${
                                  isActive
                                    ? useClassicStyling ? 'text-red-300' : 'opacity-70'
                                    : useClassicStyling ? 'text-zinc-500' : 'text-gray-500'
                                }`}>
                                  <span>{team.abbreviation}</span>
                                  {teamStandings.get(team.id) && (
                                    <>
                                      <span>•</span>
                                      <span className="font-extrabold">
                                        {teamStandings.get(team.id)!.points} pts
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {teamStandings.get(team.id)!.gamesPlayed} gp
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(team.id);
                              }}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                                isFavorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                              } ${
                                useClassicStyling
                                  ? 'hover:bg-zinc-700'
                                  : 'hover:bg-gray-200'
                              }`}
                              title="Remove from favorites"
                            >
                              <svg
                                className={`w-5 h-5 ${
                                  isFavorite
                                    ? useClassicStyling ? 'text-yellow-400' : 'text-yellow-500'
                                    : useClassicStyling ? 'text-zinc-600' : 'text-gray-400'
                                }`}
                                fill={isFavorite ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth={isFavorite ? 0 : 2}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`my-4 border-t ${
                      isGoatMode ? 'border-zinc-800' : 'border-gray-200'
                    }`} />
                  </div>
                )}

                {/* NHL Teams by Division */}
                {Object.entries(divisions).map(([division, teams]) => {
                  const isExpanded = expandedDivisions[division] ?? true;
                  return (
                    <div key={division} className="mb-6">
                      <button
                        onClick={() => toggleDivision(division)}
                        className={`w-full flex items-center justify-between px-4 py-2 mb-2 rounded-lg transition-colors ${
                          useClassicStyling
                            ? 'hover:bg-zinc-800 text-zinc-500'
                            : 'hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        <h3 className="text-xs font-bold uppercase tracking-wide">
                          {division}
                        </h3>
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="space-y-1">
                          {sortTeamsByPoints(teams).map((team) => {
                            const isActive = team.id === currentTeamId;
                            const isFavorite = favorites.includes(team.id);
                            return (
                              <div key={team.id} className="relative group">
                                <button
                                  onClick={() => handleNavigation(`/nhl/${team.slug}`)}
                                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                                    isActive
                                      ? useClassicStyling
                                        ? 'bg-red-900/50 text-red-400 border-2 border-red-600'
                                        : 'bg-blue-100 border-2'
                                      : useClassicStyling
                                        ? 'hover:bg-zinc-800 text-zinc-300'
                                        : 'hover:bg-gray-100 text-gray-700'
                                  }`}
                                  style={isActive && !isGoatMode ? {
                                    backgroundColor: `${team.colors.primary}15`,
                                    borderColor: team.colors.primary,
                                    color: team.colors.primary
                                  } : undefined}
                                >
                                  <img
                                    src={team.logo}
                                    alt={`${team.city} ${team.name}`}
                                    className="w-8 h-8 object-contain flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold truncate">{team.city} {team.name}</div>
                                    <div className={`text-xs flex items-center gap-1.5 ${
                                      isActive
                                        ? useClassicStyling ? 'text-red-300' : 'opacity-70'
                                        : useClassicStyling ? 'text-zinc-500' : 'text-gray-500'
                                    }`}>
                                      <span>{team.abbreviation}</span>
                                      {teamStandings.get(team.id) && (
                                        <>
                                          <span>•</span>
                                          <span className="font-extrabold">
                                            {teamStandings.get(team.id)!.points} pts
                                          </span>
                                          <span>•</span>
                                          <span>
                                            {teamStandings.get(team.id)!.gamesPlayed} gp
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(team.id);
                                  }}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                                    isFavorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                                  } ${
                                    useClassicStyling
                                      ? 'hover:bg-zinc-700'
                                      : 'hover:bg-gray-200'
                                  }`}
                                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  <svg
                                    className={`w-5 h-5 ${
                                      isFavorite
                                        ? useClassicStyling ? 'text-yellow-400' : 'text-yellow-500'
                                        : useClassicStyling ? 'text-zinc-600' : 'text-gray-400'
                                    }`}
                                    fill={isFavorite ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth={isFavorite ? 0 : 2}
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* MLB Teams */}
            {activeTab === 'mlb' && (
              <>
                {/* MLB Favorite Teams */}
                {mlbFavorites.length > 0 && (
                  <div className="mb-6">
                    <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 px-4 ${
                      useClassicStyling ? 'text-zinc-500' : 'text-gray-500'
                    }`}>
                      Favorite Teams
                    </h3>
                    <div className="space-y-1">
                      {sortMLBByWins(mlbFavorites).map(teamId => {
                        const team = MLB_TEAMS[teamId];
                        if (!team) return null;
                        const standing = getMLBStanding(teamId);
                        return (
                          <div key={teamId} className="relative group">
                            <button
                              onClick={() => handleNavigation(`/mlb/${team.slug}`)}
                              className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                                useClassicStyling ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-gray-100 text-gray-700'
                              }`}
                            >
                              <img src={team.logo} alt={`${team.city} ${team.name}`} className="w-8 h-8 object-contain flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold truncate">{team.city} {team.name}</div>
                                <div className={`text-xs flex items-center gap-1.5 ${
                                  useClassicStyling ? 'text-zinc-500' : 'text-gray-500'
                                }`}>
                                  <span>{team.abbreviation}</span>
                                  {standing && (
                                    <>
                                      <span>•</span>
                                      <span className="font-extrabold">{standing.wins}-{standing.losses}</span>
                                      <span>•</span>
                                      <span>.{(standing.winPct * 1000).toFixed(0).padStart(3, '0')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(teamId); }}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all opacity-100 ${
                                useClassicStyling ? 'hover:bg-zinc-700' : 'hover:bg-gray-200'
                              }`}
                              title="Remove from favorites"
                            >
                              <svg className={`w-5 h-5 ${useClassicStyling ? 'text-yellow-400' : 'text-yellow-500'}`} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`my-4 border-t ${
                      useClassicStyling ? 'border-zinc-800' : 'border-gray-200'
                    }`} />
                  </div>
                )}

                {/* MLB Teams by Division */}
                {Object.entries(MLB_DIVISIONS).map(([division, teamIds]) => {
                  const isExpanded = mlbExpandedDivisions[division] ?? false;
                  return (
                    <div key={division} className="mb-6">
                      <button
                        onClick={() => toggleMlbDivision(division)}
                        className={`w-full flex items-center justify-between px-4 py-2 mb-2 rounded-lg transition-colors ${
                          useClassicStyling ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        <h3 className="text-xs font-bold uppercase tracking-wide">{division}</h3>
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="space-y-1">
                          {sortMLBByWins(teamIds).map(teamId => {
                            const team = MLB_TEAMS[teamId];
                            if (!team) return null;
                            const isFavorite = favorites.includes(teamId);
                            const standing = getMLBStanding(teamId);
                            return (
                              <div key={teamId} className="relative group">
                                <button
                                  onClick={() => handleNavigation(`/mlb/${team.slug}`)}
                                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                                    useClassicStyling ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  <img src={team.logo} alt={`${team.city} ${team.name}`} className="w-8 h-8 object-contain flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold truncate">{team.city} {team.name}</div>
                                    <div className={`text-xs flex items-center gap-1.5 ${
                                      useClassicStyling ? 'text-zinc-500' : 'text-gray-500'
                                    }`}>
                                      <span>{team.abbreviation}</span>
                                      {standing && (
                                        <>
                                          <span>•</span>
                                          <span className="font-extrabold">{standing.wins}-{standing.losses}</span>
                                          <span>•</span>
                                          <span>.{(standing.winPct * 1000).toFixed(0).padStart(3, '0')}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(teamId); }}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                                    isFavorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                                  } ${
                                    useClassicStyling ? 'hover:bg-zinc-700' : 'hover:bg-gray-200'
                                  }`}
                                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  <svg
                                    className={`w-5 h-5 ${
                                      isFavorite
                                        ? useClassicStyling ? 'text-yellow-400' : 'text-yellow-500'
                                        : useClassicStyling ? 'text-zinc-600' : 'text-gray-400'
                                    }`}
                                    fill={isFavorite ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth={isFavorite ? 0 : 2}
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${
            useClassicStyling ? 'border-zinc-800' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-center gap-2 text-xs">
              <button
                onClick={() => setIsAboutOpen(true)}
                className={`transition-colors ${
                  useClassicStyling ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                About
              </button>
              <span className={useClassicStyling ? 'text-zinc-700' : 'text-gray-300'}>•</span>
              <span className={useClassicStyling ? 'text-zinc-500' : 'text-gray-500'}>
                {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
