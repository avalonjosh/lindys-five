import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, calculateJaccardSimilarity, truncateAtWordBoundary } from '@/lib/fetchWithRetry';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const SEMANTIC_SIMILARITY_THRESHOLD = 0.4;

const NEWS_DETECTION_PROMPT = `You are a sports news analyst for a Buffalo Sabres fan blog.

Your task is to search for recent Buffalo Sabres news from the last 24-48 hours and identify stories that would interest Sabres fans.

Look for stories about:
- Trade rumors or completed trades involving the Sabres
- Injury updates for key players
- Milestone achievements (career goals, assists, games played)
- Roster moves (call-ups, send-downs, signings, waivers)
- Contract news
- Coaching or management changes
- Notable performances or records

IMPORTANT: Only identify stories that are GENUINELY NEWSWORTHY. Skip routine game recaps or minor updates.

After searching, respond with a JSON array of detected stories. For each story, include:
- topic: A brief description of the news (1-2 sentences)
- importance: 1-10 scale (10 = major trade, 1 = minor roster move)
- keywords: Array of keywords for deduplication
- storyKey: A unique slug for this story (e.g., "tage-thompson-injury-update")

If no significant Sabres news is found, respond with an empty array: []`;

const ARTICLE_GENERATION_PROMPT = `You are a professional sports journalist writing a NEWS REPORT for "Lindy's Five", a Buffalo Sabres publication.

CRITICAL INSTRUCTIONS:
- Write NEUTRAL, FACTUAL news reporting only
- Report what happened without opinion, speculation, or analysis
- Use verified facts from the provided NHL data
- Do NOT include your perspective, predictions, or fan sentiment

Article structure:
1. Lead paragraph with key facts (who, what, when, where)
2. Supporting details and context
3. Relevant statistics from the provided data
4. Background information if applicable
5. Stick to confirmed information only

Style Guidelines:
- Neutral, professional wire-service tone (like AP or Reuters)
- 300-500 words
- Use Markdown with ## headers
- Use **bold** for player names and key stats

ACCURACY REQUIREMENTS (MANDATORY):
1. VERIFIED DATA IS TRUTH
2. NEVER HALLUCINATE
3. Use web search to verify specific details
4. If you cannot verify a detail via search, OMIT IT

Do NOT include "TITLE:" or "META:" prefixes in your response.`;

async function fetchSabresContext() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [standingsData, roster, schedule] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/standings/${today}`),
      fetchJsonWithRetry(`${NHL_API_BASE}/roster/BUF/current`),
      fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`)
    ]);

    const sabres = standingsData.standings?.find((t: any) => t.teamAbbrev?.default === 'BUF');
    const recentGames = (schedule.games || [])
      .filter((g: any) => g.gameType === 2 && (g.gameState === 'FINAL' || g.gameState === 'OFF'))
      .slice(-5).reverse();

    return { sabres, roster, recentGames };
  } catch (error) {
    console.error('Failed to fetch Sabres context after retries:', error);
    return null;
  }
}

function formatSabresContext(data: any) {
  if (!data) return 'Unable to fetch current team data.';
  const { sabres, roster, recentGames } = data;

  const recentGamesText = recentGames.map((g: any) => {
    const isHome = g.homeTeam?.abbrev === 'BUF';
    const bufScore = isHome ? g.homeTeam?.score : g.awayTeam?.score;
    const oppScore = isHome ? g.awayTeam?.score : g.homeTeam?.score;
    const opp = isHome ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
    const result = bufScore > oppScore ? 'W' : 'L';
    return `${g.gameDate}: ${result} ${bufScore}-${oppScore} vs ${opp}`;
  }).join('\n');

  const forwards = roster.forwards?.map((p: any) => `${p.firstName?.default} ${p.lastName?.default}`).join(', ') || 'N/A';
  const defense = roster.defensemen?.map((p: any) => `${p.firstName?.default} ${p.lastName?.default}`).join(', ') || 'N/A';
  const goalies = roster.goalies?.map((p: any) => `${p.firstName?.default} ${p.lastName?.default}`).join(', ') || 'N/A';

  return `
═══════════════════════════════════════════════════════
VERIFIED SABRES DATA
Source: Official NHL API
═══════════════════════════════════════════════════════

CURRENT STANDINGS:
- Record: ${sabres?.wins || 0}-${sabres?.losses || 0}-${sabres?.otLosses || 0} (${sabres?.points || 0} points)
- Division Rank: ${sabres?.divisionSequence || 'N/A'}
- Conference Rank: ${sabres?.conferenceSequence || 'N/A'}
- Games Played: ${sabres?.gamesPlayed || 0}

RECENT GAMES:
${recentGamesText || 'No recent games'}

CURRENT ROSTER:
Forwards: ${forwards}
Defense: ${defense}
Goalies: ${goalies}

═══════════════════════════════════════════════════════
`;
}

async function hasStoryBeenProcessed(storyKey: string) {
  return await kv.sismember('blog:news:processed', storyKey);
}

async function markStoryProcessed(storyKey: string, postId: string | null = null, keywords: string[] = []) {
  await kv.sadd('blog:news:processed', storyKey);
  const logData = { processedAt: new Date().toISOString(), postId, skipped: !postId, keywords: keywords || [] };
  await kv.set(`blog:news:log:${storyKey}`, logData);

  if (keywords && keywords.length > 0) {
    const recentStory = { storyKey, keywords, processedAt: logData.processedAt };
    await kv.lpush('blog:news:recent-keywords', JSON.stringify(recentStory));
    await kv.ltrim('blog:news:recent-keywords', 0, 49);
  }
}

async function findSemanticDuplicate(keywords: string[]) {
  if (!keywords || keywords.length === 0) return null;
  try {
    const recentStories = await kv.lrange('blog:news:recent-keywords', 0, 49);
    for (const storyJson of recentStories) {
      try {
        const story = typeof storyJson === 'string' ? JSON.parse(storyJson) : storyJson;
        if (!story.keywords || story.keywords.length === 0) continue;
        const similarity = calculateJaccardSimilarity(keywords, story.keywords);
        if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
          return { matchedStoryKey: story.storyKey, similarity: Math.round(similarity * 100), processedAt: story.processedAt };
        }
      } catch { continue; }
    }
    return null;
  } catch { return null; }
}

function generateTitle(topic: string) {
  const cleaned = topic.replace(/^the sabres /i, 'Sabres ').replace(/^sabres /i, 'Sabres ');
  const titleCased = cleaned.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return truncateAtWordBoundary(titleCased, 80);
}

async function generateUniqueSlug(title: string, date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  const baseSlug = `${titleSlug}-${dateStr}`;

  const existingId = await kv.get(`blog:slug:${baseSlug}`);
  if (!existingId) return baseSlug;

  for (let i = 2; i <= 10; i++) {
    const suffixedSlug = `${baseSlug}-${i}`;
    const existingSuffixedId = await kv.get(`blog:slug:${suffixedSlug}`);
    if (!existingSuffixedId) return suffixedSlug;
  }

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
    team: 'sabres', type: 'news-analysis', status: postData.status,
    createdAt: now, publishedAt: postData.status === 'published' ? now : null, updatedAt: now,
    newsTopics: postData.newsTopics, sourceHeadlines: postData.sourceHeadlines,
    aiGenerated: true, aiModel: 'claude-sonnet-4-20250514', metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);
  const score = post.publishedAt ? new Date(post.publishedAt).getTime() : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd('blog:posts:sabres', { score, member: id });
  await kv.zadd('blog:posts:type:news-analysis', { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);

  return post;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const searchMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 2048, system: NEWS_DETECTION_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `Search for recent Buffalo Sabres news from NHL.com, ESPN.com, and other major sports outlets. Focus on news from the last 24-48 hours. Today's date is ${new Date().toISOString().split('T')[0]}.\n\nAfter searching, respond with a JSON array of newsworthy stories found (or empty array if none).` }]
    });

    let stories: any[] = [];
    const textContent = searchMessage.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) { try { stories = JSON.parse(jsonMatch[0]); } catch { stories = []; } }

    if (stories.length === 0) {
      return NextResponse.json({ success: true, message: 'No significant news stories found', storiesProcessed: 0 });
    }

    const results: any[] = [];
    const sabresContext = await fetchSabresContext();
    const contextText = formatSabresContext(sabresContext);
    const autoPublish = await getAutoPublishSetting('news');

    const importantStories = stories.filter((s: any) => s.importance >= 7);

    for (const story of importantStories) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      const keywords = story.keywords || [];

      if (await hasStoryBeenProcessed(storyKey)) {
        results.push({ storyKey, skipped: true, reason: 'already processed' });
        continue;
      }

      const semanticMatch = await findSemanticDuplicate(keywords);
      if (semanticMatch) {
        await markStoryProcessed(storyKey, null, keywords);
        results.push({ storyKey, skipped: true, reason: 'semantic duplicate', matchedStory: semanticMatch.matchedStoryKey, similarity: semanticMatch.similarity });
        continue;
      }

      const articleMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 2048, system: ARTICLE_GENERATION_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Write a factual news report about this topic:\n\nNEWS TOPIC: ${story.topic}\n\nUse this verified team data for context:\n${contextText}\n\nIMPORTANT: Use web search to verify specific details.` }]
      });

      const articleContent = articleMessage.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');

      const title = generateTitle(story.topic);
      const metaDescription = `Analysis: ${story.topic.substring(0, 120)}. A Lindy's Five take on the latest Sabres news.`;

      const post = await createPost({
        title, content: articleContent, status: autoPublish ? 'published' : 'draft',
        newsTopics: story.keywords || [story.topic], sourceHeadlines: [story.topic], metaDescription
      });

      await markStoryProcessed(storyKey, post.id, keywords);
      results.push({ storyKey, postId: post.id, postSlug: post.slug, status: post.status, importance: story.importance });
    }

    const skippedStories = stories.filter((s: any) => s.importance < 7);
    for (const story of skippedStories) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      const keywords = story.keywords || [];
      if (!(await hasStoryBeenProcessed(storyKey))) {
        await markStoryProcessed(storyKey, null, keywords);
        results.push({ storyKey, skipped: true, reason: 'low importance', importance: story.importance });
      }
    }

    return NextResponse.json({
      success: true, storiesFound: stories.length,
      storiesProcessed: results.filter((r: any) => !r.skipped).length, results
    });

  } catch (error: any) {
    console.error('News scan error:', error);
    return NextResponse.json({ error: 'Failed to scan news', message: error.message }, { status: 500 });
  }
}
