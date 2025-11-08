/**
 * Affiliate link utilities for StubHub/Partnerize integration
 */

const STUBHUB_BASE_URL = 'https://stubhub.prf.hn/click';
// Campaign Reference (camref) from Partnerize - specific to StubHub NORAM campaign
const CAMPAIGN_REF = import.meta.env.VITE_STUBHUB_CAMREF || '1110lpjky';
// Set to true to use direct StubHub links (non-affiliate) for testing
const USE_DIRECT_LINKS = false;

interface AffiliateLinParams {
  stubhubId: number;
  trackingRef?: string; // Custom tracking parameter (e.g., game ID, team abbreviation)
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

  // Handle special cases
  if (slug === 'mapleleafs') return `${citySlug}-maple-leafs`;
  if (slug === 'redwings') return `${citySlug}-red-wings`;
  if (slug === 'bluejackets') return `${citySlug}-blue-jackets`;
  if (slug === 'goldenknights') return `${citySlug}-golden-knights`;
  // Utah Hockey Club (temporary name until officially renamed)
  if (slug === 'utah') return 'utah-hockey-club';

  return `${citySlug}-${teamSlug}`;
}

export function generateStubHubLink({ stubhubId, trackingRef, teamSlug, teamCity }: AffiliateLinParams & { teamSlug?: string; teamCity?: string }): string {
  // Use team slug format which StubHub redirects properly
  // e.g., https://www.stubhub.com/buffalo-sabres-tickets
  let destinationUrl: string;

  if (teamSlug && teamCity) {
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

  console.log('Generated affiliate link:', trackingLink);
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
  date?: string
): string {
  const trackingRef = generateGameTrackingRef(homeTeam, awayTeam, date);
  return generateStubHubLink({
    stubhubId: venueTeamStubhubId,
    trackingRef,
    teamSlug: venueTeamSlug,
    teamCity: venueTeamCity
  });
}
