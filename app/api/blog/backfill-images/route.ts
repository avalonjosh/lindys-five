import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import { generateAndUploadOgImage, type OgImageParams } from '@/lib/utils/ogImage';
import { TEAMS } from '@/lib/teamConfig';
import type { BlogPost } from '@/lib/types';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

export const maxDuration = 300;

interface ScheduleGame {
  gameDate: string;
  gameType: number;
  gameState: string;
  homeTeam: { abbrev: string; score?: number };
  awayTeam: { abbrev: string; score?: number };
  gameOutcome?: { lastPeriodType?: string };
}

interface GameResult {
  date: string;
  outcome: 'W' | 'L' | 'OTL';
}

// Completed regular-season Sabres games for a season, in date order.
async function fetchSeasonResults(season: string): Promise<GameResult[]> {
  const data = await fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/${season}`);
  const games: ScheduleGame[] = data?.games || [];
  return games
    .filter((g) => g.gameType === 2 && (g.gameState === 'OFF' || g.gameState === 'FINAL'))
    .map((g) => {
      const isHome = g.homeTeam.abbrev === 'BUF';
      const us = (isHome ? g.homeTeam.score : g.awayTeam.score) ?? 0;
      const them = (isHome ? g.awayTeam.score : g.homeTeam.score) ?? 0;
      const lastType = g.gameOutcome?.lastPeriodType || 'REG';
      const outcome: GameResult['outcome'] = us > them ? 'W' : lastType !== 'REG' ? 'OTL' : 'L';
      return { date: g.gameDate, outcome };
    });
}

// NHL season string ("20252026") for a post's date: seasons start in the fall.
function seasonFor(dateIso: string): string {
  const d = new Date(dateIso);
  const y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}${y + 1}` : `${y - 1}${y}`;
}

function record(results: GameResult[]) {
  const wins = results.filter((r) => r.outcome === 'W').length;
  const losses = results.filter((r) => r.outcome === 'L').length;
  const otLosses = results.filter((r) => r.outcome === 'OTL').length;
  return { wins, losses, otLosses, points: wins * 2 + otLosses };
}

// POST /api/blog/backfill-images?dry=1
// Generates a branded card image for every published post that lacks one.
// Idempotent: posts with an ogImage are skipped.
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dry = request.nextUrl.searchParams.get('dry') === '1';

  const postIds = await kv.zrange<string[]>('blog:posts', 0, -1, { rev: true });
  if (!postIds || postIds.length === 0) return NextResponse.json({ processed: 0, results: [] });

  const records = await kv.mget<(BlogPost | null)[]>(...postIds.map((id) => `blog:post:${id}`));
  const targets = records.filter(
    (p): p is BlogPost => !!p && p.status === 'published' && !p.ogImage
  );

  const seasonCache = new Map<string, GameResult[]>();
  const getSeasonResults = async (season: string) => {
    if (!seasonCache.has(season)) seasonCache.set(season, await fetchSeasonResults(season));
    return seasonCache.get(season)!;
  };

  const results: { slug: string; type: string; template: string; ok: boolean; error?: string }[] = [];

  for (const post of targets) {
    const teamAbbrev = post.team === 'bills' ? 'BILLS' : TEAMS[post.team]?.abbreviation || 'BUF';
    let params: OgImageParams | null = null;
    let template = 'news-analysis';

    try {
      if ((post.type === 'game-recap' || post.type === 'playoff-game-recap') && post.gameId && post.team !== 'bills') {
        // Real score card from the NHL API
        const landing = await fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${post.gameId}/landing`);
        const periodType = landing?.gameOutcome?.lastPeriodType;
        params = {
          type: 'game-recap',
          homeAbbrev: landing.homeTeam?.abbrev || 'BUF',
          awayAbbrev: landing.awayTeam?.abbrev || 'BUF',
          homeScore: landing.homeTeam?.score ?? 0,
          awayScore: landing.awayTeam?.score ?? 0,
          gameDate: landing.gameDate || post.gameDate || post.createdAt.slice(0, 10),
          periodType: periodType && periodType !== 'REG' ? periodType : undefined,
          label: post.type === 'playoff-game-recap' ? 'PLAYOFF RECAP' : undefined,
        };
        template = 'game-recap';
      } else if (post.type === 'set-recap' && post.setNumber && post.team === 'sabres') {
        // Recompute the set's record from that season's schedule
        const season = seasonFor(post.gameDate?.split(' ')[0] || post.publishedAt || post.createdAt);
        const seasonResults = await getSeasonResults(season);
        const setGames = seasonResults.slice((post.setNumber - 1) * 5, post.setNumber * 5);
        if (setGames.length === 5) {
          const r = record(setGames);
          params = {
            type: 'set-recap',
            teamAbbrev: 'BUF',
            setNumber: post.setNumber,
            wins: r.wins,
            losses: r.losses,
            otLosses: r.otLosses,
            targetMet: r.points >= 6,
          };
          template = 'set-recap';
        }
      } else if (post.type === 'weekly-roundup' && post.team === 'sabres' && post.weekStartDate && post.weekEndDate) {
        const season = seasonFor(post.weekStartDate);
        const seasonResults = await getSeasonResults(season);
        const weekGames = seasonResults.filter(
          (g) => g.date >= post.weekStartDate! && g.date <= post.weekEndDate!
        );
        if (weekGames.length > 0) {
          const r = record(weekGames);
          params = {
            type: 'weekly-roundup',
            teamAbbrev: 'BUF',
            weekRecord: `${r.wins}-${r.losses}${r.otLosses > 0 ? `-${r.otLosses}` : ''}`,
            weekStart: post.weekStartDate,
            weekEnd: post.weekEndDate,
          };
          template = 'weekly-roundup';
        }
      }

      // Everything else (news, custom, Bills posts, missing data): headline card
      if (!params) {
        params = { type: 'news-analysis', teamAbbrev, headline: post.title };
        template = 'news-analysis';
      }

      if (!dry) {
        const url = await generateAndUploadOgImage(params, `backfill-${post.slug}`);
        await kv.set(`blog:post:${post.id}`, { ...post, ogImage: url });
      }
      results.push({ slug: post.slug, type: post.type, template, ok: true });
    } catch (error) {
      results.push({
        slug: post.slug,
        type: post.type,
        template,
        ok: false,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return NextResponse.json({
    dry,
    candidates: targets.length,
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
