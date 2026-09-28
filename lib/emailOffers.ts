import {
  FANATICS_ENABLED,
  generateFanaticsLink,
  generateFanaticsPlayerLink,
  generateFanaticsTeamLink,
} from './utils/affiliateLinks';
import type { LandingResponse } from './types/boxscore';
import { findTeam, NHL_TEAMS } from './teamConfig';

// PNG team logos for email. Team SVGs (nhle.com / mlbstatic) don't render in
// Gmail/Outlook, so we use ESPN's PNG CDN. ESPN codes are the lowercased
// abbreviation except for these (verified against the CDN — all 62 teams 200):
const ESPN_NHL_CODES: Record<string, string> = { TBL: 'tb', NJD: 'nj', LAK: 'la', SJS: 'sj', UTA: 'utah' };
// CWS = teamConfig abbrev; AZ = MLB-API abbrev for Arizona (used for opponents).
const ESPN_MLB_CODES: Record<string, string> = { CWS: 'chw', AZ: 'ari' };

export function espnLogoUrl(sport: 'nhl' | 'mlb' | 'nfl', abbrev: string): string {
  const a = (abbrev || '').toUpperCase();
  const codes = sport === 'nhl' ? ESPN_NHL_CODES : sport === 'mlb' ? ESPN_MLB_CODES : {};
  const code = codes[a] ?? a.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/${sport}/500/${code}.png`;
}

// Affiliate placements in email. Each one tags the StubHub pubref suffix and
// the Fanatics subId2, so network reports split sales by email type.
export type EmailPlacement =
  | 'email-recap'
  | 'email-set'
  | 'email-playoff'
  | 'email-mlb-recap'
  | 'email-mlb-set'
  | 'email-nfl'
  | 'email-gift-guide'
  | 'email-clinch'
  | 'email-welcome'
  | 'email-digest';

export interface GearHero {
  name: string;
  lastName: string;
  line: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function statLine(goals: number, assists: number): string {
  if (goals >= 3) return assists > 0 ? `Hat trick and ${plural(assists, 'assist')}` : 'Hat trick';
  return [goals > 0 ? plural(goals, 'goal') : '', assists > 0 ? plural(assists, 'assist') : ''].filter(Boolean).join(', ');
}

/**
 * The player to feature in a win's gear card: our team's highest three star,
 * else our top goal scorer. Null when neither exists (the card then shows
 * team gear instead).
 */
export function pickGearHero(landing: LandingResponse, teamAbbrev: string, oppScore: number): GearHero | null {
  const abbrevOf = (a: string | { default: string } | undefined) => (typeof a === 'string' ? a : a?.default);
  const star = [...(landing.summary?.threeStars || [])]
    .sort((a, b) => a.star - b.star)
    .find((s) => abbrevOf(s.teamAbbrev) === teamAbbrev);

  const seasonGoals = (playerId: number) => {
    let latest = 0;
    for (const period of landing.summary?.scoring || []) {
      for (const g of period.goals) if (g.playerId === playerId) latest = Math.max(latest, g.goalsToDate || 0);
    }
    return latest;
  };

  // Three stars carry an initial ("T. Thompson"); scoring plays carry full names.
  const fullNames = new Map<number, string>();
  for (const period of landing.summary?.scoring || []) {
    for (const g of period.goals) {
      for (const p of [g, ...(g.assists || [])]) {
        const full = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim();
        if (p.playerId && full && !fullNames.has(p.playerId)) fullNames.set(p.playerId, full);
      }
    }
  }

  if (star) {
    const name = fullNames.get(star.playerId) || `${star.firstName?.default || ''} ${star.lastName?.default || ''}`.trim() || star.name?.default || '';
    const lastName = star.lastName?.default || name;
    if (star.position === 'G') {
      return { name, lastName, line: oppScore === 0 ? 'Shutout in the win' : 'The win in net' };
    }
    const line = statLine(star.goals, star.assists);
    if (line) {
      const total = star.goals > 0 ? seasonGoals(star.playerId) : 0;
      return { name, lastName, line: total > 1 ? `${line} (${total} this season)` : line };
    }
  }

  const counts = new Map<number, { name: string; lastName: string; goals: number; total: number }>();
  for (const period of landing.summary?.scoring || []) {
    for (const g of period.goals) {
      if (g.teamAbbrev?.default !== teamAbbrev) continue;
      const row = counts.get(g.playerId) || {
        name: `${g.firstName?.default || ''} ${g.lastName?.default || ''}`.trim(),
        lastName: g.lastName?.default || '',
        goals: 0,
        total: 0,
      };
      row.goals += 1;
      row.total = Math.max(row.total, g.goalsToDate || 0);
      counts.set(g.playerId, row);
    }
  }
  const top = [...counts.values()].sort((a, b) => b.goals - a.goals)[0];
  if (!top || !top.name) return null;
  const line = statLine(top.goals, 0);
  return { name: top.name, lastName: top.lastName || top.name, line: top.total > 1 ? `${line} (${top.total} this season)` : line };
}

/** Dark text on light team colors (gold, silver) so the button stays readable. */
function buttonTextColor(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#0f172a' : '#ffffff';
}

export interface GearCardOptions {
  sport: 'nhl' | 'mlb' | 'nfl';
  teamSlug: string;
  teamCity: string;
  teamName: string;
  logoUrl: string;
  color: string;
  placement: EmailPlacement;
  /** Featured player after a win; omit for the team-gear version. */
  hero?: GearHero | null;
  /** Small label above the headline. */
  eyebrow?: string;
}

/** The NHL templates stack sections as `<tr>` rows of the 600px table. */
export function renderGearCard(o: GearCardOptions): string {
  const card = gearCardTable(o);
  return card ? `
        <tr><td style="padding:0 20px 20px;">${card}</td></tr>` : '';
}

/**
 * One Fanatics offer as a self-contained card (for brandEmailShell bodies).
 * Renders nothing until the Fanatics affiliate link is configured: Amazon
 * links are not allowed in email.
 */
export function gearCardTable(o: GearCardOptions, marginBottom = 0): string {
  if (!FANATICS_ENABLED) return '';

  const storeLink = o.sport === 'nfl'
    ? generateFanaticsLink(o.teamCity, o.teamName, '', { team: `nfl-${o.teamSlug}`, placement: o.placement })
    : generateFanaticsTeamLink(o.sport, o.teamSlug, o.placement, o.teamCity, o.teamName);
  const text = buttonTextColor(o.color);

  const hero = o.hero;
  const eyebrow = o.eyebrow || (hero ? 'Star of the night' : `${o.teamName} fan shop`);
  const headline = hero ? hero.name : `Official ${o.teamCity} ${o.teamName} gear`;
  const sub = hero ? hero.line : 'Jerseys, hats and more at Fanatics';
  const primaryHref = hero
    ? generateFanaticsPlayerLink(o.sport, o.teamSlug, o.teamName, hero.name, o.placement)
    : storeLink;
  const primaryLabel = hero ? `Shop ${hero.lastName} Jerseys` : `Shop ${o.teamName} Gear`;

  return `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid ${o.color};border-radius:8px;${marginBottom ? `margin-bottom:${marginBottom}px;` : ''}">
            <tr><td style="padding:14px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="52" valign="middle"><img src="${o.logoUrl}" alt="${o.teamName}" width="44" style="display:block;max-height:44px;" /></td>
                  <td valign="middle" style="padding-left:12px;">
                    <span style="display:block;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${eyebrow}</span>
                    <span style="display:block;font-size:16px;font-weight:800;color:#1e293b;margin-top:2px;">${headline}</span>
                    <span style="display:block;font-size:13px;color:#64748b;margin-top:2px;">${sub}</span>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin-top:14px;">
                <tr>
                  <td><a href="${primaryHref}" style="display:inline-block;background:${o.color};color:${text};padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${primaryLabel}</a></td>
                  ${hero ? `<td style="padding-left:14px;"><a href="${storeLink}" style="font-size:13px;font-weight:600;color:#334155;text-decoration:none;">All ${o.teamName} gear &rarr;</a></td>` : ''}
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">Lindy&rsquo;s Five earns a commission on Fanatics purchases made through these links.</p>
            </td></tr>
          </table>`;
}

/** Gear card options for any subscriber team slug (NHL, MLB or NFL). */
export function teamGearOptions(slug: string, placement: EmailPlacement): GearCardOptions | null {
  const team = findTeam(slug);
  if (!team) return null;
  const sport = 'sport' in team && team.sport === 'nfl' ? 'nfl' : slug in NHL_TEAMS ? 'nhl' : 'mlb';
  return {
    sport,
    teamSlug: slug,
    teamCity: team.city,
    teamName: team.name,
    logoUrl: espnLogoUrl(sport, team.abbreviation),
    color: team.colors.primary,
    placement,
  };
}
