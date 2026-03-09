import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

const WEEKLY_ROUNDUP_SYSTEM_PROMPT = `You are a professional sports journalist writing the weekly roundup for "Lindy's Five", a Buffalo Bills fan blog.

Your task is to summarize the week in Bills news based on the topics provided and any current events.

Structure your article with these sections:
1. **Opening** (2-3 sentences): Week overview
2. **Top Stories**: Major news items with details (2-3 stories)
3. **Quick Hits**: Brief mentions of smaller news items
4. **Roster Watch**: Any player movements, signings, or injury updates
5. **Looking Ahead**: What to watch for next week

Style Guidelines:
- Professional sports journalism tone
- 500-800 words total
- Use Markdown with ## headers
- Use **bold** for player names and key terms

Do NOT include the word "TITLE:" or "META:" in your response.

CRITICAL: Focus on the verified news topics provided.`;

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

    return { billsRecord, divisionPosition };
  } catch (error) { console.error('Failed to fetch Bills context:', error); return null; }
}

function getLastMonday(date: Date) {
  const d = new Date(date); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) - 7);
  d.setHours(0, 0, 0, 0); return d;
}

function getLastSunday(date: Date) {
  const monday = getLastMonday(date); const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6); sunday.setHours(23, 59, 59, 999); return sunday;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isNFLSeason() { const month = new Date().getMonth(); return month >= 8 || month <= 1; }

function formatWeeklyContext(weekStart: Date, weekEnd: Date, newsTopics: string[], context: any) {
  return `
═══════════════════════════════════════════════════════
BILLS WEEKLY NEWS SUMMARY
Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}
Season Status: ${isNFLSeason() ? 'NFL Regular Season' : 'NFL Offseason'}
═══════════════════════════════════════════════════════

${context ? `CURRENT STANDINGS:\n- Record: ${context.billsRecord}\n- Division: ${context.divisionPosition}\n\n` : ''}NEWS TOPICS THIS WEEK:
${newsTopics.length > 0 ? newsTopics.map((topic: string, i: number) => `${i + 1}. ${topic}`).join('\n') : 'No specific news topics provided - search for recent Bills news to write about.'}

═══════════════════════════════════════════════════════
`;
}

function generateWeeklyTitle(weekStart: Date) {
  const formattedDate = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return isNFLSeason() ? `Bills Week in Review: ${formattedDate}` : `Bills Offseason Update: Week of ${formattedDate}`;
}

async function createPost(postData: any) {
  const dateStr = new Date().toISOString().split('T')[0];
  const slug = `${postData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50)}-${dateStr}`;
  const plainText = postData.content.replace(/#{1,6}\s/g, '').replace(/\*\*|__/g, '').replace(/\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ').trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const post = {
    id, slug, title: postData.title, content: postData.content, excerpt,
    team: 'bills', type: 'weekly-roundup', status: postData.status,
    createdAt: now, publishedAt: postData.status === 'published' ? now : null, updatedAt: now,
    weekStartDate: postData.weekStartDate, weekEndDate: postData.weekEndDate,
    aiGenerated: true, aiModel: 'claude-sonnet-4-20250514', metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);
  const score = post.publishedAt ? new Date(post.publishedAt).getTime() : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd('blog:posts:bills', { score, member: id });
  await kv.zadd('blog:posts:type:weekly-roundup', { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);
  return post;
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekStart = getLastMonday(now);
    const weekEnd = getLastSunday(now);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const lastRoundupDate = await kv.get('blog:bills-weekly:last');
    if (lastRoundupDate === weekStartStr) {
      return NextResponse.json({ success: false, message: 'Bills weekly roundup already generated for this week', weekStart: weekStartStr });
    }

    const billsContext = await fetchBillsContext();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const searchMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 2048,
      system: `You are a sports news researcher. Search for Buffalo Bills news from the past week and return a JSON array of the top 5-7 news topics.\n\nFormat: ["Topic 1 description", "Topic 2 description", ...]`,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `Search for Buffalo Bills news from ${formatDate(weekStart)} to ${formatDate(weekEnd)} (${weekStartStr}). Today is ${new Date().toISOString().split('T')[0]}.\n\nAfter searching, respond with a JSON array of the top news topics from this week.` }]
    });

    let newsTopics: string[] = [];
    const textContent = searchMessage.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) { try { newsTopics = JSON.parse(jsonMatch[0]); } catch { newsTopics = []; } }

    const context = formatWeeklyContext(weekStart, weekEnd, newsTopics, billsContext);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 4096, system: WEEKLY_ROUNDUP_SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `Write the weekly roundup article for the Buffalo Bills based on this data. You may search for additional details if needed:\n\n${context}` }]
    });

    const content = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const title = generateWeeklyTitle(weekStart);
    const metaDescription = `Buffalo Bills week in review: ${formatDate(weekStart)} to ${formatDate(weekEnd)}. ${isNFLSeason() ? 'Game recaps and analysis.' : 'Offseason news, roster updates, and draft coverage.'}`;

    const autoPublish = await getAutoPublishSetting('bills-weekly');

    const post = await createPost({
      title, content, status: autoPublish ? 'published' : 'draft',
      weekStartDate: weekStart.toISOString(), weekEndDate: weekEnd.toISOString(), metaDescription
    });

    await kv.set('blog:bills-weekly:last', weekStartStr);

    return NextResponse.json({ success: true, postId: post.id, postSlug: post.slug, status: post.status, weekStart: weekStartStr, newsTopicsFound: newsTopics.length });
  } catch (error: any) {
    console.error('Bills weekly roundup generation error:', error);
    return NextResponse.json({ error: 'Failed to generate Bills weekly roundup', message: error.message }, { status: 500 });
  }
}
