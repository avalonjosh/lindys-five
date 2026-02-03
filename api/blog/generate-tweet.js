import Anthropic from '@anthropic-ai/sdk';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(req) {
  const token = req.cookies?.admin_token;
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
const HASHTAGS = {
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

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { title, excerpt, content, team, type, slug } = req.body;

  // Validate required fields
  if (!title || !team || !slug) {
    return res.status(400).json({
      error: 'Missing required fields: title, team, and slug are required',
    });
  }

  if (!['sabres', 'bills'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'AI service not configured',
      details: 'ANTHROPIC_API_KEY environment variable is not set',
    });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build context for the tweet
    const typeLabel = {
      'game-recap': 'Game Recap',
      'set-recap': 'Set Recap',
      'news-analysis': 'News/Analysis',
      'weekly-roundup': 'Weekly Roundup',
      'custom': 'Article',
    }[type] || 'Article';

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
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    // Build the article URL
    const articleUrl = `https://lindysfive.com/blog/${team}/${slug}`;

    // Construct full tweet with link and hashtags
    const fullTweet = `${tweetText}\n\n${articleUrl}\n\n${HASHTAGS[team]}`;

    return res.status(200).json({
      success: true,
      tweet: fullTweet,
      tweetText,
      url: articleUrl,
      hashtags: HASHTAGS[team],
    });
  } catch (error) {
    console.error('Error generating tweet:', error);

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.',
      });
    }

    if (error.status === 401) {
      return res.status(500).json({
        error: 'AI service authentication failed',
      });
    }

    return res.status(500).json({
      error: 'Failed to generate tweet',
      details: error.message || 'Unknown error',
    });
  }
}
