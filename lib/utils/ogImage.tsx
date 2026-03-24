import React from 'react';
import { ImageResponse } from '@vercel/og';
import { put } from '@vercel/blob';
import { TEAMS, type TeamConfig } from '@/lib/teamConfig';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

function getTeamByAbbrev(abbrev: string): TeamConfig | undefined {
  return Object.values(TEAMS).find(t => t.abbreviation === abbrev);
}

function gameRecapTemplate({
  homeAbbrev,
  awayAbbrev,
  homeScore,
  awayScore,
  gameDate,
  periodType,
}: {
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  gameDate: string;
  periodType?: string;
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
        GAME RECAP
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
  const team = getTeamByAbbrev(teamAbbrev);
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
        width={100}
        height={100}
        style={{ objectFit: 'contain', opacity: 0.3 }}
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
  const team = getTeamByAbbrev(teamAbbrev);
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

export type OgImageType = 'game-recap' | 'set-recap' | 'news-analysis' | 'weekly-roundup';

export interface GameRecapImageParams {
  type: 'game-recap';
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  gameDate: string;
  periodType?: string;
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

export type OgImageParams = GameRecapImageParams | SetRecapImageParams | NewsImageParams | WeeklyRoundupImageParams;

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
