import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';

/**
 * Affiliate reports name teams inconsistently: Impact subId1 is `nhl-sabres`,
 * Partnerize pubrefs are `buf-vs-tor` / `hub-sabres`, and on-site click labels
 * mix abbreviations and slugs. Normalise them all to `{sport}-{slug}` so the
 * network and first-party breakdowns can be joined on one key. Unknown tokens
 * are returned as-is (lowercased).
 */
const LOOKUP = new Map<string, string>();
const NHL_ABBREVS = new Set(Object.values(NHL_TEAMS).map((t) => t.abbreviation.toLowerCase()));
const MLB_ABBREVS = new Map(Object.values(MLB_TEAMS).map((t) => [t.abbreviation.toLowerCase(), `mlb-${t.slug}`]));
for (const t of Object.values(NHL_TEAMS)) {
  LOOKUP.set(`nhl-${t.slug}`, `nhl-${t.slug}`);
  if (!LOOKUP.has(t.slug)) LOOKUP.set(t.slug, `nhl-${t.slug}`);
  if (!LOOKUP.has(t.abbreviation.toLowerCase())) LOOKUP.set(t.abbreviation.toLowerCase(), `nhl-${t.slug}`);
}
for (const t of Object.values(MLB_TEAMS)) {
  LOOKUP.set(`mlb-${t.slug}`, `mlb-${t.slug}`);
  if (!LOOKUP.has(t.slug)) LOOKUP.set(t.slug, `mlb-${t.slug}`);
  if (!LOOKUP.has(t.abbreviation.toLowerCase())) LOOKUP.set(t.abbreviation.toLowerCase(), `mlb-${t.slug}`);
}

export function normalizeTeamKey(raw: string): string {
  const key = (raw || '').trim().toLowerCase();
  if (!key) return '(untagged)';
  return LOOKUP.get(key) || key;
}

/**
 * Game refs (`buf-vs-tor`) carry no sport, and ten abbreviations exist in both
 * leagues (BOS, TOR, PIT...). Use the other side of the matchup to disambiguate:
 * if either abbreviation is MLB-only, the game is MLB; otherwise NHL wins.
 */
export function normalizeMatchupKey(home: string, away: string): string {
  const h = home.trim().toLowerCase();
  const a = away.trim().toLowerCase();
  const mlbOnly = (x: string) => MLB_ABBREVS.has(x) && !NHL_ABBREVS.has(x);
  if ((mlbOnly(h) || mlbOnly(a)) && MLB_ABBREVS.has(h)) return MLB_ABBREVS.get(h)!;
  return normalizeTeamKey(h);
}
