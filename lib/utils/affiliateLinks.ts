/**
 * Affiliate link utilities for StubHub/Partnerize and Amazon Associates integration
 */

import { FANATICS_TEAM_PATHS } from '@/lib/affiliate/fanaticsTeams';
import { STUBHUB_EVENT_IDS } from '@/lib/affiliate/stubhubEvents';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';

const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG || 'lindysfive-20';

const STUBHUB_BASE_URL = 'https://stubhub.prf.hn/click';
// Campaign Reference (camref) from Partnerize - specific to StubHub NORAM campaign
const CAMPAIGN_REF = process.env.NEXT_PUBLIC_STUBHUB_CAMREF || '1110lpjky';
// Set to true to use direct StubHub links (non-affiliate) for testing
const USE_DIRECT_LINKS = false;

interface AffiliateLinParams {
  stubhubId: number;
  trackingRef?: string; // Custom tracking parameter (e.g., game ID, team abbreviation)
  /** Explicit StubHub destination (e.g. a game search); overrides the team-page default. */
  destination?: string;
}

/**
 * Generates a StubHub affiliate link using Partnerize tracking
 *
 * @param stubhubId - The StubHub performer ID for the team
 * @param trackingRef - Optional custom tracking reference for analytics
 * @returns Complete affiliate tracking URL
 *
 * @example
 * generateStubHubLink({ stubhubId: 2356, trackingRef: 'buf-vs-tor-2025-11-15' })
 * // Returns: https://stubhub.prf.hn/click/camref:1100l413235/pubref:buf-vs-tor-2025-11-15/destination:https%3A%2F%2Fwww.stubhub.com%2Fperformer%2F2356%2F
 */
/**
 * Convert team config slug to StubHub URL format
 * e.g., 'sabres' -> 'buffalo-sabres', 'mapleleafs' -> 'toronto-maple-leafs'
 */
function convertToStubHubSlug(slug: string, city: string): string {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const teamSlug = slug.toLowerCase().replace(/\s+/g, '-');

  // Handle special cases — NHL
  if (slug === 'mapleleafs') return `${citySlug}-maple-leafs`;
  if (slug === 'redwings') return `${citySlug}-red-wings`;
  if (slug === 'bluejackets') return `${citySlug}-blue-jackets`;
  if (slug === 'goldenknights') return `${citySlug}-golden-knights`;
  if (slug === 'utah') return 'utah-hockey-club';

  // Handle special cases — MLB
  if (slug === 'redsox') return `${citySlug}-red-sox`;
  if (slug === 'whitesox') return `${citySlug}-white-sox`;
  if (slug === 'bluejays') return `${citySlug}-blue-jays`;
  if (slug === 'txrangers') return 'texas-rangers';

  return `${citySlug}-${teamSlug}`;
}

export function generateStubHubLink({ stubhubId, trackingRef, teamSlug, teamCity, destination }: AffiliateLinParams & { teamSlug?: string; teamCity?: string }): string {
  // Use team slug format which StubHub redirects properly
  // e.g., https://www.stubhub.com/buffalo-sabres-tickets
  let destinationUrl: string;

  if (destination) {
    destinationUrl = destination;
  } else if (teamSlug && teamCity) {
    const stubhubSlug = convertToStubHubSlug(teamSlug, teamCity);
    // Special case: Utah uses performer ID format instead of slug
    if (teamSlug === 'utah') {
      destinationUrl = `https://www.stubhub.com/utah-hockey-club-tickets/performer/150310185`;
    } else {
      destinationUrl = `https://www.stubhub.com/${stubhubSlug}-tickets`;
    }
  } else {
    destinationUrl = `https://www.stubhub.com/performer/${stubhubId}`;
  }

  // Temporary: Use direct links until Partnerize account is fully activated
  if (USE_DIRECT_LINKS) {
    console.log('Using direct StubHub link (non-affiliate):', destinationUrl);
    return destinationUrl;
  }

  // URL encode the destination
  const encodedDestination = encodeURIComponent(destinationUrl);

  // Build the tracking link with proper Partnerize format
  let trackingLink = `${STUBHUB_BASE_URL}/camref:${CAMPAIGN_REF}`;

  // Add custom tracking reference if provided
  if (trackingRef) {
    trackingLink += `/pubref:${trackingRef}`;
  }

  // Add the destination URL
  trackingLink += `/destination:${encodedDestination}`;

  return trackingLink;
}

/**
 * Generates a tracking reference string for a specific game
 *
 * @param homeTeam - Home team abbreviation
 * @param awayTeam - Away team abbreviation
 * @param date - Game date (optional)
 * @returns Tracking reference string
 *
 * @example
 * generateGameTrackingRef('BUF', 'TOR', '01/15/2025')
 * // Returns: 'buf-vs-tor'
 */
export function generateGameTrackingRef(
  homeTeam: string,
  awayTeam: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _date?: string
): string {
  // Keep it simple - just team matchup, no date (dates have slashes which could cause issues)
  return `${homeTeam.toLowerCase()}-vs-${awayTeam.toLowerCase()}`;
}

/**
 * Generates a StubHub affiliate link for a specific game
 * Links to the venue's home team StubHub page
 *
 * @param venueTeamSlug - Team slug for URL (e.g., 'sabres')
 * @param venueTeamCity - Team city (e.g., 'Buffalo')
 * @param venueTeamStubhubId - StubHub ID of the team whose venue is hosting (fallback)
 * @param homeTeam - Home team abbreviation
 * @param awayTeam - Away team abbreviation
 * @param date - Game date (optional)
 * @returns Complete affiliate tracking URL
 */
export function generateGameTicketLink(
  venueTeamSlug: string,
  venueTeamCity: string,
  venueTeamStubhubId: number,
  homeTeam: string,
  awayTeam: string,
  date?: string,
  sport: 'nhl' | 'mlb' = 'nhl'
): string {
  const trackingRef = generateGameTrackingRef(homeTeam, awayTeam, date);
  return generateStubHubLink({
    stubhubId: venueTeamStubhubId,
    trackingRef,
    teamSlug: venueTeamSlug,
    teamCity: venueTeamCity,
    destination: generateGameEventDestination(homeTeam, awayTeam, date, sport)
      ?? generateGameSearchDestination(homeTeam, awayTeam, date, sport),
  });
}

/** Eastern game date as YYYY-MM-DD from a YYYY-MM-DD string or an ISO datetime. */
function gameDateYmd(date?: string): string | null {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Exact StubHub event page for a game, when we have its event id in the
 * harvested table (see lib/affiliate/stubhubEvents.ts). StubHub redirects
 * /event/{id}/ to the canonical slugged URL, so the id alone is enough.
 */
/** MLB Stats API abbreviations that differ from lib/teamConfig (which the event table uses). */
const MLB_ABBREV_ALIASES: Record<string, string> = { AZ: 'ARI', ATH: 'OAK', CHW: 'CWS', KCR: 'KC', SDP: 'SD', SFG: 'SF', TBR: 'TB', WAS: 'WSH', WSN: 'WSH' };
const eventAbbrev = (abbrev: string, sport: 'nhl' | 'mlb') => {
  const up = abbrev.toUpperCase();
  return sport === 'mlb' ? MLB_ABBREV_ALIASES[up] || up : up;
};

export function generateGameEventDestination(homeTeam: string, awayTeam: string, date: string | undefined, sport: 'nhl' | 'mlb'): string | undefined {
  const ymd = gameDateYmd(date);
  if (!ymd) return undefined;
  const id = STUBHUB_EVENT_IDS[`${sport}:${eventAbbrev(homeTeam, sport)}:${eventAbbrev(awayTeam, sport)}:${ymd}`];
  return id ? `https://www.stubhub.com/event/${id}/` : undefined;
}

/** "City Name" for a league abbreviation, or null if unknown. */
function fullTeamName(abbrev: string, sport: 'nhl' | 'mlb'): string | null {
  const teams = sport === 'mlb' ? MLB_TEAMS : NHL_TEAMS;
  const t = Object.values(teams).find((x) => x.abbreviation.toUpperCase() === abbrev.toUpperCase());
  return t ? `${t.city} ${t.name}` : null;
}

/** Game date as "October 3 2026" (Eastern). Accepts YYYY-MM-DD or an ISO datetime. */
function gameDateLabel(date?: string): string | null {
  if (!date) return null;
  const ymd = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12) : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    ...(ymd ? {} : { timeZone: 'America/New_York' }),
    month: 'long', day: 'numeric', year: 'numeric',
  }).replace(',', '');
}

/**
 * StubHub search deep link for a specific game. StubHub event pages need an
 * event id we have no feed for, but a search for "Away at Home <date>" ranks
 * the exact game first, which beats landing on the full team schedule.
 * Returns undefined (caller falls back to the team page) when either team
 * abbreviation is unknown.
 */
export function generateGameSearchDestination(homeTeam: string, awayTeam: string, date: string | undefined, sport: 'nhl' | 'mlb'): string | undefined {
  const home = fullTeamName(homeTeam, sport);
  const away = fullTeamName(awayTeam, sport);
  if (!home || !away) return undefined;
  const q = [`${away} at ${home}`, gameDateLabel(date)].filter(Boolean).join(' ');
  return `https://www.stubhub.com/secure/search?q=${encodeURIComponent(q)}`;
}

/**
 * Generates an Amazon Associates affiliate link for team merchandise
 *
 * @param teamCity - Team city (e.g., 'Buffalo')
 * @param teamName - Team name (e.g., 'Sabres')
 * @param sport - 'nhl' or 'mlb'
 * @returns Amazon search URL with affiliate tag
 */
export function generateAmazonMerchLink(teamCity: string, teamName: string, sport: 'nhl' | 'mlb'): string {
  const league = sport === 'nhl' ? 'NHL' : 'MLB';
  return generateAmazonSearchLink(`${teamCity} ${teamName} ${league} jersey`);
}

/** Amazon search URL with the Associates tag, for any query (gear-hub categories). */
export function generateAmazonSearchLink(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}

// Fanatics affiliate (Impact). NEXT_PUBLIC_FANATICS_DEEPLINK is the Impact
// tracking link (with or without a trailing `?u=`); until it is set, links go
// direct (non-affiliate), mirroring the StubHub direct-link fallback.
const FANATICS_DEEPLINK = (process.env.NEXT_PUBLIC_FANATICS_DEEPLINK || '').replace(/[?&]u=$/, '');
const FANATICS_BASE = 'https://www.fanatics.com';

export type FanaticsSport = 'nhl' | 'mlb';

export interface FanaticsSubIds {
  /** Impact subId1: which team the click came from, e.g. `nhl-sabres`. */
  team?: string;
  /** Impact subId2: where on the site, e.g. `teampage`, `gear-hub-jerseys`, `email-digest`. */
  placement?: string;
}

/** Wraps any fanatics.com destination in the Impact deep link, stamping sub-IDs
 *  so Impact reports break out clicks/sales by team and placement. */
export function buildFanaticsDeepLink(destination: string, sub: FanaticsSubIds = {}): string {
  if (!FANATICS_DEEPLINK) return destination;
  const params = new URLSearchParams();
  if (sub.team) params.set('subId1', sub.team);
  if (sub.placement) params.set('subId2', sub.placement);
  params.set('u', destination);
  return `${FANATICS_DEEPLINK}?${params.toString()}`;
}

/** Fanatics search URL for team gear (gear-hub category buttons). */
export function generateFanaticsLink(teamCity: string, teamName: string, category = '', sub: FanaticsSubIds = {}): string {
  const query = `${teamCity} ${teamName} ${category}`.trim().replace(/\s+/g, ' ');
  return buildFanaticsDeepLink(`${FANATICS_BASE}/search?query=${encodeURIComponent(query)}`, sub);
}

/** Fanatics team storefront (the primary "Shop Gear" destination). Falls back to
 *  a team search when the team has no mapped storefront path. */
export function generateFanaticsTeamLink(sport: FanaticsSport, teamSlug: string, placement: string, teamCity?: string, teamName?: string): string {
  const path = FANATICS_TEAM_PATHS[`${sport}/${teamSlug}`];
  const sub: FanaticsSubIds = { team: `${sport}-${teamSlug}`, placement };
  if (path) return buildFanaticsDeepLink(`${FANATICS_BASE}${path}`, sub);
  return generateFanaticsLink(teamCity || '', teamName || teamSlug, '', sub);
}

/** True once the Fanatics affiliate link is configured (so CTAs prefer it over Amazon). */
export const FANATICS_ENABLED = !!FANATICS_DEEPLINK;

/** Best available merch link for a team: Fanatics storefront when configured, else Amazon. */
export function generateMerchLink(sport: FanaticsSport, teamSlug: string, teamCity: string, teamName: string, placement: string): string {
  return FANATICS_ENABLED
    ? generateFanaticsTeamLink(sport, teamSlug, placement, teamCity, teamName)
    : generateAmazonMerchLink(teamCity, teamName, sport);
}

/** StubHub team-tickets landing (not game-specific) for the tickets hub. */
export function generateTeamTicketsLink(teamSlug: string, teamCity: string, stubhubId: number): string {
  return generateStubHubLink({ stubhubId, trackingRef: `hub-${teamSlug}`, teamSlug, teamCity });
}
