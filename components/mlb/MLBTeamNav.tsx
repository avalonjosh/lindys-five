'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { TEAMS } from '@/lib/teamConfig';
import { fetchMLBStandings } from '@/lib/services/mlbApi';
import { type TeamStandings } from '@/lib/services/nhlApi';
import type { MLBStandingsTeam } from '@/lib/types/mlb';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MLBTeamNavProps {
  currentTeamId: string;
  teamColors: TeamColors;
  defaultTab?: 'nhl' | 'mlb';
}

const MLB_DIVISIONS: Record<string, string[]> = {
  'AL East': ['orioles', 'redsox', 'yankees', 'rays', 'bluejays'],
  'AL Central': ['whitesox', 'guardians', 'tigers', 'royals', 'twins'],
  'AL West': ['astros', 'angels', 'athletics', 'mariners', 'txrangers'],
  'NL East': ['braves', 'marlins', 'mets', 'phillies', 'nationals'],
  'NL Central': ['cubs', 'reds', 'brewers', 'pirates', 'cardinals'],
  'NL West': ['diamondbacks', 'rockies', 'dodgers', 'padres', 'giants'],
};

export default function MLBTeamNav({ currentTeamId, teamColors, defaultTab = 'mlb' }: MLBTeamNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({
    'AL East': true, 'NL East': true,
  });
  const [standings, setStandings] = useState<MLBStandingsTeam[]>([]);
  const [activeTab, setActiveTab] = useState<'nhl' | 'mlb'>(defaultTab);
  const [nhlStandings, setNhlStandings] = useState<Map<string, TeamStandings>>(new Map());
  const [nhlExpandedDivisions, setNhlExpandedDivisions] = useState<Record<string, boolean>>({
    'Atlantic Division': true, 'Metropolitan Division': true,
  });
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const router = useRouter();

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('favorite-teams');
      if (saved) setFavorites(JSON.parse(saved));
    } catch { /* ignore */ }
    setFavoritesLoaded(true);
  }, []);

  // Save favorites to localStorage after initial load
  useEffect(() => {
    if (favoritesLoaded) {
      localStorage.setItem('favorite-teams', JSON.stringify(favorites));
    }
  }, [favorites, favoritesLoaded]);

  // Fetch standings when menu opens
  useEffect(() => {
    if (isOpen && standings.length === 0) {
      fetchMLBStandings().then(setStandings).catch(() => {});
    }
  }, [isOpen]);

  // Fetch NHL standings when NHL tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'nhl' && nhlStandings.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      fetch(`/api/v1/standings/${today}`)
        .then(r => r.json())
        .then(data => {
          if (data.standings) {
            const map = new Map<string, TeamStandings>();
            Object.values(TEAMS).forEach((team) => {
              const s = data.standings.find((st: any) => st.teamAbbrev?.default === team.abbreviation);
              if (s) {
                map.set(team.id, {
                  teamId: team.nhlId, teamAbbrev: team.abbreviation,
                  points: s.points || 0, gamesPlayed: s.gamesPlayed || 0,
                  wins: s.wins || 0, losses: s.losses || 0, otLosses: s.otLosses || 0,
                  divisionSequence: s.divisionSequence,
                });
              }
            });
            if (map.size > 0) setNhlStandings(map);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab]);

  const NHL_DIVISIONS = {
    'Atlantic Division': ['bruins', 'sabres', 'redwings', 'panthers', 'canadiens', 'senators', 'lightning', 'mapleleafs'],
    'Metropolitan Division': ['hurricanes', 'bluejackets', 'devils', 'islanders', 'rangers', 'flyers', 'penguins', 'capitals'],
    'Central Division': ['blackhawks', 'avalanche', 'stars', 'wild', 'predators', 'blues', 'utah', 'jets'],
    'Pacific Division': ['ducks', 'flames', 'oilers', 'kings', 'sharks', 'kraken', 'canucks', 'goldenknights'],
  };

  const sortNHLByPoints = (teamIds: string[]) => {
    return [...teamIds].sort((a, b) => {
      const aS = nhlStandings.get(a);
      const bS = nhlStandings.get(b);
      if (!aS || !bS) return 0;
      if (aS.divisionSequence !== undefined && bS.divisionSequence !== undefined) {
        return aS.divisionSequence - bS.divisionSequence;
      }
      return bS.points - aS.points;
    });
  };

  const toggleNhlDivision = (division: string) => {
    setNhlExpandedDivisions(prev => ({ ...prev, [division]: !prev[division] }));
  };

  const nhlFavorites = favorites.filter(id => TEAMS[id]);

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
        className="relative inline-flex items-center justify-center p-1 transition-all focus:outline-none"
        aria-label="Open teams menu"
        title="Teams"
      >
        <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
          <div className="p-4 border-b-2 border-gray-200" style={{ background: '#003087' }}>
            <button
              onClick={() => handleNavigation('/')}
              className="w-full text-center text-2xl font-bold text-white hover:text-white/80 transition-colors"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Sport Tabs */}
            <div className="flex rounded-lg p-1 mb-4 bg-gray-100">
              <button
                onClick={() => setActiveTab('nhl')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === 'nhl' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <img src="https://assets.nhle.com/logos/nhl/svg/NHL_dark.svg" alt="NHL" className="w-5 h-5" />
                NHL
              </button>
              <button
                onClick={() => setActiveTab('mlb')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === 'mlb' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <img src="https://www.mlbstatic.com/team-logos/league-on-light/1.svg" alt="MLB" className="w-4 h-4" />
                MLB
              </button>
            </div>

            {/* NHL Nav Links */}
            {activeTab === 'nhl' && (
              <>
                <button onClick={() => handleNavigation('/nhl/scores')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
                  Scores
                </button>
                <button onClick={() => handleNavigation('/nhl-playoff-odds')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
                  Playoff Odds
                </button>
                <button onClick={() => handleNavigation('/playoffs')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
                  Playoff Bracket
                </button>
              </>
            )}

            {/* MLB Nav Links */}
            {activeTab === 'mlb' && (
              <>
                <button onClick={() => handleNavigation('/mlb/scores')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
                  Scores
                </button>
                <button onClick={() => handleNavigation('/mlb/playoff-odds')} className="w-full text-left px-4 py-3 rounded-lg mb-2 font-semibold hover:bg-blue-50 text-gray-900 transition-all">
                  Playoff Odds
                </button>
              </>
            )}

            <div className="my-4 border-t border-gray-200" />

            {/* MLB Teams */}
            {activeTab === 'mlb' && (
              <>
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
              </>
            )}

            {/* NHL Teams */}
            {activeTab === 'nhl' && (
              <>
                {nhlFavorites.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-wide mb-2 px-4 text-gray-500">Favorite Teams</h3>
                    <div className="space-y-1">
                      {sortNHLByPoints(nhlFavorites).map(teamId => {
                        const team = TEAMS[teamId];
                        if (!team) return null;
                        const standing = nhlStandings.get(teamId);
                        return (
                          <div key={teamId} className="relative group">
                            <button
                              onClick={() => handleNavigation(`/nhl/${team.slug}`)}
                              className="w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 hover:bg-gray-100 text-gray-700"
                            >
                              <img src={team.logo} alt={`${team.city} ${team.name}`} className="w-8 h-8 object-contain flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold truncate">{team.city} {team.name}</div>
                                <div className="text-xs flex items-center gap-1.5 text-gray-500">
                                  <span>{team.abbreviation}</span>
                                  {standing && (
                                    <>
                                      <span>•</span>
                                      <span className="font-extrabold">{standing.points} pts</span>
                                      <span>•</span>
                                      <span>{standing.gamesPlayed} gp</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(teamId); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all opacity-100 hover:bg-gray-200"
                              title="Remove from favorites"
                            >
                              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="my-4 border-t border-gray-200" />
                  </div>
                )}

                {Object.entries(NHL_DIVISIONS).map(([division, teamIds]) => {
                  const isExpanded = nhlExpandedDivisions[division] ?? true;
                  return (
                    <div key={division} className="mb-6">
                      <button
                        onClick={() => toggleNhlDivision(division)}
                        className="w-full flex items-center justify-between px-4 py-2 mb-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                      >
                        <h3 className="text-xs font-bold uppercase tracking-wide">{division}</h3>
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="space-y-1">
                          {sortNHLByPoints(teamIds).map(teamId => {
                            const team = TEAMS[teamId];
                            if (!team) return null;
                            const isFavorite = favorites.includes(teamId);
                            const standing = nhlStandings.get(teamId);
                            return (
                              <div key={teamId} className="relative group">
                                <button
                                  onClick={() => handleNavigation(`/nhl/${team.slug}`)}
                                  className="w-full text-left px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-3 hover:bg-gray-100 text-gray-700"
                                >
                                  <img src={team.logo} alt={`${team.city} ${team.name}`} className="w-8 h-8 object-contain flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold truncate">{team.city} {team.name}</div>
                                    <div className="text-xs flex items-center gap-1.5 text-gray-500">
                                      <span>{team.abbreviation}</span>
                                      {standing && (
                                        <>
                                          <span>•</span>
                                          <span className="font-extrabold">{standing.points} pts</span>
                                          <span>•</span>
                                          <span>{standing.gamesPlayed} gp</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(teamId); }}
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
