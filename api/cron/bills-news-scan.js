import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// System prompt for news detection
const NEWS_DETECTION_PROMPT = `You are a sports news analyst for a Buffalo Bills fan blog.

Your task is to search for recent Buffalo Bills news from the last 24-48 hours and identify stories that would interest Bills fans.

Look for stories about:
- Trade rumors or completed trades involving the Bills
- Free agent signings and contract negotiations
- NFL Draft news, prospects, and mock draft analysis
- Coaching staff changes and decisions (including new head coach)
- Injury updates and player availability
- Contract extensions (especially Josh Allen, key players)
- Roster moves (cuts, signings, practice squad)
- OTA and training camp updates
- Player milestone achievements
- AFC East divisional news affecting the Bills

IMPORTANT: Only identify stories that are GENUINELY NEWSWORTHY. Skip routine practice reports or minor updates.

After searching, respond with a JSON array of detected stories. For each story, include:
- topic: A brief description of the news (1-2 sentences)
- importance: 1-10 scale (10 = major trade/signing, 1 = minor roster move)
- keywords: Array of keywords for deduplication
- storyKey: A unique slug for this story (e.g., "bills-draft-pick-analysis")

Example response format:
[
  {
    "topic": "Bills sign veteran cornerback in free agency",
    "importance": 8,
    "keywords": ["signing", "cornerback", "free agency"],
    "storyKey": "bills-cb-signing-2026-01-27"
  }
]

If no significant Bills news is found, respond with an empty array: []`;

// System prompt for article generation
const ARTICLE_GENERATION_PROMPT = `You are a professional sports journalist writing a NEWS REPORT for "Lindy's Five", a Buffalo Bills publication.

CRITICAL INSTRUCTIONS:
- Write NEUTRAL, FACTUAL news reporting only
- Report what happened without opinion, speculation, or analysis
- Use verified facts from the provided NFL data
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

// Fetch current Bills data for context
async function fetchBillsContext() {
  try {
    // Fetch standings
    const standingsRes = await fetch(`${ESPN_API_BASE}/standings`);
    const standingsData = await standingsRes.json();

    // Find Bills in AFC East
    let billsRecord = 'N/A';
    let divisionPosition = 'N/A';

    const afcConf = standingsData.children?.find(conf => conf.abbreviation === 'AFC');
    const afcEast = afcConf?.children?.find(div => div.name === 'AFC East');
    const billsEntry = afcEast?.standings?.entries?.find(
      entry => entry.team?.abbreviation === 'BUF'
    );

    if (billsEntry) {
      const overallStat = billsEntry.stats?.find(s => s.name === 'overall');
      billsRecord = overallStat?.displayValue || 'N/A';

      const position = afcEast?.standings?.entries?.findIndex(
        e => e.team?.abbreviation === 'BUF'
      );
      if (position !== -1) {
        divisionPosition = `${position + 1}${['st', 'nd', 'rd', 'th'][position] || 'th'} in AFC East`;
      }
    }

    // Fetch roster (Bills team ID = 2)
    const rosterRes = await fetch(`${ESPN_API_BASE}/teams/2/roster`);
    const roster = await rosterRes.json();

    // Get key players by position group
    const keyPlayers = [];
    roster.athletes?.forEach(group => {
      group.items?.slice(0, 3).forEach(player => {
        keyPlayers.push(`${player.fullName} (${player.position?.abbreviation || 'N/A'})`);
      });
    });

    return { billsRecord, divisionPosition, keyPlayers };
  } catch (error) {
    console.error('Failed to fetch Bills context:', error);
    return null;
  }
}

// Format Bills context for AI prompt
function formatBillsContext(data) {
  if (!data) return 'Unable to fetch current team data.';

  const { billsRecord, divisionPosition, keyPlayers } = data;

  return `
═══════════════════════════════════════════════════════
VERIFIED BILLS DATA
Source: ESPN API
═══════════════════════════════════════════════════════

CURRENT STANDINGS:
- Record: ${billsRecord}
- Division: ${divisionPosition}

KEY PLAYERS:
${keyPlayers.slice(0, 15).join('\n') || 'N/A'}

═══════════════════════════════════════════════════════
`;
}

// Check if a story has already been processed
async function hasStoryBeenProcessed(storyKey) {
  return await kv.sismember('blog:bills-news:processed', storyKey);
}

// Mark a story as processed
async function markStoryProcessed(storyKey, postId = null) {
  await kv.sadd('blog:bills-news:processed', storyKey);
  await kv.set(`blog:bills-news:log:${storyKey}`, {
    processedAt: new Date().toISOString(),
    postId,
    skipped: !postId
  });
}

// Generate article title from topic
function generateTitle(topic) {
  const cleaned = topic
    .replace(/^the bills /i, 'Bills ')
    .replace(/^bills /i, 'Bills ');

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
    team: 'bills',
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
  await kv.zadd('blog:posts:bills', { score, member: id });
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

    // Step 1: Search for recent Bills news using web search
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
        content: `Search for recent Buffalo Bills news from ESPN.com, NFL.com, and other major sports outlets. Focus on news from the last 24-48 hours. Today's date is ${new Date().toISOString().split('T')[0]}.

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
    const billsContext = await fetchBillsContext();
    const contextText = formatBillsContext(billsContext);
    const autoPublish = await getAutoPublishSetting('bills-news');

    // Only process high-importance stories (7+)
    const importantStories = stories.filter(s => s.importance >= 7);

    for (const story of importantStories) {
      const storyKey = story.storyKey || story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);

      // Check if already processed
      if (await hasStoryBeenProcessed(storyKey)) {
        results.push({ storyKey, skipped: true, reason: 'already processed' });
        continue;
      }

      // Generate original analysis article
      const articleMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: ARTICLE_GENERATION_PROMPT,
        messages: [{
          role: 'user',
          content: `Write an original analysis article about this news:

NEWS TOPIC: ${story.topic}

Use this verified team data for context and stats:
${contextText}

Remember: Write ORIGINAL ANALYSIS and COMMENTARY, not a news summary. Give your perspective as a Bills analyst.`
        }]
      });

      const articleContent = articleMessage.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Generate title and meta description
      const title = generateTitle(story.topic);
      const metaDescription = `Analysis: ${story.topic.substring(0, 120)}. A Lindy's Five take on the latest Bills news.`;

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
        await markStoryProcessed(storyKey, null);
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
    console.error('Bills news scan error:', error);
    return res.status(500).json({
      error: 'Failed to scan news',
      message: error.message
    });
  }
}
