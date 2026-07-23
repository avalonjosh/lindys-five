import React from 'react';
import { readFile } from 'fs/promises';
import path from 'path';
import { ImageResponse } from '@vercel/og';
import { put } from '@vercel/blob';
import { TEAMS, type TeamConfig } from '@/lib/teamConfig';
import { franchiseLogo, franchiseColor } from '@/lib/perfectseason/logos';
import { modeBadgeLabel, type SharedTeam, type SharedTeamRow } from '@/lib/perfectseason/share';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// ---- Brand fonts (node runtime only — the edge /api/og path keeps defaults) ----
// Bebas Neue = site display font for headlines/labels; Inter carries scores and
// secondary text with true bold weights (satori's default font has no bold).
type BrandFont = { name: string; data: Buffer; weight: 400 | 600 | 800; style: 'normal' };
let fontsPromise: Promise<BrandFont[]> | null = null;
export function loadBrandFonts(): Promise<BrandFont[]> {
  fontsPromise ??= (async () => {
    const dir = path.join(process.cwd(), 'assets', 'fonts');
    const [inter600, inter800, bebas] = await Promise.all([
      readFile(path.join(dir, 'Inter-SemiBold.ttf')),
      readFile(path.join(dir, 'Inter-ExtraBold.ttf')),
      readFile(path.join(dir, 'BebasNeue-Regular.ttf')),
    ]);
    return [
      { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
      { name: 'Inter', data: inter800, weight: 800, style: 'normal' },
      { name: 'Bebas Neue', data: bebas, weight: 400, style: 'normal' },
    ];
  })();
  return fontsPromise;
}

// ---- Team-color background helpers ----
const NAVY = '#0a1128';

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Single-team background: primary color eased into deep navy. */
function teamGradient(primary: string): string {
  return `linear-gradient(135deg, ${mixHex(primary, NAVY, 0.2)} 0%, ${mixHex(primary, NAVY, 0.75)} 100%)`;
}

/** Two-team background: away color on the left, home on the right, dark center. */
function matchupGradient(awayPrimary: string, homePrimary: string): string {
  return `linear-gradient(115deg, ${mixHex(awayPrimary, NAVY, 0.35)} 0%, ${mixHex(awayPrimary, NAVY, 0.72)} 40%, ${mixHex(homePrimary, NAVY, 0.72)} 60%, ${mixHex(homePrimary, NAVY, 0.35)} 100%)`;
}

/** Dark-background logo variant: NHL ships one; the Bills logo works as-is. */
function darkLogo(abbrev: string): string {
  if (abbrev === 'BILLS') return BILLS_OG_TEAM.logo;
  return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_dark.svg`;
}

// ---- Shared card elements ----

function glow(top = '42%') {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        background: `radial-gradient(circle at 50% ${top}, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%)`,
      }}
    />
  );
}

function watermark(logo: string, side: 'left' | 'right', opacity = 0.1) {
  return (
    <img
      src={logo}
      width={520}
      height={520}
      style={{
        position: 'absolute',
        top: -70,
        [side]: -120,
        objectFit: 'contain',
        opacity,
      }}
    />
  );
}

function topBar(colors: string[]) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, display: 'flex' }}>
      {colors.map((c, i) => (
        <div key={i} style={{ flex: 1, background: c, display: 'flex' }} />
      ))}
    </div>
  );
}

function kicker(text: string, accent: string) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 26,
      }}
    >
      <div style={{ display: 'flex', width: 44, height: 4, background: accent, borderRadius: 2 }} />
      <div
        style={{
          display: 'flex',
          fontFamily: 'Bebas Neue',
          fontSize: 30,
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: 8,
        }}
      >
        {text}
      </div>
      <div style={{ display: 'flex', width: 44, height: 4, background: accent, borderRadius: 2 }} />
    </div>
  );
}

function brandBadge() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 26,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 26px',
        borderRadius: 999,
        border: '1.5px solid rgba(255,255,255,0.3)',
        background: 'rgba(10,17,40,0.35)',
        fontFamily: 'Bebas Neue',
        fontSize: 24,
        letterSpacing: 4,
        color: 'rgba(255,255,255,0.9)',
      }}
    >
      LINDY&apos;S FIVE
    </div>
  );
}

function getTeamByAbbrev(abbrev: string): TeamConfig | undefined {
  return Object.values(TEAMS).find(t => t.abbreviation === abbrev);
}

// Pseudo-abbrev for the Bills (NFL, not in the NHL TEAMS config).
// Pass teamAbbrev: 'BILLS' to the news/weekly templates for Bills content.
const BILLS_OG_TEAM = {
  city: 'Buffalo',
  name: 'Bills',
  logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  colors: { primary: '#00338D', secondary: '#00338D', accent: '#C60C30' },
};

function getOgTeam(abbrev: string): { city: string; name: string; logo: string; colors: { primary: string; secondary: string; accent: string } } | undefined {
  if (abbrev === 'BILLS') return BILLS_OG_TEAM;
  const team = getTeamByAbbrev(abbrev);
  if (!team) return undefined;
  return { city: team.city, name: team.name, logo: team.logo, colors: team.colors };
}

function gameRecapTemplate({
  homeAbbrev,
  awayAbbrev,
  homeScore,
  awayScore,
  gameDate,
  periodType,
  label,
}: {
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  gameDate: string;
  periodType?: string;
  label?: string;
}) {
  const homeTeam = getTeamByAbbrev(homeAbbrev);
  const awayTeam = getTeamByAbbrev(awayAbbrev);
  const homePrimary = homeTeam?.colors.primary || '#1e3a8a';
  const awayPrimary = awayTeam?.colors.primary || '#1e3a8a';
  const accent = homeTeam?.colors.accent || '#FFB81C';
  const suffix = periodType === 'OT' ? ' / OT' : periodType === 'SO' ? ' / SO' : '';

  const formattedDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: matchupGradient(awayPrimary, homePrimary),
        position: 'relative',
      }}
    >
      {watermark(darkLogo(awayAbbrev), 'left', 0.09)}
      {watermark(darkLogo(homeAbbrev), 'right', 0.09)}
      {glow()}
      {topBar([awayTeam?.colors.accent || awayPrimary, accent])}

      {kicker(label || 'GAME RECAP', accent)}

      {/* Main matchup row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
        }}
      >
        {/* Away team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img src={darkLogo(awayAbbrev)} width={160} height={160} style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 38, letterSpacing: 2, color: 'rgba(255,255,255,0.95)' }}>
            {awayTeam?.city || awayAbbrev}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 24,
              fontFamily: 'Inter',
              fontSize: 130,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            <span>{awayScore}</span>
            <span style={{ fontSize: 56, color: 'rgba(255,255,255,0.45)' }}>–</span>
            <span>{homeScore}</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Bebas Neue',
              fontSize: 28,
              letterSpacing: 6,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            FINAL{suffix}
          </div>
        </div>

        {/* Home team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img src={darkLogo(homeAbbrev)} width={160} height={160} style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 38, letterSpacing: 2, color: 'rgba(255,255,255,0.95)' }}>
            {homeTeam?.city || homeAbbrev}
          </div>
        </div>
      </div>

      {/* Date */}
      <div
        style={{
          display: 'flex',
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: 21,
          color: 'rgba(255,255,255,0.6)',
          marginTop: 30,
        }}
      >
        {formattedDate}
      </div>

      {brandBadge()}
    </div>
  );
}

function setRecapTemplate({
  teamAbbrev,
  setNumber,
  wins,
  losses,
  otLosses,
  targetMet,
}: {
  teamAbbrev: string;
  setNumber: number;
  wins: number;
  losses: number;
  otLosses: number;
  targetMet: boolean;
}) {
  const team = getTeamByAbbrev(teamAbbrev);
  const primary = team?.colors.primary || '#1e3a8a';
  const accent = team?.colors.accent || '#FFB81C';
  const record = `${wins}-${losses}${otLosses > 0 ? `-${otLosses}` : ''}`;
  const statusColor = targetMet ? '#4ade80' : '#f87171';
  const statusText = targetMet ? 'TARGET MET' : 'TARGET MISSED';

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: teamGradient(primary),
        position: 'relative',
      }}
    >
      {watermark(darkLogo(teamAbbrev), 'right', 0.1)}
      {glow()}
      {topBar([accent])}

      {kicker(`SET ${setNumber} RECAP`, accent)}

      {/* Team logo */}
      <img src={darkLogo(teamAbbrev)} width={140} height={140} style={{ objectFit: 'contain' }} />

      {/* Record */}
      <div
        style={{
          display: 'flex',
          fontFamily: 'Inter',
          fontSize: 110,
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1,
          marginTop: 22,
        }}
      >
        {record}
      </div>

      {/* Target status */}
      <div
        style={{
          display: 'flex',
          marginTop: 24,
          padding: '8px 28px',
          borderRadius: 999,
          background: 'rgba(10,17,40,0.35)',
          border: `2px solid ${statusColor}`,
          fontFamily: 'Bebas Neue',
          fontSize: 26,
          color: statusColor,
          letterSpacing: 4,
        }}
      >
        {statusText}
      </div>

      {brandBadge()}
    </div>
  );
}

function newsTemplate({
  teamAbbrev,
  headline,
}: {
  teamAbbrev: string;
  headline: string;
}) {
  const team = getOgTeam(teamAbbrev);
  const primary = team?.colors.primary || '#1e3a8a';
  const accent = team?.colors.accent || '#FFB81C';

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: teamGradient(primary),
        position: 'relative',
        padding: '60px 90px',
      }}
    >
      {watermark(darkLogo(teamAbbrev), 'right', 0.1)}
      {glow('38%')}
      {topBar([accent])}

      {/* Team logo */}
      <img src={darkLogo(teamAbbrev)} width={130} height={130} style={{ objectFit: 'contain' }} />

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          fontFamily: 'Bebas Neue',
          fontSize: headline.length > 60 ? 62 : 76,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.08,
          letterSpacing: 1,
          marginTop: 28,
          maxWidth: 1020,
        }}
      >
        {headline}
      </div>

      {brandBadge()}
    </div>
  );
}

function weeklyRoundupTemplate({
  teamAbbrev,
  weekRecord,
  weekStart,
  weekEnd,
}: {
  teamAbbrev: string;
  weekRecord: string;
  weekStart: string;
  weekEnd: string;
}) {
  const team = getOgTeam(teamAbbrev);
  const primary = team?.colors.primary || '#1e3a8a';
  const accent = team?.colors.accent || '#FFB81C';

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: teamGradient(primary),
        position: 'relative',
      }}
    >
      {watermark(darkLogo(teamAbbrev), 'right', 0.1)}
      {glow()}
      {topBar([accent])}

      {kicker('WEEKLY ROUNDUP', accent)}

      {/* Team logo */}
      <img src={darkLogo(teamAbbrev)} width={140} height={140} style={{ objectFit: 'contain' }} />

      {/* Week record */}
      <div
        style={{
          display: 'flex',
          fontFamily: 'Inter',
          fontSize: 100,
          fontWeight: 800,
          color: '#fff',
          marginTop: 22,
          lineHeight: 1,
        }}
      >
        {weekRecord}
      </div>

      {/* Date range */}
      <div
        style={{
          display: 'flex',
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: 23,
          color: 'rgba(255,255,255,0.65)',
          marginTop: 18,
        }}
      >
        {formatDate(weekStart)} – {formatDate(weekEnd)}
      </div>

      {brandBadge()}
    </div>
  );
}

function seriesRecapTemplate({
  winnerAbbrev,
  loserAbbrev,
  seriesResult,
  roundLabel,
}: {
  winnerAbbrev: string;
  loserAbbrev: string;
  seriesResult: string;
  roundLabel: string;
}) {
  const winner = getTeamByAbbrev(winnerAbbrev);
  const loser = getTeamByAbbrev(loserAbbrev);
  const winnerPrimary = winner?.colors.primary || '#1e3a8a';
  const loserPrimary = loser?.colors.primary || '#1e3a8a';
  const accent = winner?.colors.accent || '#FFB81C';

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: matchupGradient(winnerPrimary, loserPrimary),
        position: 'relative',
      }}
    >
      {watermark(darkLogo(winnerAbbrev), 'left', 0.09)}
      {glow()}
      {topBar([accent, loser?.colors.accent || loserPrimary])}

      {kicker(`${roundLabel} — SERIES RECAP`, accent)}

      {/* Matchup row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img src={darkLogo(winnerAbbrev)} width={160} height={160} style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 36, letterSpacing: 2, color: '#fff' }}>
            {winner?.name || winnerAbbrev}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: 110, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {seriesResult}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 26, color: 'rgba(255,255,255,0.7)', letterSpacing: 6 }}>
            SERIES
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img src={darkLogo(loserAbbrev)} width={160} height={160} style={{ objectFit: 'contain', opacity: 0.45 }} />
          <div style={{ display: 'flex', fontFamily: 'Bebas Neue', fontSize: 36, letterSpacing: 2, color: 'rgba(255,255,255,0.6)' }}>
            {loser?.name || loserAbbrev}
          </div>
        </div>
      </div>

      {/* Winner banner */}
      <div
        style={{
          display: 'flex',
          marginTop: 30,
          padding: '8px 28px',
          borderRadius: 999,
          background: 'rgba(10,17,40,0.35)',
          border: `2px solid ${accent}`,
          fontFamily: 'Bebas Neue',
          fontSize: 26,
          color: '#fff',
          letterSpacing: 4,
        }}
      >
        {(winner?.name || winnerAbbrev).toUpperCase()} WIN THE SERIES
      </div>

      {brandBadge()}
    </div>
  );
}

function sportHubTemplate({
  sport,
  title,
  subtitle,
}: {
  sport: 'nhl' | 'mlb';
  title: string;
  subtitle: string;
}) {
  const isNHL = sport === 'nhl';
  const accentLeft = isNHL ? '#003087' : '#002D72';
  const accentRight = isNHL ? '#0A1128' : '#E81828';
  const sportLabel = isNHL ? 'NHL' : 'MLB';

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
        position: 'relative',
        padding: 64,
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          display: 'flex',
        }}
      >
        <div style={{ flex: 1, background: accentLeft, display: 'flex' }} />
        <div style={{ flex: 1, background: accentRight, display: 'flex' }} />
      </div>

      {/* Sport label */}
      <div
        style={{
          display: 'flex',
          fontSize: 22,
          fontWeight: 800,
          color: '#8FBCE6',
          letterSpacing: 10,
          textTransform: 'uppercase',
          marginBottom: 28,
        }}
      >
        {sportLabel} Playoff Tracker
      </div>

      {/* Title */}
      <div
        style={{
          display: 'flex',
          fontSize: 88,
          fontWeight: 900,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.05,
          marginBottom: 24,
          letterSpacing: -1,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          display: 'flex',
          fontSize: 36,
          fontWeight: 600,
          color: '#cbd5e1',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 1000,
        }}
      >
        {subtitle}
      </div>

      {/* Site brand */}
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: 2,
        }}
      >
        Lindy&apos;s Five &nbsp;&bull;&nbsp; lindysfive.com
      </div>
    </div>
  );
}

function gradeColor(grade: string): string {
  switch (grade.charAt(0)) {
    case 'A': return '#22c55e';
    case 'B': return '#38bdf8';
    case 'C': return '#f59e0b';
    case 'D': return '#f97316';
    default: return '#ef4444';
  }
}

function psPlayerRow(row: SharedTeamRow, sport: 'nhl' | 'mlb', size: number, nameFont: number, subFont: number) {
  const logo = franchiseLogo(row.franchiseId, sport, 'dark');
  const color = franchiseColor(row.franchiseId, sport) || '#1e3a8a';
  return (
    <div key={`${row.slot}-${row.playerName}`} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Slot chip with faint team logo behind the position label */}
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: 10,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {logo && (
          <img
            src={logo}
            width={Math.round(size * 0.78)}
            height={Math.round(size * 0.78)}
            style={{ position: 'absolute', objectFit: 'contain', opacity: 0.35 }}
          />
        )}
        <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 800, color: '#ffffff' }}>{row.slot}</span>
      </div>
      {/* Name + franchise / decade */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', fontSize: nameFont, fontWeight: 700, color: '#f8fafc' }}>{row.playerName}</div>
        <div style={{ display: 'flex', fontSize: subFont, fontWeight: 500, color: '#94a3b8' }}>
          {row.franchiseId} &middot; {row.decade}
        </div>
      </div>
    </div>
  );
}

function psTeamTemplate(team: SharedTeam) {
  const isNHL = team.sport === 'nhl';
  const slug = isNHL ? '82-0' : '162-0';
  const accentLeft = isNHL ? '#003087' : '#002D72';
  const accentRight = isNHL ? '#0A1128' : '#E81828';
  const twoCol = team.rows.length > 6;
  const half = Math.ceil(team.rows.length / 2);
  const columns = twoCol ? [team.rows.slice(0, half), team.rows.slice(half)] : [team.rows];
  // The longest column drives sizing so the rows fit under the header. Six in one
  // column (NHL) needs a tighter row than five per column (MLB two-up).
  const longest = twoCol ? half : team.rows.length;
  const compact = longest >= 6;
  const rowSize = compact ? 42 : 48;
  const nameFont = compact ? 23 : 26;
  const subFont = compact ? 15 : 17;
  const ROW_GAP = compact ? 8 : 12;

  return (
    <div
      style={{
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0b1220 0%, #111a2e 55%, #0b1220 100%)',
        position: 'relative',
        padding: '40px 48px',
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, display: 'flex' }}>
        <div style={{ flex: 1, background: accentLeft, display: 'flex' }} />
        <div style={{ flex: 1, background: accentRight, display: 'flex' }} />
      </div>

      {/* Header: projected record + grade, team OVR */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#64748b', letterSpacing: 4 }}>
            PROJECTED RECORD
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
              {team.wins}-{team.losses}
            </div>
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 900, color: gradeColor(team.grade), lineHeight: 1.1 }}>
              {team.grade}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 10,
              padding: '6px 16px',
              borderRadius: 8,
              background: 'rgba(56,189,248,0.15)',
              fontSize: 18,
              fontWeight: 700,
              color: '#7dd3fc',
              letterSpacing: 2,
            }}
          >
            {modeBadgeLabel(team.variant, team.modeType)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#64748b', letterSpacing: 4 }}>
            TEAM OVR
          </div>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
            {Math.round(team.rating)}
          </div>
        </div>
      </div>

      {/* Roster rows (one or two columns) */}
      <div style={{ display: 'flex', gap: 48, marginTop: 14, flex: 1, overflow: 'hidden' }}>
        {columns.map((col, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP, flex: 1 }}>
            {col.map((row) => psPlayerRow(row, team.sport, rowSize, nameFont, subFont))}
          </div>
        ))}
      </div>

      {/* Footer: hook + brand */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>Can you go {slug}?</div>
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#7dd3fc' }}>lindysfive.com/{slug}</div>
      </div>
    </div>
  );
}

export type OgImageType = 'game-recap' | 'set-recap' | 'news-analysis' | 'weekly-roundup' | 'series-recap' | 'sport-hub' | 'ps-team';

export interface GameRecapImageParams {
  type: 'game-recap';
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  gameDate: string;
  periodType?: string;
  label?: string;
}

export interface SeriesRecapImageParams {
  type: 'series-recap';
  winnerAbbrev: string;
  loserAbbrev: string;
  seriesResult: string;
  roundLabel: string;
}

export interface SetRecapImageParams {
  type: 'set-recap';
  teamAbbrev: string;
  setNumber: number;
  wins: number;
  losses: number;
  otLosses: number;
  targetMet: boolean;
}

export interface NewsImageParams {
  type: 'news-analysis';
  teamAbbrev: string;
  headline: string;
}

export interface WeeklyRoundupImageParams {
  type: 'weekly-roundup';
  teamAbbrev: string;
  weekRecord: string;
  weekStart: string;
  weekEnd: string;
}

export interface SportHubImageParams {
  type: 'sport-hub';
  sport: 'nhl' | 'mlb';
  title: string;
  subtitle: string;
}

export interface PsTeamImageParams {
  type: 'ps-team';
  team: SharedTeam;
}

export type OgImageParams = GameRecapImageParams | SetRecapImageParams | NewsImageParams | WeeklyRoundupImageParams | SeriesRecapImageParams | SportHubImageParams | PsTeamImageParams;

function buildElement(params: OgImageParams): React.JSX.Element {
  switch (params.type) {
    case 'game-recap':
      return gameRecapTemplate(params);
    case 'set-recap':
      return setRecapTemplate(params);
    case 'news-analysis':
      return newsTemplate(params);
    case 'weekly-roundup':
      return weeklyRoundupTemplate(params);
    case 'series-recap':
      return seriesRecapTemplate(params);
    case 'sport-hub':
      return sportHubTemplate(params);
    case 'ps-team':
      return psTeamTemplate(params.team);
  }
}

// Edge-safe (no fs): used by /api/og for hub + Perfect Season cards, which keep
// the default font. Blog cards go through generateAndUploadOgImage below, where
// the brand fonts load from disk.
export function generateOgImageResponse(params: OgImageParams): ImageResponse {
  return new ImageResponse(buildElement(params), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
  });
}

export async function generateAndUploadOgImage(params: OgImageParams, slug: string): Promise<string> {
  const fonts = await loadBrandFonts();
  const response = new ImageResponse(buildElement(params), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  const buffer = await response.arrayBuffer();

  const blob = await put(`blog/og/${slug}.png`, Buffer.from(buffer), {
    access: 'public',
    contentType: 'image/png',
    allowOverwrite: true,
  });

  return blob.url;
}
