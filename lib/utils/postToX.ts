import crypto from 'crypto';

const X_API_URL = 'https://api.x.com/2/tweets';

// Hashtags by team
const HASHTAGS: Record<string, string> = {
  sabres: '#Sabres #LetsGoBuffalo #NHL',
  bills: '#Bills #GoBills #NFL',
};

interface PostToXParams {
  tweetText: string;
  articleUrl: string;
  team: string;
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function generateOAuthHeader(method: string, url: string, body: string): string {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_KEY_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error('X API credentials not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

/**
 * Post a tweet to X using the v2 API with OAuth 1.0a
 */
export async function postTweetToX({ tweetText, articleUrl, team }: PostToXParams): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const apiKey = process.env.X_API_KEY;
  if (!apiKey) {
    console.warn('X API credentials not configured, skipping tweet');
    return { success: false, error: 'X API credentials not configured' };
  }

  const hashtags = HASHTAGS[team] || '';
  const fullTweet = `${tweetText}\n\n${articleUrl}\n\n${hashtags}`;

  // Enforce 280 character limit
  if (fullTweet.length > 280) {
    // Trim the tweet text to fit
    const overhead = `\n\n${articleUrl}\n\n${hashtags}`.length;
    const maxTextLength = 280 - overhead;
    const trimmedText = tweetText.substring(0, maxTextLength - 3) + '...';
    return postTweet(`${trimmedText}\n\n${articleUrl}\n\n${hashtags}`);
  }

  return postTweet(fullTweet);
}

async function postTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const body = JSON.stringify({ text });
    const authHeader = generateOAuthHeader('POST', X_API_URL, body);

    const response = await fetch(X_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('X API error:', response.status, errorData);
      return { success: false, error: `X API returned ${response.status}: ${JSON.stringify(errorData)}` };
    }

    const data = await response.json();
    console.log('Tweet posted successfully:', data.data?.id);
    return { success: true, tweetId: data.data?.id };
  } catch (error: any) {
    console.error('Failed to post tweet:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate tweet text using Claude and post it to X
 * This reuses the same prompt logic from the generate-tweet API route
 */
export async function generateAndPostTweet(post: {
  title: string;
  excerpt: string;
  content: string;
  team: string;
  type: string;
  slug: string;
}): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  // Dynamic import to avoid loading Anthropic in every module
  const { default: Anthropic } = await import('@anthropic-ai/sdk');

  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const typeLabelMap: Record<string, string> = {
    'game-recap': 'Game Recap',
    'set-recap': 'Set Recap',
    'news-analysis': 'News/Analysis',
    'weekly-roundup': 'Weekly Roundup',
    'custom': 'Article',
  };
  const typeLabel = typeLabelMap[post.type] || 'Article';
  const teamName = post.team === 'sabres' ? 'Buffalo Sabres' : 'Buffalo Bills';
  const hashtags = HASHTAGS[post.team] || '';
  const contentPreview = post.content ? post.content.slice(0, 1000) : '';

  const systemPrompt = `You are a social media manager for "Lindy's Five", a Buffalo sports blog covering the Sabres and Bills.

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

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
      messages: [{
        role: 'user',
        content: `Write a tweet to promote this ${teamName} ${typeLabel.toLowerCase()}:\n\nTitle: ${post.title}\n${post.excerpt ? `Summary: ${post.excerpt}` : ''}\n${contentPreview ? `Article preview: ${contentPreview}...` : ''}\n\nIMPORTANT: The tweet will be followed by a link (23 chars) and hashtags (${hashtags.length} chars).\nTo stay under Twitter's 280 character limit, your text MUST be under 180 characters.\n\nWrite ONLY the tweet text (MAXIMUM 180 characters). Make it sound like a real fan/writer sharing this article.`
      }],
    });

    const tweetText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')
      .trim();

    const articleUrl = `https://www.lindysfive.com/blog/${post.team}/${post.slug}`;

    return postTweetToX({ tweetText, articleUrl, team: post.team });
  } catch (error: any) {
    console.error('Failed to generate tweet:', error);
    // Fallback: post with just the title
    const articleUrl = `https://www.lindysfive.com/blog/${post.team}/${post.slug}`;
    return postTweetToX({ tweetText: post.title, articleUrl, team: post.team });
  }
}
