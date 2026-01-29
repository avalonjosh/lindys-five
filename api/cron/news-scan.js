import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';
import { fetchJsonWithRetry, calculateJaccardSimilarity, truncateAtWordBoundary } from '../utils/fetchWithRetry.js';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// Similarity threshold for semantic deduplication (0.4 = 40% keyword overlap)
const SEMANTIC_SIMILARITY_THRESHOLD = 0.4;

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

ACCURACY REQUIREMENTS (MANDATORY):
1. VERIFIED DATA IS TRUTH: The NHL data provided (standings, roster, recent games) is authoritative. Use these exact numbers.

2. NEVER HALLUCINATE:
   - Do NOT invent statistics (goals, assists, points, contract values)
   - Do NOT make up quotes from players, coaches, or management
   - Do NOT fabricate dates, game scores, or transaction details
   - Do NOT guess at injury specifics or recovery timelines

3. WEB SEARCH VERIFICATION:
   - Use web search to verify specific details before including them
   - If you cannot verify a detail via search, OMIT IT
   - Cite sources for information from web search (e.g., "per NHL.com")
   - If web search conflicts with VERIFIED DATA, trust VERIFIED DATA for stats

4. WHEN UNCERTAIN:
   - Use hedging language ("reportedly," "according to sources")
   - Prefer shorter, accurate articles over longer ones with guessed details
   - Acknowledge when details are unconfirmed

PROHIBITED:
- Fabricating quotes or statements
- Making up contract terms or salary figures
- Inventing injury details beyond what's confirmed
- Creating fictional historical comparisons with fake stats

Do NOT include "TITLE:" or "META:" prefixes in your response.`;

// Fetch current Sabres data for context with retry logic
async function fetchSabresContext() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all data in parallel with retry logic
    const [standingsData, roster, schedule] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/standings/${today}`),
      fetchJsonWithRetry(`${NHL_API_BASE}/roster/BUF/current`),
      fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`)
    ]);

    const sabres = standingsData.standings?.find(t => t.teamAbbrev?.default === 'BUF');

    const recentGames = (schedule.games || [])
      .filter(g => g.gameType === 2 && (g.gameState === 'FINAL' || g.gameState === 'OFF'))
      .slice(-5)
      .reverse();

    return { sabres, roster, recentGames };
  } catch (error) {
    console.error('Failed to fetch Sabres context after retries:', error);
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

// Mark a story as processed (with keywords for semantic deduplication)
async function markStoryProcessed(storyKey, postId = null, keywords = []) {
  await kv.sadd('blog:news:processed', storyKey);
  const logData = {
    processedAt: new Date().toISOString(),
    postId,
    skipped: !postId,
    keywords: keywords || []
  };
  await kv.set(`blog:news:log:${storyKey}`, logData);

  // Store in recent stories list for semantic deduplication (keep last 50)
  if (keywords && keywords.length > 0) {
    const recentStory = { storyKey, keywords, processedAt: logData.processedAt };
    await kv.lpush('blog:news:recent-keywords', JSON.stringify(recentStory));
    await kv.ltrim('blog:news:recent-keywords', 0, 49); // Keep only last 50
  }
}

// Check for semantically similar stories that were recently processed
async function findSemanticDuplicate(keywords) {
  if (!keywords || keywords.length === 0) return null;

  try {
    // Get recent stories with their keywords
    const recentStories = await kv.lrange('blog:news:recent-keywords', 0, 49);

    for (const storyJson of recentStories) {
      try {
        const story = typeof storyJson === 'string' ? JSON.parse(storyJson) : storyJson;
        if (!story.keywords || story.keywords.length === 0) continue;

        const similarity = calculateJaccardSimilarity(keywords, story.keywords);
        if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
          return {
            matchedStoryKey: story.storyKey,
            similarity: Math.round(similarity * 100),
            processedAt: story.processedAt
          };
        }
      } catch (parseError) {
        console.error('Failed to parse recent story:', parseError);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking semantic duplicates:', error);
    return null; // Don't block on errors, just skip the check
  }
}

// Generate article title from topic
function generateTitle(topic) {
  // Clean up and format the topic as a title
  const cleaned = topic
    .replace(/^the sabres /i, 'Sabres ')
    .replace(/^sabres /i, 'Sabres ');

  // Capitalize first letter of each word for title case
  const titleCased = cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Truncate at word boundary to avoid cutting mid-word
  return truncateAtWordBoundary(titleCased, 80);
}

// Generate unique slug with collision handling
async function generateUniqueSlug(title, date) {
  const dateStr = date.toISOString().split('T')[0];
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const baseSlug = `${titleSlug}-${dateStr}`;

  // Check if slug already exists
  const existingId = await kv.get(`blog:slug:${baseSlug}`);
  if (!existingId) return baseSlug;

  // Try numbered suffixes
  for (let i = 2; i <= 10; i++) {
    const suffixedSlug = `${baseSlug}-${i}`;
    const existingSuffixedId = await kv.get(`blog:slug:${suffixedSlug}`);
    if (!existingSuffixedId) {
      console.log(`Slug collision detected for "${baseSlug}", using "${suffixedSlug}" instead`);
      return suffixedSlug;
    }
  }

  // Fallback to timestamp
  const fallbackSlug = `${baseSlug}-${Date.now()}`;
  console.log(`Multiple slug collisions for "${baseSlug}", using timestamp fallback`);
  return fallbackSlug;
}

// Create post via KV
async function createPost(postData) {
  const nowDate = new Date();
  const slug = await generateUniqueSlug(postData.title, nowDate);

  const plainText = postData.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');

  const id = crypto.randomUUID();
  const now = nowDate.toISOString();

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
      const keywords = story.keywords || [];

      // Check if already processed (exact match)
      if (await hasStoryBeenProcessed(storyKey)) {
        results.push({ storyKey, skipped: true, reason: 'already processed' });
        continue;
      }

      // Check for semantic duplicates (similar keywords)
      const semanticMatch = await findSemanticDuplicate(keywords);
      if (semanticMatch) {
        console.log(`Semantic duplicate detected: "${storyKey}" matches "${semanticMatch.matchedStoryKey}" with ${semanticMatch.similarity}% similarity`);
        await markStoryProcessed(storyKey, null, keywords); // Mark as skipped
        results.push({
          storyKey,
          skipped: true,
          reason: 'semantic duplicate',
          matchedStory: semanticMatch.matchedStoryKey,
          similarity: semanticMatch.similarity
        });
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

      // Mark as processed with keywords for future deduplication
      await markStoryProcessed(storyKey, post.id, keywords);

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
      const keywords = story.keywords || [];
      if (!(await hasStoryBeenProcessed(storyKey))) {
        await markStoryProcessed(storyKey, null, keywords); // Mark as processed but skipped
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
