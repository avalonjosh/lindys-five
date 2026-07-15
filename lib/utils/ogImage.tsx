import React from 'react';
import { ImageResponse } from '@vercel/og';
import { put } from '@vercel/blob';
import { TEAMS, type TeamConfig } from '@/lib/teamConfig';
import { franchiseLogo, franchiseColor } from '@/lib/perfectseason/logos';
import { modeBadgeLabel, type SharedTeam, type SharedTeamRow } from '@/lib/perfectseason/share';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

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
  const homePrimary = homeTeam?.colors.primary || '#333';
  const awayPrimary = awayTeam?.colors.primary || '#333';
  const suffix = periodType === 'OT' ? ' OT' : periodType === 'SO' ? ' SO' : '';

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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
        position: 'relative',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          display: 'flex',
        }}
      >
        <div style={{ flex: 1, background: awayPrimary, display: 'flex' }} />
        <div style={{ flex: 1, background: homePrimary, display: 'flex' }} />
      </div>

      {/* GAME RECAP label */}
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          fontWeight: 700,
          color: '#888',
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        {label || 'GAME RECAP'}
      </div>

      {/* Main matchup row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        {/* Away team */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <img
            src={awayTeam?.logo || `https://assets.nhle.com/logos/nhl/svg/${awayAbbrev}_light.svg`}
            width={140}
            height={140}
            style={{ objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: '#ccc' }}>
            {awayTeam?.city || awayAbbrev}
          </div>
        </div>

        {/* Score */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 20,
              fontSize: 96,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            <span>{awayScore}</span>
            <span style={{ fontSize: 48, color: '#444' }}>-</span>
            <span>{homeScore}</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
            }}
          >
            FINAL{suffix}
          </div>
        </div>

        {/* Home team */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <img
            src={homeTeam?.logo || `https://assets.nhle.com/logos/nhl/svg/${homeAbbrev}_light.svg`}
            width={140}
            height={140}
            style={{ objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: '#ccc' }}>
            {homeTeam?.city || homeAbbrev}
          </div>
        </div>
      </div>

      {/* Date */}
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          color: '#666',
          marginTop: 32,
        }}
      >
        {formattedDate}
      </div>

      {/* Bottom branding */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 16,
          color: '#444',
        }}
      >
        lindysfive.com
      </div>
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
  const primary = team?.colors.primary || '#333';
  const record = `${wins}-${losses}${otLosses > 0 ? `-${otLosses}` : ''}`;
  const statusColor = targetMet ? '#22c55e' : '#ef4444';
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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
        position: 'relative',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: primary,
          display: 'flex',
        }}
      />

      {/* SET RECAP label */}
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          fontWeight: 700,
          color: '#888',
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        SET RECAP
      </div>

      {/* Team logo */}
      <img
        src={team?.logo || `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`}
        width={120}
        height={120}
        style={{ objectFit: 'contain' }}
      />

      {/* Set number and record */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 24,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: '#aaa' }}>
          Set {setNumber}
        </div>
        <div style={{ display: 'flex', fontSize: 80, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
          {record}
        </div>
      </div>

      {/* Target status */}
      <div
        style={{
          display: 'flex',
          marginTop: 20,
          padding: '8px 24px',
          borderRadius: 8,
          background: `${statusColor}22`,
          border: `2px solid ${statusColor}`,
          fontSize: 20,
          fontWeight: 700,
          color: statusColor,
          letterSpacing: 2,
        }}
      >
        {statusText}
      </div>

      {/* Bottom branding */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          display: 'flex',
          fontSize: 16,
          color: '#444',
        }}
      >
        lindysfive.com
      </div>
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
  const primary = team?.colors.primary || '#333';

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
        padding: '60px 80px',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: primary,
          display: 'flex',
        }}
      />

      {/* Team logo */}
      <img
        src={team?.logo || `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`}
        width={110}
        height={110}
        style={{ objectFit: 'contain', opacity: 0.9 }}
      />

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          fontSize: headline.length > 60 ? 40 : 48,
          fontWeight: 800,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.2,
          marginTop: 24,
          maxWidth: 1000,
        }}
      >
        {headline}
      </div>

      {/* Bottom branding */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          display: 'flex',
          fontSize: 16,
          color: '#444',
        }}
      >
        lindysfive.com
      </div>
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
  const primary = team?.colors.primary || '#333';

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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
        position: 'relative',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: primary,
          display: 'flex',
        }}
      />

      {/* WEEKLY ROUNDUP label */}
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          fontWeight: 700,
          color: '#888',
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        WEEKLY ROUNDUP
      </div>

      {/* Team logo */}
      <img
        src={team?.logo || `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`}
        width={120}
        height={120}
        style={{ objectFit: 'contain' }}
      />

      {/* Week record */}
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          fontWeight: 800,
          color: '#fff',
          marginTop: 24,
          lineHeight: 1,
        }}
      >
        {weekRecord}
      </div>

      {/* Date range */}
      <div
        style={{
          display: 'flex',
          fontSize: 22,
          color: '#666',
          marginTop: 16,
        }}
      >
        {formatDate(weekStart)} – {formatDate(weekEnd)}
      </div>

      {/* Bottom branding */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          display: 'flex',
          fontSize: 16,
          color: '#444',
        }}
      >
        lindysfive.com
      </div>
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
  const winnerPrimary = winner?.colors.primary || '#333';
  const loserPrimary = loser?.colors.primary || '#333';

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
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          display: 'flex',
        }}
      >
        <div style={{ flex: 1, background: winnerPrimary, display: 'flex' }} />
        <div style={{ flex: 1, background: loserPrimary, display: 'flex' }} />
      </div>

      {/* Round label */}
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          fontWeight: 700,
          color: '#888',
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        {roundLabel} — SERIES RECAP
      </div>

      {/* Matchup row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img
            src={winner?.logo || `https://assets.nhle.com/logos/nhl/svg/${winnerAbbrev}_light.svg`}
            width={150}
            height={150}
            style={{ objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#fff' }}>
            {winner?.name || winnerAbbrev}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {seriesResult}
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#888', letterSpacing: 2 }}>
            SERIES
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img
            src={loser?.logo || `https://assets.nhle.com/logos/nhl/svg/${loserAbbrev}_light.svg`}
            width={150}
            height={150}
            style={{ objectFit: 'contain', opacity: 0.5 }}
          />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: '#999' }}>
            {loser?.name || loserAbbrev}
          </div>
        </div>
      </div>

      {/* Winner banner */}
      <div
        style={{
          display: 'flex',
          marginTop: 32,
          padding: '8px 24px',
          borderRadius: 8,
          background: `${winnerPrimary}44`,
          border: `2px solid ${winnerPrimary}`,
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: 2,
        }}
      >
        {(winner?.name || winnerAbbrev).toUpperCase()} WIN THE SERIES
      </div>

      {/* Bottom branding */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          display: 'flex',
          fontSize: 16,
          color: '#444',
        }}
      >
        lindysfive.com
      </div>
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

export function generateOgImageResponse(params: OgImageParams): ImageResponse {
  let element: React.JSX.Element;

  switch (params.type) {
    case 'game-recap':
      element = gameRecapTemplate(params);
      break;
    case 'set-recap':
      element = setRecapTemplate(params);
      break;
    case 'news-analysis':
      element = newsTemplate(params);
      break;
    case 'weekly-roundup':
      element = weeklyRoundupTemplate(params);
      break;
    case 'series-recap':
      element = seriesRecapTemplate(params);
      break;
    case 'sport-hub':
      element = sportHubTemplate(params);
      break;
    case 'ps-team':
      element = psTeamTemplate(params.team);
      break;
  }

  return new ImageResponse(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
  });
}

export async function generateAndUploadOgImage(params: OgImageParams, slug: string): Promise<string> {
  const response = generateOgImageResponse(params);
  const buffer = await response.arrayBuffer();

  const blob = await put(`blog/og/${slug}.png`, Buffer.from(buffer), {
    access: 'public',
    contentType: 'image/png',
  });

  return blob.url;
}
