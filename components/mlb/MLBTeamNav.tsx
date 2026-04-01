'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import type { MLBStandingsTeam } from '@/lib/types/mlb';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MLBTeamNavProps {
  currentTeamId: string;
  teamColors: TeamColors;
}

const MLB_DIVISIONS: Record<string, string[]> = {
  'AL East': ['orioles', 'redsox', 'yankees', 'rays', 'bluejays'],
  'AL Central': ['whitesox', 'guardians', 'tigers', 'royals', 'twins'],
  'AL West': ['astros', 'angels', 'athletics', 'mariners', 'txrangers'],
  'NL East': ['braves', 'marlins', 'mets', 'phillies', 'nationals'],
  'NL Central': ['cubs', 'reds', 'brewers', 'pirates', 'cardinals'],
  'NL West': ['diamondbacks', 'rockies', 'dodgers', 'padres', 'giants'],
};

export default function MLBTeamNav({ currentTeamId, teamColors }: MLBTeamNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('favorite-teams');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({
    'AL East': true, 'NL East': true,
  });
  const [standings, setStandings] = useState<MLBStandingsTeam[]>([]);
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem('favorite-teams', JSON.stringify(favorites));
  }, [favorites]);

  // Fetch standings when menu opens
  useEffect(() => {
    if (isOpen && standings.length === 0) {
      fetchMLBStandings().then(setStandings).catch(() => {});
    }
  }, [isOpen]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const toggleFavorite = (teamId: string) => {
    setFavorites(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]);
  };

  const toggleDivision = (division: string) => {
    setExpandedDivisions(prev => ({ ...prev, [division]: !prev[division] }));
  };

  const getStanding = (teamId: string) => {
    const team = MLB_TEAMS[teamId];
    if (!team) return null;
    return standings.find(s => s.teamAbbrev === team.abbreviation) || null;
  };

  const sortByWins = (teamIds: string[]) => {
    return [...teamIds].sort((a, b) => {
      const aS = getStanding(a);
      const bS = getStanding(b);
      if (!aS || !bS) return 0;
      return bS.wins - aS.wins;
    });
  };

  const mlbFavorites = favorites.filter(id => MLB_TEAMS[id]);

  return (
    <>
      {/* Hamburger Button — matches NHL style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-6 w-11 md:h-7 md:w-14 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.3)' }}
        aria-label="Open teams menu"
        title="Teams"
      >
        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 transition-opacity backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] z-50 transform transition-transform duration-300 ease-in-out border-r-2 bg-white border-blue-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b-2 border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleNavigation('/')}
                className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Lindy&apos;s Five
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Nav Links */}
            <button onClick={() => handleNavigation('/mlb/scores')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
              MLB Scores
            </button>
            <button onClick={() => handleNavigation('/nhl')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
              NHL Tracker
            </button>
            <div className="my-4 border-t border-gray-200" />

            {/* Favorite Teams */}
            {mlbFavorites.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2 px-4 text-gray-500">Favorite Teams</h3>
                <div className="space-y-1">
                  {sortByWins(mlbFavorites).map(teamId => {
                    const team = MLB_TEAMS[teamId];
                    if (!team) return null;
                    const isActive = team.id === currentTeamId;
                    const standing = getStanding(teamId);
                    return (
                      <TeamRow
                        key={teamId}
                        team={team}
                        isActive={isActive}
                        isFavorite={true}
                        standing={standing}
                        onNavigate={() => handleNavigation(`/mlb/${team.slug}`)}
                        onToggleFavorite={() => toggleFavorite(teamId)}
                      />
                    );
                  })}
                </div>
                <div className="my-4 border-t border-gray-200" />
              </div>
            )}

            {/* Teams by Division */}
            {Object.entries(MLB_DIVISIONS).map(([division, teamIds]) => {
              const isExpanded = expandedDivisions[division] ?? false;
              return (
                <div key={division} className="mb-6">
                  <button
                    onClick={() => toggleDivision(division)}
                    className="w-full flex items-center justify-between px-4 py-2 mb-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wide">{division}</h3>
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1">
                      {sortByWins(teamIds).map(teamId => {
                        const team = MLB_TEAMS[teamId];
                        if (!team) return null;
                        const isActive = team.id === currentTeamId;
                        const isFavorite = favorites.includes(teamId);
                        const standing = getStanding(teamId);
                        return (
                          <TeamRow
                            key={teamId}
                            team={team}
                            isActive={isActive}
                            isFavorite={isFavorite}
                            standing={standing}
                            onNavigate={() => handleNavigation(`/mlb/${team.slug}`)}
                            onToggleFavorite={() => toggleFavorite(teamId)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} JRR Apps
          </div>
        </div>
      </div>
    </>
  );
}

function TeamRow({ team, isActive, isFavorite, standing, onNavigate, onToggleFavorite }: {
  team: { id: string; city: string; name: string; abbreviation: string; logo: string; colors: { primary: string } };
  isActive: boolean;
  isFavorite: boolean;
  standing: MLBStandingsTeam | null;
  onNavigate: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onNavigate}
        className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 ${
          isActive ? 'bg-blue-100 border-2' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={isActive ? {
          backgroundColor: `${team.colors.primary}15`,
          borderColor: team.colors.primary,
          color: team.colors.primary,
        } : undefined}
      >
        <img src={team.logo} alt={`${team.city} ${team.name}`} className="w-8 h-8 object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{team.city} {team.name}</div>
          <div className={`text-xs flex items-center gap-1.5 ${isActive ? 'opacity-70' : 'text-gray-500'}`}>
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
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all hover:bg-gray-200 ${
          isFavorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
        }`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg
          className={`w-5 h-5 ${isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}
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
}
