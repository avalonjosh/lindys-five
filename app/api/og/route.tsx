import { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { generateOgImageResponse, type OgImageParams } from '@/lib/utils/ogImage';
import { shareKey, type SharedTeam } from '@/lib/perfectseason/share';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as OgImageParams['type'];

  if (!type) {
    return new Response('Missing type parameter', { status: 400 });
  }

  try {
    let params: OgImageParams;

    switch (type) {
      case 'ps-team': {
        const id = searchParams.get('id');
        if (!id) return new Response('Missing id parameter', { status: 400 });
        const team = await kv.get<SharedTeam>(shareKey(id));
        if (!team) return new Response('Team not found', { status: 404 });
        params = { type: 'ps-team', team };
        break;
      }
      case 'game-recap':
        params = {
          type: 'game-recap',
          homeAbbrev: searchParams.get('homeAbbrev') || 'BUF',
          awayAbbrev: searchParams.get('awayAbbrev') || 'TOR',
          homeScore: parseInt(searchParams.get('homeScore') || '4'),
          awayScore: parseInt(searchParams.get('awayScore') || '2'),
          gameDate: searchParams.get('gameDate') || new Date().toISOString().split('T')[0],
          periodType: searchParams.get('periodType') || undefined,
          label: searchParams.get('label') || undefined,
        };
        break;
      case 'set-recap':
        params = {
          type: 'set-recap',
          teamAbbrev: searchParams.get('teamAbbrev') || 'BUF',
          setNumber: parseInt(searchParams.get('setNumber') || '1'),
          wins: parseInt(searchParams.get('wins') || '3'),
          losses: parseInt(searchParams.get('losses') || '2'),
          otLosses: parseInt(searchParams.get('otLosses') || '0'),
          targetMet: searchParams.get('targetMet') === 'true',
        };
        break;
      case 'news-analysis':
        params = {
          type: 'news-analysis',
          teamAbbrev: searchParams.get('teamAbbrev') || 'BUF',
          headline: searchParams.get('headline') || 'Breaking News',
        };
        break;
      case 'weekly-roundup':
        params = {
          type: 'weekly-roundup',
          teamAbbrev: searchParams.get('teamAbbrev') || 'BUF',
          weekRecord: searchParams.get('weekRecord') || '2-1-0',
          weekStart: searchParams.get('weekStart') || '2026-03-17',
          weekEnd: searchParams.get('weekEnd') || '2026-03-23',
        };
        break;
      case 'series-recap':
        params = {
          type: 'series-recap',
          winnerAbbrev: searchParams.get('winnerAbbrev') || 'BUF',
          loserAbbrev: searchParams.get('loserAbbrev') || 'TOR',
          seriesResult: searchParams.get('seriesResult') || '4-2',
          roundLabel: searchParams.get('roundLabel') || 'First Round',
        };
        break;
      case 'sport-hub': {
        const sportParam = searchParams.get('sport');
        const sport: 'nhl' | 'mlb' = sportParam === 'mlb' ? 'mlb' : 'nhl';
        params = {
          type: 'sport-hub',
          sport,
          title: searchParams.get('title') || (sport === 'mlb' ? 'MLB Playoff Odds 2026' : 'NHL Playoff Odds 2025-26'),
          subtitle: searchParams.get('subtitle') || (sport === 'mlb' ? 'Standings & Projections for All 30 Teams' : 'Standings & Projections for All 32 Teams'),
        };
        break;
      }
      default:
        return new Response(`Unknown type: ${type}`, { status: 400 });
    }

    return generateOgImageResponse(params);
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
