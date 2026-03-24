import { NextRequest } from 'next/server';
import { generateOgImageResponse, type OgImageParams } from '@/lib/utils/ogImage';

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
      case 'game-recap':
        params = {
          type: 'game-recap',
          homeAbbrev: searchParams.get('homeAbbrev') || 'BUF',
          awayAbbrev: searchParams.get('awayAbbrev') || 'TOR',
          homeScore: parseInt(searchParams.get('homeScore') || '4'),
          awayScore: parseInt(searchParams.get('awayScore') || '2'),
          gameDate: searchParams.get('gameDate') || new Date().toISOString().split('T')[0],
          periodType: searchParams.get('periodType') || undefined,
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
      default:
        return new Response(`Unknown type: ${type}`, { status: 400 });
    }

    return generateOgImageResponse(params);
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
