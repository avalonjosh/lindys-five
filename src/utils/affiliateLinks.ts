/**
 * Affiliate link utilities for StubHub/Partnerize integration
 */

const STUBHUB_BASE_URL = 'https://stubhub.prf.hn/click';
const PUBLISHER_ID = import.meta.env.VITE_STUBHUB_PUBLISHER_ID || '1100l413235';

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
 * // Returns: https://stubhub.prf.hn/click/camref:1100l413235/pubref:buf-vs-tor-2025-11-15/destination:https%3A%2F%2Fwww.stubhub.com%2Fbuffalo-sabres-tickets%2Fperformer%2F2356%2F
 */
export function generateStubHubLink({ stubhubId, trackingRef }: AffiliateLinParams): string {
  // Construct the destination URL
  const destinationUrl = `https://www.stubhub.com/performer/${stubhubId}/`;

  // URL encode the destination
  const encodedDestination = encodeURIComponent(destinationUrl);

  // Build the tracking link
  let trackingLink = `${STUBHUB_BASE_URL}/camref:${PUBLISHER_ID}`;

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
 * generateGameTrackingRef('BUF', 'TOR', '2025-11-15')
 * // Returns: 'buf-vs-tor-2025-11-15'
 */
export function generateGameTrackingRef(
  homeTeam: string,
  awayTeam: string,
  date?: string
): string {
  const ref = `${homeTeam.toLowerCase()}-vs-${awayTeam.toLowerCase()}`;
  return date ? `${ref}-${date}` : ref;
}

/**
 * Generates a StubHub affiliate link for a specific game
 * Links to the venue's home team StubHub page
 *
 * @param venueTeamStubhubId - StubHub ID of the team whose venue is hosting
 * @param homeTeam - Home team abbreviation
 * @param awayTeam - Away team abbreviation
 * @param date - Game date (optional)
 * @returns Complete affiliate tracking URL
 */
export function generateGameTicketLink(
  venueTeamStubhubId: number,
  homeTeam: string,
  awayTeam: string,
  date?: string
): string {
  const trackingRef = generateGameTrackingRef(homeTeam, awayTeam, date);
  return generateStubHubLink({
    stubhubId: venueTeamStubhubId,
    trackingRef
  });
}
