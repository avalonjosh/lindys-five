import type { TeamHistory } from './types';
import { sabresHistory } from './sabres';

const HISTORY_BY_SLUG: Record<string, TeamHistory> = {
  sabres: sabresHistory,
};

export function getTeamHistory(slug: string): TeamHistory | null {
  return HISTORY_BY_SLUG[slug] ?? null;
}

export function hasTeamHistory(slug: string): boolean {
  return slug in HISTORY_BY_SLUG;
}

export type { TeamHistory } from './types';
export type {
  PlayoffAppearance,
  PlayoffSeries,
  PlayoffGame,
  FranchiseEvent,
  FranchiseEventCategory,
  SeriesResult,
  GameLocation,
  Sport,
} from './types';
