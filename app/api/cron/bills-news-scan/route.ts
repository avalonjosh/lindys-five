import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, calculateJaccardSimilarity, truncateAtWordBoundary } from '@/lib/fetchWithRetry';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const SEMANTIC_SIMILARITY_THRESHOLD = 0.4;

const NEWS_DETECTION_PROMPT = `You are a sports news analyst for a Buffalo Bills fan blog.

Your task is to search for recent Buffalo Bills news from the last 24-48 hours and identify stories that would interest Bills fans.

Look for stories about:
- Trade rumors or completed trades involving the Bills
- Free agent signings and contract negotiations
- NFL Draft news, prospects, and mock draft analysis
- Coaching staff changes and decisions
- Injury updates and player availability
- Contract extensions
- Roster moves (cuts, signings, practice squad)

IMPORTANT: Only identify stories that are GENUINELY NEWSWORTHY.

After searching, respond with a JSON array of detected stories. For each story, include:
- topic: A brief description of the news (1-2 sentences)
- importance: 1-10 scale
- keywords: Array of keywords for deduplication
- storyKey: A unique slug for this story

If no significant Bills news is found, respond with an empty array: []`;

const ARTICLE_GENERATION_PROMPT = `You are a professional sports journalist writing a NEWS REPORT for "Lindy's Five", a Buffalo Bills publication.

CRITICAL INSTRUCTIONS:
- Write NEUTRAL, FACTUAL news reporting only
- 300-500 words, Markdown with ## headers, **bold** for names/stats
- Use web search to verify details. If you cannot verify, OMIT IT.

Do NOT include "TITLE:" or "META:" prefixes in your response.`;

async function fetchBillsContext() {
  try {
    const standingsData = await fetchJsonWithRetry(`${ESPN_API_BASE}/standings`);
    let billsRecord = 'N/A', divisionPosition = 'N/A';

    const afcConf = standingsData.children?.find((conf: any) => conf.abbreviation === 'AFC');
    const afcEast = afcConf?.children?.find((div: any) => div.name === 'AFC East');
    const billsEntry = afcEast?.standings?.entries?.find((entry: any) => entry.team?.abbreviation === 'BUF');

    if (billsEntry) {
      billsRecord = billsEntry.stats?.find((s: any) => s.name === 'overall')?.displayValue || 'N/A';
      const position = afcEast?.standings?.entries?.findIndex((e: any) => e.team?.abbreviation === 'BUF');
      if (position !== -1) divisionPosition = `${position + 1}${['st', 'nd', 'rd', 'th'][position] || 'th'} in AFC East`;
    }

    const scheduleData = await fetchJsonWithRetry(`${ESPN_API_BASE}/teams/buf/schedule`);
    const recentGames: any[] = [];
    const now = new Date();
    for (const event of (scheduleData.events || [])) {
      const competition = event.competitions?.[0];
      if (!competition) continue;
      const hasScores = competition.competitors?.every((c: any) => c.score?.value !== undefined);
      if (!hasScores || new Date(event.date) > now) continue;
      const billsTeam = competition.competitors?.find((c: any) => c.team?.abbreviation === 'BUF');
      const opponent = competition.competitors?.find((c: any) => c.team?.abbreviation !== 'BUF');
      if (billsTeam && opponent) {
        recentGames.push({
          date: new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          result: billsTeam.winner ? 'W' : 'L',
          billsScore: billsTeam.score?.displayValue || '0',
          oppScore: opponent.score?.displayValue || '0',
          opponent: opponent.team?.abbreviation || 'OPP',
          homeAway: billsTeam.homeAway === 'home' ? 'vs' : '@'
        });
      }
      if (recentGames.length >= 5) break;
    }

    const rosterRes = await fetch(`${ESPN_API_BASE}/teams/2/roster`);
    const roster = await rosterRes.json();
    const rosterByPosition: Record<string, string[]> = { QB: [], RB: [], WR: [], TE: [], OL: [], DL: [], LB: [], DB: [], K: [], P: [] };
    roster.athletes?.forEach((group: any) => {
      group.items?.forEach((player: any) => {
        const pos = player.position?.abbreviation || '';
        if (pos === 'QB') rosterByPosition.QB.push(player.fullName);
        else if (['RB', 'FB'].includes(pos)) rosterByPosition.RB.push(player.fullName);
        else if (pos === 'WR') rosterByPosition.WR.push(player.fullName);
        else if (pos === 'TE') rosterByPosition.TE.push(player.fullName);
        else if (['OT', 'OG', 'C', 'G', 'T'].includes(pos)) rosterByPosition.OL.push(player.fullName);
        else if (['DE', 'DT', 'NT'].includes(pos)) rosterByPosition.DL.push(player.fullName);
        else if (['LB', 'OLB', 'ILB', 'MLB'].includes(pos)) rosterByPosition.LB.push(player.fullName);
        else if (['CB', 'S', 'FS', 'SS', 'DB'].includes(pos)) rosterByPosition.DB.push(player.fullName);
        else if (pos === 'K') rosterByPosition.K.push(player.fullName);
        else if (pos === 'P') rosterByPosition.P.push(player.fullName);
      });
    });

    return { billsRecord, divisionPosition, recentGames, rosterByPosition };
  } catch (error) { console.error('Failed to fetch Bills context:', error); return null; }
}

function formatBillsContext(data: any) {
  if (!data) return 'Unable to fetch current team data.';
  const { billsRecord, divisionPosition, recentGames, rosterByPosition } = data;
  const recentGamesText = recentGames.length > 0 ? recentGames.map((g: any) => `${g.date}: ${g.result} ${g.billsScore}-${g.oppScore} ${g.homeAway} ${g.opponent}`).join('\n') : 'No recent games';
  const formatPosition = (pos: string, players: string[], limit = 3) => players.length > 0 ? `${pos}: ${players.slice(0, limit).join(', ')}` : null;
  const rosterLines = [
    formatPosition('QB', rosterByPosition.QB, 2), formatPosition('RB', rosterByPosition.RB, 3),
    formatPosition('WR', rosterByPosition.WR, 4), formatPosition('TE', rosterByPosition.TE, 2),
    formatPosition('DL', rosterByPosition.DL, 4), formatPosition('LB', rosterByPosition.LB, 4),
    formatPosition('DB', rosterByPosition.DB, 5)
  ].filter(Boolean).join('\n');

  return `
═══════════════════════════════════════════════════════
VERIFIED BILLS DATA
Source: ESPN API
═══════════════════════════════════════════════════════

CURRENT STANDINGS:
- Record: ${billsRecord}
- Division: ${divisionPosition}

RECENT GAMES:
${recentGamesText}

CURRENT ROSTER:
${rosterLines || 'N/A'}
═══════════════════════════════════════════════════════
`;
}

async function hasStoryBeenProcessed(storyKey: string) { return await kv.sismember('blog:bills-news:processed', storyKey); }
async function markStoryProcessed(storyKey: string, postId: string | null = null, keywords: string[] = []) {
  await kv.sadd('blog:bills-news:processed', storyKey);
  await kv.set(`blog:bills-news:log:${storyKey}`, { processedAt: new Date().toISOString(), postId, skipped: !postId, keywords });
  if (keywords?.length > 0) {
    await kv.lpush('blog:bills-news:recent-keywords', JSON.stringify({ storyKey, keywords, processedAt: new Date().toISOString() }));
    await kv.ltrim('blog:bills-news:recent-keywords', 0, 49);
  }
}

async function findSemanticDuplicate(keywords: string[]) {
  if (!keywords?.length) return null;
  try {
    const recentStories = await kv.lrange('blog:bills-news:recent-keywords', 0, 49);
    for (const storyJson of recentStories) {
      try {
        const story = typeof storyJson === 'string' ? JSON.parse(storyJson) : storyJson;
        if (!story.keywords?.length) continue;
        const similarity = calculateJaccardSimilarity(keywords, story.keywords);
        if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) return { matchedStoryKey: story.storyKey, similarity: Math.round(similarity * 100), processedAt: story.processedAt };
      } catch { continue; }
    }
    return null;
  } catch { return null; }
}

function generateTitle(topic: string) {
  const cleaned = topic.replace(/^the bills /i, 'Bills ').replace(/^bills /i, 'Bills ');
  return truncateAtWordBoundary(cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 80);
}

async function generateUniqueSlug(title: string, date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const baseSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50)}-${dateStr}`;
  if (!(await kv.get(`blog:slug:${baseSlug}`))) return baseSlug;
  for (let i = 2; i <= 10; i++) { if (!(await kv.get(`blog:slug:${baseSlug}-${i}`))) return `${baseSlug}-${i}`; }
  return `${baseSlug}-${Date.now()}`;
}

async function createPost(postData: any) {
  const nowDate = new Date();
  const slug = await generateUniqueSlug(postData.title, nowDate);
  const plainText = postData.content.replace(/#{1,6}\s/g, '').replace(/\*\*|__/g, '').replace(/\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ').trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');
  const id = crypto.randomUUID();
  const now = nowDate.toISOString();

  const post = {
    id, slug, title: postData.title, content: postData.content, excerpt,
    team: 'bills', type: 'news-analysis', status: postData.status,
    createdAt: now, publishedAt: postData.status === 'published' ? now : null, updatedAt: now,
    newsTopics: postData.newsTopics, sourceHeadlines: postData.sourceHeadlines,
    aiGenerated: true, aiModel: 'claude-sonnet-4-20250514', metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);
  const score = post.publishedAt ? new Date(post.publishedAt).getTime() : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd('blog:posts:bills', { score, member: id });
  await kv.zadd('blog:posts:type:news-analysis', { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);
  return post;
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const searchMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 2048, system: NEWS_DETECTION_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `Search for recent Buffalo Bills news from ESPN.com, NFL.com, and other major sports outlets. Focus on news from the last 24-48 hours. Today's date is ${new Date().toISOString().split('T')[0]}.\n\nAfter searching, respond with a JSON array of newsworthy stories found (or empty array if none).` }]
    });

    let stories: any[] = [];
    const textContent = searchMessage.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) { try { stories = JSON.parse(jsonMatch[0]); } catch { stories = []; } }

    if (stories.length === 0) return NextResponse.json({ success: true, message: 'No significant news stories found', storiesProcessed: 0 });

    const results: any[] = [];
    const billsContext = await fetchBillsContext();
    const contextText = formatBillsContext(billsContext);
    const autoPublish = await getAutoPublishSetting('bills-news');

    for (const story of stories.filter((s: any) => s.importance >= 7)) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      const keywords = story.keywords || [];

      if (await hasStoryBeenProcessed(storyKey)) { results.push({ storyKey, skipped: true, reason: 'already processed' }); continue; }
      const semanticMatch = await findSemanticDuplicate(keywords);
      if (semanticMatch) { await markStoryProcessed(storyKey, null, keywords); results.push({ storyKey, skipped: true, reason: 'semantic duplicate', matchedStory: semanticMatch.matchedStoryKey, similarity: semanticMatch.similarity }); continue; }

      const articleMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 2048,
        system: [{ type: 'text' as const, text: ARTICLE_GENERATION_PROMPT, cache_control: { type: 'ephemeral' as const } }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Write a factual news report about this topic:\n\nNEWS TOPIC: ${story.topic}\n\nUse this verified team data for context:\n${contextText}` }]
      });

      const articleContent = articleMessage.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      const title = generateTitle(story.topic);

      const post = await createPost({
        title, content: articleContent, status: autoPublish ? 'published' : 'draft',
        newsTopics: story.keywords || [story.topic], sourceHeadlines: [story.topic],
        metaDescription: `Analysis: ${story.topic.substring(0, 120)}. A Lindy's Five take on the latest Bills news.`
      });

      await markStoryProcessed(storyKey, post.id, keywords);
      results.push({ storyKey, postId: post.id, postSlug: post.slug, status: post.status, importance: story.importance });
    }

    for (const story of stories.filter((s: any) => s.importance < 7)) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      if (!(await hasStoryBeenProcessed(storyKey))) {
        await markStoryProcessed(storyKey, null, story.keywords || []);
        results.push({ storyKey, skipped: true, reason: 'low importance', importance: story.importance });
      }
    }

    return NextResponse.json({ success: true, storiesFound: stories.length, storiesProcessed: results.filter((r: any) => !r.skipped).length, results });
  } catch (error: any) {
    console.error('Bills news scan error:', error);
    return NextResponse.json({ error: 'Failed to scan news', message: error.message }, { status: 500 });
  }
}
