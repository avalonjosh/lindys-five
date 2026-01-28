import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// System prompt for news detection
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

Example response format:
[
  {
    "topic": "Sabres acquire forward from Maple Leafs in trade",
    "importance": 8,
    "keywords": ["trade", "acquire", "maple leafs"],
    "storyKey": "sabres-trade-acquisition-2026-01-27"
  }
]

If no significant Sabres news is found, respond with an empty array: []`;

// System prompt for article generation
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
- Avoid emotional or loaded language (no "exciting," "disappointing," "crucial," "must-win," etc.)
- Do not speculate about future implications
- Do not include fan reactions or sentiment

Do NOT include "TITLE:" or "META:" prefixes in your response.`;

// Fetch current Sabres data for context
async function fetchSabresContext() {
  try {
    // Fetch current standings
    const today = new Date().toISOString().split('T')[0];
    const standingsRes = await fetch(`${NHL_API_BASE}/standings/${today}`);
    const standingsData = await standingsRes.json();
    const sabres = standingsData.standings?.find(t => t.teamAbbrev?.default === 'BUF');

    // Fetch roster
    const rosterRes = await fetch(`${NHL_API_BASE}/roster/BUF/current`);
    const roster = await rosterRes.json();

    // Fetch recent schedule
    const scheduleRes = await fetch(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);
    const schedule = await scheduleRes.json();

    const recentGames = (schedule.games || [])
      .filter(g => g.gameType === 2 && (g.gameState === 'FINAL' || g.gameState === 'OFF'))
      .slice(-5)
      .reverse();

    return { sabres, roster, recentGames };
  } catch (error) {
    console.error('Failed to fetch Sabres context:', error);
    return null;
  }
}

// Format Sabres context for AI prompt
function formatSabresContext(data) {
  if (!data) return 'Unable to fetch current team data.';

  const { sabres, roster, recentGames } = data;

  const recentGamesText = recentGames.map(g => {
    const isHome = g.homeTeam?.abbrev === 'BUF';
    const bufScore = isHome ? g.homeTeam?.score : g.awayTeam?.score;
    const oppScore = isHome ? g.awayTeam?.score : g.homeTeam?.score;
    const opp = isHome ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
    const result = bufScore > oppScore ? 'W' : 'L';
    return `${g.gameDate}: ${result} ${bufScore}-${oppScore} vs ${opp}`;
  }).join('\n');

  const forwards = roster.forwards?.map(p => `${p.firstName?.default} ${p.lastName?.default}`).join(', ') || 'N/A';
  const defense = roster.defensemen?.map(p => `${p.firstName?.default} ${p.lastName?.default}`).join(', ') || 'N/A';
  const goalies = roster.goalies?.map(p => `${p.firstName?.default} ${p.lastName?.default}`).join(', ') || 'N/A';

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

// Check if a story has already been processed
async function hasStoryBeenProcessed(storyKey) {
  return await kv.sismember('blog:news:processed', storyKey);
}

// Mark a story as processed
async function markStoryProcessed(storyKey, postId = null) {
  await kv.sadd('blog:news:processed', storyKey);
  await kv.set(`blog:news:log:${storyKey}`, {
    processedAt: new Date().toISOString(),
    postId,
    skipped: !postId
  });
}

// Generate article title from topic
function generateTitle(topic) {
  // Clean up and format the topic as a title
  const cleaned = topic
    .replace(/^the sabres /i, 'Sabres ')
    .replace(/^sabres /i, 'Sabres ');

  // Capitalize first letter of each word for title case
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .substring(0, 80);
}

// Create post via KV
async function createPost(postData) {
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = postData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const slug = `${titleSlug}-${dateStr}`;

  const excerpt = postData.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 200) + '...';

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const post = {
    id,
    slug,
    title: postData.title,
    content: postData.content,
    excerpt,
    team: 'sabres',
    type: 'news-analysis',
    status: postData.status,
    createdAt: now,
    publishedAt: postData.status === 'published' ? now : null,
    updatedAt: now,
    newsTopics: postData.newsTopics,
    sourceHeadlines: postData.sourceHeadlines,
    aiGenerated: true,
    aiModel: 'claude-sonnet-4-20250514',
    metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);

  const score = post.publishedAt
    ? new Date(post.publishedAt).getTime()
    : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd('blog:posts:sabres', { score, member: id });
  await kv.zadd('blog:posts:type:news-analysis', { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);

  return post;
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Step 1: Search for recent Sabres news using web search
    const searchMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: NEWS_DETECTION_PROMPT,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search'
      }],
      messages: [{
        role: 'user',
        content: `Search for recent Buffalo Sabres news from NHL.com, ESPN.com, and other major sports outlets. Focus on news from the last 24-48 hours. Today's date is ${new Date().toISOString().split('T')[0]}.

After searching, respond with a JSON array of newsworthy stories found (or empty array if none).`
      }]
    });

    // Extract the JSON response
    let stories = [];
    const textContent = searchMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Try to parse JSON from response
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        stories = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse stories JSON:', e);
        stories = [];
      }
    }

    if (stories.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No significant news stories found',
        storiesProcessed: 0
      });
    }

    // Step 2: Process each story
    const results = [];
    const sabresContext = await fetchSabresContext();
    const contextText = formatSabresContext(sabresContext);
    const autoPublish = await getAutoPublishSetting('news');

    // Only process high-importance stories (7+)
    const importantStories = stories.filter(s => s.importance >= 7);

    for (const story of importantStories) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);

      // Check if already processed
      if (await hasStoryBeenProcessed(storyKey)) {
        results.push({ storyKey, skipped: true, reason: 'already processed' });
        continue;
      }

      // Generate factual news article with web search for verification
      const articleMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: ARTICLE_GENERATION_PROMPT,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search'
        }],
        messages: [{
          role: 'user',
          content: `Write a factual news report about this topic:

NEWS TOPIC: ${story.topic}

Use this verified team data for context:
${contextText}

IMPORTANT: Use web search to verify specific details like dates, statistics, contract values, and quotes. Only include information you can confirm from search results or the provided data. If you cannot verify a specific detail, omit it rather than guess.`
        }]
      });

      const articleContent = articleMessage.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Generate title and meta description
      const title = generateTitle(story.topic);
      const metaDescription = `Analysis: ${story.topic.substring(0, 120)}. A Lindy's Five take on the latest Sabres news.`;

      // Create the post
      const post = await createPost({
        title,
        content: articleContent,
        status: autoPublish ? 'published' : 'draft',
        newsTopics: story.keywords || [story.topic],
        sourceHeadlines: [story.topic],
        metaDescription
      });

      // Mark as processed
      await markStoryProcessed(storyKey, post.id);

      results.push({
        storyKey,
        postId: post.id,
        postSlug: post.slug,
        status: post.status,
        importance: story.importance
      });
    }

    // Log lower importance stories but don't process
    const skippedStories = stories.filter(s => s.importance < 7);
    for (const story of skippedStories) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
      if (!(await hasStoryBeenProcessed(storyKey))) {
        await markStoryProcessed(storyKey, null); // Mark as processed but skipped
        results.push({ storyKey, skipped: true, reason: 'low importance', importance: story.importance });
      }
    }

    return res.status(200).json({
      success: true,
      storiesFound: stories.length,
      storiesProcessed: results.filter(r => !r.skipped).length,
      results
    });

  } catch (error) {
    console.error('News scan error:', error);
    return res.status(500).json({
      error: 'Failed to scan news',
      message: error.message
    });
  }
}
