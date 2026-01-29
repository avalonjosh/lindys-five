import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '../utils/fetchWithRetry.js';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// System prompt for weekly roundup generation
const WEEKLY_ROUNDUP_SYSTEM_PROMPT = `You are a professional sports journalist writing the weekly roundup for "Lindy's Five", a Buffalo Bills fan blog.

Your task is to summarize the week in Bills news based on the topics provided and any current events.

Structure your article with these sections:
1. **Opening** (2-3 sentences): Week overview - key storyline(s) that dominated the week
2. **Top Stories**: Major news items with details and analysis (2-3 stories)
3. **Quick Hits**: Brief mentions of smaller news items
4. **Roster Watch**: Any player movements, signings, or injury updates
5. **Looking Ahead**: What to watch for next week

Style Guidelines:
- Professional sports journalism tone
- Reference specific details from the news topics provided
- Build a narrative arc for the week
- 500-800 words total
- Use enthusiasm appropriate for a fan blog, but stay professional

Format:
- Use Markdown with ## headers for each section
- Use **bold** for player names and key terms
- Do NOT include the word "TITLE:" or "META:" in your response

CRITICAL: Focus on the verified news topics provided. Supplement with general NFL knowledge but don't invent specific details.`;

// Fetch Bills standings and roster with retry logic
async function fetchBillsContext() {
  try {
    // Fetch standings with retry
    const standingsData = await fetchJsonWithRetry(`${ESPN_API_BASE}/standings`);

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

    return { billsRecord, divisionPosition };
  } catch (error) {
    console.error('Failed to fetch Bills context after retries:', error);
    return null;
  }
}

// Get the previous Monday (start of last week)
function getLastMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get the previous Sunday (end of last week)
function getLastSunday(date) {
  const monday = getLastMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

// Check if we're in NFL season (September-February)
function isNFLSeason() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // NFL regular season: September (8) - February (1)
  return month >= 8 || month <= 1;
}

// Format weekly context for AI prompt
function formatWeeklyContext(weekStart, weekEnd, newsTopics, context) {
  const inSeason = isNFLSeason();

  return `
═══════════════════════════════════════════════════════
BILLS WEEKLY NEWS SUMMARY
Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}
Season Status: ${inSeason ? 'NFL Regular Season' : 'NFL Offseason'}
═══════════════════════════════════════════════════════

${context ? `CURRENT STANDINGS:
- Record: ${context.billsRecord}
- Division: ${context.divisionPosition}

` : ''}NEWS TOPICS THIS WEEK:
${newsTopics.length > 0
  ? newsTopics.map((topic, i) => `${i + 1}. ${topic}`).join('\n')
  : 'No specific news topics provided - search for recent Bills news to write about.'}

IMPORTANT CONTEXT:
- Focus on offseason news: draft, free agency, coaching staff, training camp prep
- Cover any roster moves, contract news, or injury updates
- Include any AFC East news that affects the Bills

═══════════════════════════════════════════════════════
`;
}

// Generate weekly title
function generateWeeklyTitle(weekStart) {
  const formattedDate = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const inSeason = isNFLSeason();

  if (inSeason) {
    return `Bills Week in Review: ${formattedDate}`;
  } else {
    return `Bills Offseason Update: Week of ${formattedDate}`;
  }
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

  const plainText = postData.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const post = {
    id,
    slug,
    title: postData.title,
    content: postData.content,
    excerpt,
    team: 'bills',
    type: 'weekly-roundup',
    status: postData.status,
    createdAt: now,
    publishedAt: postData.status === 'published' ? now : null,
    updatedAt: now,
    weekStartDate: postData.weekStartDate,
    weekEndDate: postData.weekEndDate,
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
  await kv.zadd('blog:posts:type:weekly-roundup', { score, member: id });
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
    // Calculate date range (previous Monday to Sunday)
    const now = new Date();
    const weekStart = getLastMonday(now);
    const weekEnd = getLastSunday(now);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Check if we already generated this week's roundup
    const lastRoundupDate = await kv.get('blog:bills-weekly:last');
    if (lastRoundupDate === weekStartStr) {
      return res.status(200).json({
        success: false,
        message: 'Bills weekly roundup already generated for this week',
        weekStart: weekStartStr
      });
    }

    // Fetch Bills context
    const billsContext = await fetchBillsContext();

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Search for Bills news from the past week using web search
    const searchMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are a sports news researcher. Search for Buffalo Bills news from the past week and return a JSON array of the top 5-7 news topics.

Format your response as a JSON array of strings, each describing a news topic:
["Topic 1 description", "Topic 2 description", ...]

Focus on:
- Trades, signings, roster moves
- Draft news and analysis
- Coaching staff updates
- Contract negotiations
- Injury reports
- AFC East news`,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search'
      }],
      messages: [{
        role: 'user',
        content: `Search for Buffalo Bills news from ${formatDate(weekStart)} to ${formatDate(weekEnd)} (${weekStartStr}). Today is ${new Date().toISOString().split('T')[0]}.

After searching, respond with a JSON array of the top news topics from this week.`
      }]
    });

    // Extract news topics from response
    let newsTopics = [];
    const textContent = searchMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        newsTopics = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse news topics JSON:', e);
        newsTopics = [];
      }
    }

    // Build context for AI
    const context = formatWeeklyContext(weekStart, weekEnd, newsTopics, billsContext);

    // Generate article with Claude (with web search for additional context)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: WEEKLY_ROUNDUP_SYSTEM_PROMPT,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search'
      }],
      messages: [{
        role: 'user',
        content: `Write the weekly roundup article for the Buffalo Bills based on this data. You may search for additional details about specific topics if needed:\n\n${context}`
      }]
    });

    // Extract content from response
    const content = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Generate title and meta description
    const title = generateWeeklyTitle(weekStart);
    const metaDescription = `Buffalo Bills week in review: ${formatDate(weekStart)} to ${formatDate(weekEnd)}. ${isNFLSeason() ? 'Game recaps and analysis.' : 'Offseason news, roster updates, and draft coverage.'}`;

    // Determine publish status from KV settings
    const autoPublish = await getAutoPublishSetting('bills-weekly');

    // Create the post
    const post = await createPost({
      title,
      content,
      status: autoPublish ? 'published' : 'draft',
      weekStartDate: weekStart.toISOString(),
      weekEndDate: weekEnd.toISOString(),
      metaDescription
    });

    // Mark this week as processed
    await kv.set('blog:bills-weekly:last', weekStartStr);

    return res.status(200).json({
      success: true,
      postId: post.id,
      postSlug: post.slug,
      status: post.status,
      weekStart: weekStartStr,
      newsTopicsFound: newsTopics.length
    });

  } catch (error) {
    console.error('Bills weekly roundup generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate Bills weekly roundup',
      message: error.message
    });
  }
}
