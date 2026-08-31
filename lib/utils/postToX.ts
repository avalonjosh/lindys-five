import crypto from 'crypto';
import { kv } from '@vercel/kv';
import { TEAMS } from '@/lib/teamConfig';
import { getAutoXSettingForPost } from '@/lib/blogSettings';

const X_API_URL = 'https://api.x.com/2/tweets';
const X_MEDIA_UPLOAD_URL = 'https://api.x.com/2/media/upload';
const SITE_URL = 'https://www.lindysfive.com';

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
  mediaId?: string;
}

/**
 * Card image for a blog post: the stored Blob image if generation succeeded,
 * otherwise the live /api/og headline card. Shared by the blog page metadata
 * and the X media upload so both always agree on the image.
 */
export function getPostCardImageUrl(post: { team: string; title: string; ogImage?: string | null }): string {
  if (post.ogImage) return post.ogImage;
  const teamAbbrev = post.team === 'bills' ? 'BILLS' : TEAMS[post.team]?.abbreviation || 'BUF';
  return `${SITE_URL}/api/og?type=news-analysis&teamAbbrev=${teamAbbrev}&headline=${encodeURIComponent(post.title)}`;
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
export async function postTweetToX({ tweetText, articleUrl, team, mediaId }: PostToXParams): Promise<{ success: boolean; tweetId?: string; error?: string }> {
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
    return postTweet(`${trimmedText}\n\n${articleUrl}\n\n${hashtags}`, mediaId);
  }

  return postTweet(fullTweet, mediaId);
}

// Post exact text to X with no URL/hashtag decoration (used for admin-edited tweets)
export async function postRawTweet(text: string, mediaId?: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  if (!process.env.X_API_KEY) {
    console.warn('X API credentials not configured, skipping tweet');
    return { success: false, error: 'X API credentials not configured' };
  }
  return postTweet(text, mediaId);
}

/**
 * Download the card image and upload it to X as native media so the tweet
 * carries the image itself instead of depending on X's link-card crawler.
 * Returns undefined on any failure so the tweet still goes out text-only.
 */
export async function uploadMediaToX(imageUrl: string): Promise<string | undefined> {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) {
      console.warn(`X media upload: image fetch returned ${imgRes.status} for ${imageUrl}`);
      return undefined;
    }
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const bytes = await imgRes.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) {
      console.warn(`X media upload: image size ${bytes.byteLength} out of range`);
      return undefined;
    }

    const form = new FormData();
    form.append('media', new Blob([bytes], { type: contentType }), 'card.png');
    form.append('media_category', 'tweet_image');

    // Multipart bodies are not part of the OAuth 1.0a signature base string
    const authHeader = generateOAuthHeader('POST', X_MEDIA_UPLOAD_URL, '');
    const response = await fetch(X_MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: authHeader },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('X media upload error:', response.status, data);
      return undefined;
    }
    const mediaId: string | undefined = data?.data?.id || data?.media_id_string;
    if (!mediaId) {
      console.error('X media upload: no media id in response', data);
      return undefined;
    }
    return mediaId;
  } catch (error) {
    console.error('X media upload failed:', error);
    return undefined;
  }
}

/**
 * Hit the article and its card image once before tweeting so X's crawler
 * (and any reader clicking through) lands on a warm render.
 */
async function warmUpArticle(articleUrl: string, imageUrl: string): Promise<void> {
  const hit = (url: string) =>
    fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'LindysFive-Warmup/1.0' } })
      .then(r => r.arrayBuffer())
      .catch(() => undefined);
  await Promise.all([hit(articleUrl), hit(imageUrl)]);
}

async function postTweet(text: string, mediaId?: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = { text };
    if (mediaId) payload.media = { media_ids: [mediaId] };
    const body = JSON.stringify(payload);
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
  ogImage?: string | null;
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
- Use em dashes (use periods, commas, or colons instead)
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
export async function generateAndPostTweet(post: TweetablePost, mediaId?: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const { tweetText, articleUrl } = await generateTweetText(post);
  return postTweetToX({ tweetText, articleUrl, team: post.team, mediaId });
}

/**
 * Warm the article + card image, then upload the card to X as native media.
 * Returns the media id, or undefined if the upload failed (tweet goes text-only).
 */
async function prepareTweetMedia(post: TweetablePost): Promise<string | undefined> {
  const articleUrl = `${SITE_URL}/blog/${post.team}/${post.slug}`;
  const imageUrl = getPostCardImageUrl(post);
  await warmUpArticle(articleUrl, imageUrl);
  return uploadMediaToX(imageUrl);
}

export interface TweetPublishResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  skipped?: 'already-tweeted' | 'auto-x-off';
}

/**
 * Tweet a just-published post exactly once.
 * - Skips if the type's "Auto-post to X" toggle is off (unless force, i.e. the admin Share button).
 * - Skips if the post was already tweeted (KV flag blog:tweeted:{postId}).
 * - Records the outcome (tweetId or error) on the post record so the admin can see it.
 * Never throws.
 */
export async function tweetPublishedPost(
  post: TweetablePost,
  options?: { fullTweet?: string; force?: boolean }
): Promise<TweetPublishResult> {
  let claimedKey: string | null = null;
  try {
    if (!options?.force) {
      if (!(await getAutoXSettingForPost(post.type, post.team))) {
        return { success: true, skipped: 'auto-x-off' };
      }
      if (post.id) {
        // Atomic claim (NX): generation + media upload + post takes 5-15s, so a
        // plain read-then-write let overlapping runs (cron retry + manual
        // trigger) both pass the check and double-tweet. The claim is replaced
        // with the real record on success and released on failure.
        const key = `blog:tweeted:${post.id}`;
        const claimed = await kv.set(key, { pending: true, claimedAt: new Date().toISOString() }, { nx: true });
        if (!claimed) {
          const alreadyTweeted = await kv.get(key);
          return { success: true, skipped: 'already-tweeted', tweetId: (alreadyTweeted as any)?.tweetId };
        }
        claimedKey = key;
      }
    }

    const mediaId = await prepareTweetMedia(post);
    if (!mediaId) console.warn(`No media attached to tweet for "${post.title}"; falling back to link card`);

    const result = options?.fullTweet
      ? await postRawTweet(options.fullTweet, mediaId)
      : await generateAndPostTweet(post, mediaId);

    if (post.id) {
      const now = new Date().toISOString();
      if (result.success) {
        await kv.set(`blog:tweeted:${post.id}`, { tweetId: result.tweetId, tweetedAt: now });
      } else if (claimedKey) {
        // Release the claim so a later retry can tweet
        await kv.del(claimedKey);
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
    if (claimedKey) {
      try {
        await kv.del(claimedKey);
      } catch {
        // best effort — a stuck claim can be cleared with a forced re-tweet
      }
    }
    return { success: false, error: error.message };
  }
}
