/**
 * Ticket links must resolve to the same exact StubHub event whatever time zone
 * the code runs in (Vercel builds pages in UTC; visitors are anywhere).
 *
 *   for tz in UTC America/New_York America/Los_Angeles Europe/Berlin Asia/Tokyo; do
 *     TZ=$tz npx tsx scripts/check-ticket-links.ts; done
 */
import { generateGameEventDestination, generateGameSearchDestination } from '../lib/utils/affiliateLinks';

const cases: { home: string; away: string; date: string; event: string }[] = [
  // NHL schedule format (MM/DD/YYYY): Stars at Sabres, Oct 8 2026
  { home: 'BUF', away: 'DAL', date: '10/08/2026', event: 'https://www.stubhub.com/event/161315585/' },
  // Same game as YYYY-MM-DD and as an evening ISO start time (UTC rolls past midnight)
  { home: 'BUF', away: 'DAL', date: '2026-10-08', event: 'https://www.stubhub.com/event/161315585/' },
  { home: 'BUF', away: 'DAL', date: '2026-10-08T23:00:00Z', event: 'https://www.stubhub.com/event/161315585/' },
  { home: 'BUF', away: 'UTA', date: '10/10/2026', event: 'https://www.stubhub.com/event/161315555/' },
];

let failed = 0;
for (const c of cases) {
  const got = generateGameEventDestination(c.home, c.away, c.date, 'nhl');
  if (got !== c.event) {
    failed++;
    console.error(`FAIL ${c.away}@${c.home} ${c.date}: got ${got ?? 'no event'} (search: ${generateGameSearchDestination(c.home, c.away, c.date, 'nhl')})`);
  }
}
const search = generateGameSearchDestination('BUF', 'UTA', '10/10/2026', 'nhl') ?? '';
if (!decodeURIComponent(search).includes('October 10 2026')) {
  failed++;
  console.error(`FAIL search date: ${decodeURIComponent(search)}`);
}
console.log(`${process.env.TZ ?? 'local'}: ${failed ? `${failed} failed` : `all ${cases.length + 1} passed`}`);
process.exit(failed ? 1 : 0);
