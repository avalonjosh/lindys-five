import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Hashtags by team
const HASHTAGS: Record<string, string> = {
  sabres: '#Sabres #LetsGoBuffalo #NHL',
  bills: '#Bills #GoBills #NFL',
};

// System prompt for tweet generation
const TWEET_SYSTEM_PROMPT = `You are a social media manager for "Lindy's Five", a Buffalo sports blog covering the Sabres and Bills.

Your task is to write an engaging tweet to promote a new article. The tweet should:
- Sound natural and human-written (not AI-generated)
- Be conversational but professional
- Match the tone to the content (excited for wins, thoughtful for analysis, etc.)
- Grab attention and encourage clicks
- BE CONCISE: Keep the main text under 180 characters (this is critical - a link and hashtags will be added after)

Tweet styles to use:
- For game recaps: Lead with the result, highlight a key moment or player
- For news/analysis: Tease the main insight or controversial take
- For weekly roundups: Summarize the week's story
- For set recaps: Focus on the set result and what it means

DO NOT:
- Use generic phrases like "Check out our latest article"
- Start with "New post:" or similar
- Be overly promotional or clickbaity
- Use excessive exclamation marks
- Exceed 180 characters

Output ONLY the tweet text, nothing else. No quotes around it. Maximum 180 characters.`;

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, excerpt, content, team, type, slug } = await request.json();

  // Validate required fields
  if (!title || !team || !slug) {
    return NextResponse.json(
      { error: 'Missing required fields: title, team, and slug are required' },
      { status: 400 }
    );
  }

  if (!['sabres', 'bills'].includes(team)) {
    return NextResponse.json({ error: 'Invalid team. Must be sabres or bills' }, { status: 400 });
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI service not configured', details: 'ANTHROPIC_API_KEY environment variable is not set' },
      { status: 500 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build context for the tweet
    const typeLabelMap: Record<string, string> = {
      'game-recap': 'Game Recap',
      'set-recap': 'Set Recap',
      'news-analysis': 'News/Analysis',
      'weekly-roundup': 'Weekly Roundup',
      'custom': 'Article',
    };
    const typeLabel = typeLabelMap[type] || 'Article';

    const teamName = team === 'sabres' ? 'Buffalo Sabres' : 'Buffalo Bills';

    // Truncate content if too long (keep first 1000 chars for context)
    const contentPreview = content ? content.slice(0, 1000) : '';

    const userPrompt = `Write a tweet to promote this ${teamName} ${typeLabel.toLowerCase()}:

Title: ${title}
${excerpt ? `Summary: ${excerpt}` : ''}
${contentPreview ? `Article preview: ${contentPreview}...` : ''}

IMPORTANT: The tweet will be followed by a link (23 chars) and hashtags (${HASHTAGS[team].length} chars).
To stay under Twitter's 280 character limit, your text MUST be under 180 characters.

Write ONLY the tweet text (MAXIMUM 180 characters). Make it sound like a real fan/writer sharing this article.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: TWEET_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content
    const tweetText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')
      .trim();

    // Build the article URL
    const articleUrl = `https://lindysfive.com/blog/${team}/${slug}`;

    // Construct full tweet with link and hashtags
    const fullTweet = `${tweetText}\n\n${articleUrl}\n\n${HASHTAGS[team]}`;

    return NextResponse.json({
      success: true,
      tweet: fullTweet,
      tweetText,
      url: articleUrl,
      hashtags: HASHTAGS[team],
    });
  } catch (error: any) {
    console.error('Error generating tweet:', error);

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'AI service authentication failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate tweet', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
