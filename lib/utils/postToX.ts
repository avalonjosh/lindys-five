import crypto from 'crypto';
import { kv } from '@vercel/kv';
import { TEAMS } from '@/lib/teamConfig';

const X_API_URL = 'https://api.x.com/2/tweets';

// Hashtags by team
const HASHTAGS: Record<string, string> = {
  sabres: '#Sabres #LetsGoBuffalo #NHL',
  bills: '#Bills #GoBills #NFL',
};

// Team name + hashtags for any blog team slug (playoff/series posts can be any NHL team)
export function getTeamXContext(team: string): { teamName: string; hashtags: string } {
  if (team === 'sabres') return { teamName: 'Buffalo Sabres', hashtags: HASHTAGS.sabres };
  if (team === 'bills') return { teamName: 'Buffalo Bills', hashtags: HASHTAGS.bills };
  const nhlTeam = TEAMS[team];
  if (nhlTeam) {
    return { teamName: `${nhlTeam.city} ${nhlTeam.name}`, hashtags: `#${nhlTeam.name.replace(/\s+/g, '')} #NHL` };
  }
  return { teamName: 'NHL', hashtags: '#NHL' };
}

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

  const { hashtags } = getTeamXContext(team);
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

// Post exact text to X with no URL/hashtag decoration (used for admin-edited tweets)
export async function postRawTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  if (!process.env.X_API_KEY) {
    console.warn('X API credentials not configured, skipping tweet');
    return { success: false, error: 'X API credentials not configured' };
  }
  return postTweet(text);
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

export interface TweetablePost {
  id?: string;
  title: string;
  excerpt?: string;
  content?: string;
  team: string;
  type: string;
  slug: string;
}

const TWEET_SYSTEM_PROMPT = `You are a social media manager for "Lindy's Five", a Buffalo sports blog covering the Sabres, Bills, and the NHL at large.

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
- For playoff/series recaps: Lead with the stakes and the result

DO NOT:
- Use generic phrases like "Check out our latest article"
- Start with "New post:" or similar
- Be overly promotional or clickbaity
- Use excessive exclamation marks
- Exceed 180 characters

Output ONLY the tweet text, nothing else. No quotes around it. Maximum 180 characters.`;

/**
 * Generate promotional tweet copy for a post with Claude Haiku.
 * Shared by the auto-post pipeline and the admin generate-tweet endpoint.
 */
export async function generateTweetText(post: TweetablePost): Promise<{
  tweetText: string;
  articleUrl: string;
  hashtags: string;
  fullTweet: string;
}> {
  const { teamName, hashtags } = getTeamXContext(post.team);
  const articleUrl = `https://www.lindysfive.com/blog/${post.team}/${post.slug}`;

  const typeLabelMap: Record<string, string> = {
    'game-recap': 'Game Recap',
    'set-recap': 'Set Recap',
    'news-analysis': 'News/Analysis',
    'weekly-roundup': 'Weekly Roundup',
    'playoff-game-recap': 'Playoff Game Recap',
    'series-recap': 'Playoff Series Recap',
    'custom': 'Article',
  };
  const typeLabel = typeLabelMap[post.type] || 'Article';
  const contentPreview = post.content ? post.content.slice(0, 1000) : '';

  let tweetText = post.title;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Dynamic import to avoid loading Anthropic in every module
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: [{ type: 'text' as const, text: TWEET_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } }],
        messages: [{
          role: 'user',
          content: `Write a tweet to promote this ${teamName} ${typeLabel.toLowerCase()}:\n\nTitle: ${post.title}\n${post.excerpt ? `Summary: ${post.excerpt}` : ''}\n${contentPreview ? `Article preview: ${contentPreview}...` : ''}\n\nIMPORTANT: The tweet will be followed by a link (23 chars) and hashtags (${hashtags.length} chars).\nTo stay under Twitter's 280 character limit, your text MUST be under 180 characters.\n\nWrite ONLY the tweet text (MAXIMUM 180 characters). Make it sound like a real fan/writer sharing this article.`
        }],
      });

      const generated = message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('')
        .trim();
      if (generated) tweetText = generated;
    } catch (error) {
      console.error('Failed to generate tweet copy, falling back to post title:', error);
    }
  }

  return {
    tweetText,
    articleUrl,
    hashtags,
    fullTweet: `${tweetText}\n\n${articleUrl}\n\n${hashtags}`,
  };
}

/**
 * Generate tweet text using Claude and post it to X (no dedupe guard).
 * Prefer tweetPublishedPost() which guards against double-tweeting.
 */
export async function generateAndPostTweet(post: TweetablePost): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const { tweetText, articleUrl } = await generateTweetText(post);
  return postTweetToX({ tweetText, articleUrl, team: post.team });
}

export interface TweetPublishResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  skipped?: 'already-tweeted';
}

/**
 * Tweet a just-published post exactly once.
 * - Skips if the post was already tweeted (KV flag blog:tweeted:{postId}).
 * - Records the outcome (tweetId or error) on the post record so the admin can see it.
 * Never throws.
 */
export async function tweetPublishedPost(
  post: TweetablePost,
  options?: { fullTweet?: string; force?: boolean }
): Promise<TweetPublishResult> {
  try {
    if (post.id && !options?.force) {
      const alreadyTweeted = await kv.get(`blog:tweeted:${post.id}`);
      if (alreadyTweeted) {
        return { success: true, skipped: 'already-tweeted', tweetId: (alreadyTweeted as any)?.tweetId };
      }
    }

    const result = options?.fullTweet
      ? await postRawTweet(options.fullTweet)
      : await generateAndPostTweet(post);

    if (post.id) {
      const now = new Date().toISOString();
      if (result.success) {
        await kv.set(`blog:tweeted:${post.id}`, { tweetId: result.tweetId, tweetedAt: now });
      }
      // Record outcome on the post so the admin UI can surface it
      try {
        const record: any = await kv.get(`blog:post:${post.id}`);
        if (record) {
          record.xPost = result.success
            ? { tweetId: result.tweetId, tweetedAt: now }
            : { error: result.error, lastAttemptAt: now };
          await kv.set(`blog:post:${post.id}`, record);
        }
      } catch (recordError) {
        console.error(`Failed to record tweet outcome on post ${post.id}:`, recordError);
      }
    }

    if (!result.success) {
      console.warn(`Tweet failed for post "${post.title}":`, result.error);
    }
    return result;
  } catch (error: any) {
    console.error(`tweetPublishedPost failed for "${post.title}":`, error);
    return { success: false, error: error.message };
  }
}
