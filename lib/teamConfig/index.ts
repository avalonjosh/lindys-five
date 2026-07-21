export type { TeamConfig } from './nhlTeams';
export type { MLBTeamConfig } from './mlbTeams';
export type { NFLTeamConfig } from './nflTeams';
export { NHL_TEAMS, getDarkModeColors } from './nhlTeams';
export { MLB_TEAMS } from './mlbTeams';
export { NFL_TEAMS, NFL_TEAM_LIST, findNFLTeamByPickSlug } from './nflTeams';

import { NHL_TEAMS, type TeamConfig } from './nhlTeams';
import { MLB_TEAMS, type MLBTeamConfig } from './mlbTeams';
import { NFL_TEAMS, type NFLTeamConfig } from './nflTeams';

// Backward compatibility: TEAMS is the NHL teams (used by 44+ existing imports)
export const TEAMS = NHL_TEAMS;

// Combined lookup for all sports
export const ALL_TEAMS: Record<string, TeamConfig | MLBTeamConfig | NFLTeamConfig> = {
  ...NHL_TEAMS,
  ...MLB_TEAMS,
  ...NFL_TEAMS,
};

// Get the correct URL path for a team based on its sport
export function getTeamUrl(slug: string): string {
  if (slug in NHL_TEAMS) return `/nhl/${slug}`;
  if (slug in MLB_TEAMS) return `/mlb/${slug}`;
  if (slug in NFL_TEAMS) return `/pick-the-${NFL_TEAMS[slug].pickSlug}`;
  return `/${slug}`;
}

// Look up a team config from any sport by slug
export function findTeam(slug: string): TeamConfig | MLBTeamConfig | NFLTeamConfig | undefined {
  return NHL_TEAMS[slug] || MLB_TEAMS[slug] || NFL_TEAMS[slug];
}
