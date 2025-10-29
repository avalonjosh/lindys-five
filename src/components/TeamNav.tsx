import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEAMS } from '../teamConfig';
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
}

export default function TeamNav({ currentTeamId, isGoatMode, darkModeColors, teamColors }: TeamNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('favorite-teams');
    return saved ? JSON.parse(saved) : [];
  });
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('expanded-divisions');
    return saved ? JSON.parse(saved) : {
      'Atlantic Division': true,
      'Metropolitan Division': true,
    };
  });
  const navigate = useNavigate();

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favorite-teams', JSON.stringify(favorites));
  }, [favorites]);

  // Save expanded divisions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('expanded-divisions', JSON.stringify(expandedDivisions));
  }, [expandedDivisions]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const toggleFavorite = (teamId: string) => {
    setFavorites(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const toggleDivision = (division: string) => {
    setExpandedDivisions(prev => ({
      ...prev,
      [division]: !prev[division]
    }));
  };

  // Organize teams by division
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
        className={`relative inline-flex h-6 w-11 md:h-7 md:w-14 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2`}
        style={isGoatMode ? {
          backgroundColor: (currentTeamId === 'lightning' || currentTeamId === 'penguins') ? teamColors.primary : darkModeColors.accent,
          boxShadow: `0 0 0 2px ${(currentTeamId === 'lightning' || currentTeamId === 'penguins') ? teamColors.primary : darkModeColors.accent}`
        } : {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.3)`
        }}
        aria-label="Open teams menu"
        title="Teams"
      >
        <svg
          className="w-4 h-4 md:w-5 md:h-5"
          fill="none"
          stroke={(currentTeamId === 'lightning' || currentTeamId === 'penguins') && isGoatMode ? 'white' : (isGoatMode && darkModeColors.accent === '#FFFFFF' ? '#002868' : 'white')}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
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
          isGoatMode
            ? ''
            : 'bg-white border-blue-300'
        }`}
        style={isGoatMode ? {
          backgroundColor: darkModeColors.background,
          borderRightColor: darkModeColors.border
        } : undefined}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-4 border-b-2 ${
            isGoatMode ? 'border-zinc-800' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold ${
                isGoatMode ? 'text-white' : 'text-gray-900'
              }`}>
                Teams
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isGoatMode
                    ? 'hover:bg-zinc-800 text-zinc-400'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation List */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Home Link */}
            <button
              onClick={() => handleNavigation('/')}
              className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                isGoatMode
                  ? 'hover:bg-zinc-800 text-white'
                  : 'hover:bg-blue-50 text-gray-900'
              }`}
            >
              Home
            </button>

            {/* About Link */}
            <button
              onClick={() => setIsAboutOpen(true)}
              className={`w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold transition-all ${
                isGoatMode
                  ? 'hover:bg-zinc-800 text-white'
                  : 'hover:bg-blue-50 text-gray-900'
              }`}
            >
              About
            </button>

            {/* Divider */}
            <div className={`my-4 border-t ${
              isGoatMode ? 'border-zinc-800' : 'border-gray-200'
            }`} />

            {/* Favorite Teams Section */}
            {favoriteTeams.length > 0 && (
              <div className="mb-6">
                <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 px-4 ${
                  isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                }`}>
                  Favorite Teams
                </h3>
                <div className="space-y-1">
                  {favoriteTeams.map((team) => {
                    const isActive = team.id === currentTeamId;
                    const isFavorite = favorites.includes(team.id);
                    return (
                      <div key={team.id} className="relative group">
                        <button
                          onClick={() => handleNavigation(`/${team.slug}`)}
                          className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                            isActive
                              ? isGoatMode
                                ? 'bg-red-900/50 text-red-400 border-2 border-red-600'
                                : 'bg-blue-100 border-2'
                              : isGoatMode
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
                            className="w-8 h-8 object-contain"
                          />
                          <div className="flex-1">
                            <div className="font-bold">{team.city} {team.name}</div>
                            <div className={`text-xs ${
                              isActive
                                ? isGoatMode ? 'text-red-300' : 'opacity-70'
                                : isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                            }`}>
                              {team.abbreviation}
                            </div>
                          </div>
                        </button>
                        {/* Star icon - always visible on mobile, visible on hover on desktop */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(team.id);
                          }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                            isFavorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                          } ${
                            isGoatMode
                              ? 'hover:bg-zinc-700'
                              : 'hover:bg-gray-200'
                          }`}
                          title="Remove from favorites"
                        >
                          <svg
                            className={`w-5 h-5 ${
                              isFavorite
                                ? isGoatMode ? 'text-yellow-400' : 'text-yellow-500'
                                : isGoatMode ? 'text-zinc-600' : 'text-gray-400'
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

                {/* Divider */}
                <div className={`my-4 border-t ${
                  isGoatMode ? 'border-zinc-800' : 'border-gray-200'
                }`} />
              </div>
            )}

            {/* Teams by Division */}
            {Object.entries(divisions).map(([division, teams]) => {
              const isExpanded = expandedDivisions[division] ?? true;
              return (
                <div key={division} className="mb-6">
                  <button
                    onClick={() => toggleDivision(division)}
                    className={`w-full flex items-center justify-between px-4 py-2 mb-2 rounded-lg transition-colors ${
                      isGoatMode
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1">
                  {teams.map((team) => {
                    const isActive = team.id === currentTeamId;
                    const isFavorite = favorites.includes(team.id);
                    return (
                      <div key={team.id} className="relative group">
                        <button
                          onClick={() => handleNavigation(`/${team.slug}`)}
                          className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
                            isActive
                              ? isGoatMode
                                ? 'bg-red-900/50 text-red-400 border-2 border-red-600'
                                : 'bg-blue-100 border-2'
                              : isGoatMode
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
                            className="w-8 h-8 object-contain"
                          />
                          <div className="flex-1">
                            <div className="font-bold">{team.city} {team.name}</div>
                            <div className={`text-xs ${
                              isActive
                                ? isGoatMode ? 'text-red-300' : 'opacity-70'
                                : isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                            }`}>
                              {team.abbreviation}
                            </div>
                          </div>
                        </button>
                        {/* Star icon - always visible on mobile, visible on hover on desktop */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(team.id);
                          }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                            isFavorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                          } ${
                            isGoatMode
                              ? 'hover:bg-zinc-700'
                              : 'hover:bg-gray-200'
                          }`}
                          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg
                            className={`w-5 h-5 ${
                              isFavorite
                                ? isGoatMode ? 'text-yellow-400' : 'text-yellow-500'
                                : isGoatMode ? 'text-zinc-600' : 'text-gray-400'
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
          </div>

          {/* Footer */}
          <div className={`p-4 border-t ${
            isGoatMode ? 'border-zinc-800' : 'border-gray-200'
          }`}>
            <p className={`text-xs text-center ${
              isGoatMode ? 'text-zinc-500' : 'text-gray-500'
            }`}>
              Lindy's Five • {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
