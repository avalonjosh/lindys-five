import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEAMS } from '../teamConfig';

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  accent: string;
  border: string;
  text: string;
}

interface TeamNavProps {
  currentTeamId: string;
  isGoatMode: boolean;
  darkModeColors: DarkModeColors;
}

export default function TeamNav({ currentTeamId, isGoatMode, darkModeColors }: TeamNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  // Organize teams by division (for now, we'll just list Sabres and Canadiens)
  // When you add more teams, organize them by division here
  const divisions = {
    'Atlantic Division': [
      TEAMS.sabres,
      TEAMS.canadiens,
      // Add more Atlantic teams here
    ],
    // 'Metropolitan Division': [],
    // 'Central Division': [],
    // 'Pacific Division': [],
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative inline-flex h-6 w-11 md:h-7 md:w-14 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2`}
        style={isGoatMode ? {
          backgroundColor: darkModeColors.accent,
          boxShadow: `0 0 0 2px ${darkModeColors.accent}`
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
          stroke="white"
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

            {/* Divider */}
            <div className={`my-4 border-t ${
              isGoatMode ? 'border-zinc-800' : 'border-gray-200'
            }`} />

            {/* Teams by Division */}
            {Object.entries(divisions).map(([division, teams]) => (
              <div key={division} className="mb-6">
                <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 px-4 ${
                  isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                }`}>
                  {division}
                </h3>
                <div className="space-y-1">
                  {teams.map((team) => {
                    const isActive = team.id === currentTeamId;
                    return (
                      <button
                        key={team.id}
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
                        {isActive && (
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
    </>
  );
}
