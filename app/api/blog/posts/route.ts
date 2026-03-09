import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { truncateAtWordBoundary } from '@/lib/fetchWithRetry';

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

// Generate a URL-friendly slug from title
function generateSlug(title: string, date: string): string {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return `${titleSlug}-${dateStr}`;
}

// Generate a unique slug by checking for existing slugs and appending suffix if needed
async function generateUniqueSlug(title: string, date: string, maxAttempts: number = 10): Promise<string> {
  const baseSlug = generateSlug(title, date);

  // Check if base slug is available
  const existingId = await kv.get(`blog:slug:${baseSlug}`);
  if (!existingId) {
    return baseSlug;
  }

  // Try adding numeric suffixes
  for (let i = 2; i <= maxAttempts + 1; i++) {
    const suffixedSlug = `${baseSlug}-${i}`;
    const existingSuffixedId = await kv.get(`blog:slug:${suffixedSlug}`);
    if (!existingSuffixedId) {
      console.log(`Slug collision detected for "${baseSlug}", using "${suffixedSlug}" instead`);
      return suffixedSlug;
    }
  }

  // Fallback: append timestamp for guaranteed uniqueness
  const fallbackSlug = `${baseSlug}-${Date.now()}`;
  console.log(`Multiple slug collisions for "${baseSlug}", using timestamp fallback: "${fallbackSlug}"`);
  return fallbackSlug;
}

// Generate excerpt from content
function generateExcerpt(content: string, maxLength: number = 200): string {
  // Remove markdown formatting
  const plainText = content
    .replace(/#{1,6}\s/g, '')  // Headers
    .replace(/\*\*|__/g, '')   // Bold
    .replace(/\*|_/g, '')      // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
    .replace(/\n+/g, ' ')      // Newlines
    .trim();

  // Truncate at word boundary to avoid cutting mid-word
  return truncateAtWordBoundary(plainText, maxLength, '...');
}

// GET - List posts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const team = searchParams.get('team');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = Number(searchParams.get('limit') || 20);
    const offset = Number(searchParams.get('offset') || 0);
    const lookup = searchParams.get('lookup');

    // Lightweight lookup mode for game recap → slug mapping
    if (lookup === 'game-recap' && team) {
      const postIds = await kv.zrange(`blog:posts:${team}`, 0, -1) || [];
      const recaps: Record<string, string> = {};

      for (const id of postIds) {
        const post: any = await kv.get(`blog:post:${id}`);
        if (post && post.type === 'game-recap' && post.status === 'published' && post.gameId) {
          recaps[post.gameId] = post.slug;
        }
      }

      return NextResponse.json({ recaps });
    }

    // Get all post IDs (sorted by publish date, newest first)
    let postIds = await kv.zrange('blog:posts', 0, -1, { rev: true }) || [];

    // If filtering by team, use team-specific set
    if (team) {
      postIds = await kv.zrange(`blog:posts:${team}`, 0, -1, { rev: true }) || [];
    }

    // Check admin status once
    const isAdmin = await verifyAdmin(request);

    // Fetch post data
    const posts: any[] = [];
    for (const id of postIds) {
      const post: any = await kv.get(`blog:post:${id}`);
      if (post) {
        // Apply filters
        if (status && post.status !== status) continue;
        if (type && post.type !== type) continue;

        // For public requests, only show published posts
        if (!isAdmin && post.status !== 'published') continue;

        // Include view count for admin
        if (isAdmin) {
          const views = await kv.get(`blog:views:${id}`) || 0;
          post.views = views;
        }

        posts.push(post);
      }
    }

    // Apply pagination
    const paginatedPosts = posts.slice(offset, offset + limit);

    return NextResponse.json({
      posts: paginatedPosts,
      total: posts.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// POST - Create new post (admin only)
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      title,
      content,
      team,
      type,
      status = 'draft',
      gameId,
      opponent,
      gameDate,
      setNumber,
      weekStartDate,
      weekEndDate,
      newsTopics,
      sourceHeadlines,
      aiGenerated = false,
      aiModel,
      metaDescription,
      ogImage,
      publishedAt,
      pinned = false,
    } = await request.json();

    // Validate required fields
    if (!title || !content || !team || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, team, type' },
        { status: 400 }
      );
    }

    // Validate team
    if (!['sabres', 'bills'].includes(team)) {
      return NextResponse.json({ error: 'Invalid team. Must be sabres or bills' }, { status: 400 });
    }

    // Validate type
    if (!['game-recap', 'set-recap', 'custom', 'weekly-roundup', 'news-analysis'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Generate ID and unique slug (checks for collisions)
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = await generateUniqueSlug(title, now);

    // Determine publish date: use custom publishedAt if provided, else use now if publishing
    const effectivePublishedAt = status === 'published'
      ? (publishedAt || now)
      : null;

    // Create the post object
    const post = {
      id,
      slug,
      title,
      content,
      excerpt: generateExcerpt(content),
      team,
      type,
      status,
      createdAt: now,
      publishedAt: effectivePublishedAt,
      updatedAt: now,
      gameId: gameId || null,
      opponent: opponent || null,
      gameDate: gameDate || null,
      setNumber: setNumber || null,
      weekStartDate: weekStartDate || null,
      weekEndDate: weekEndDate || null,
      newsTopics: newsTopics || null,
      sourceHeadlines: sourceHeadlines || null,
      aiGenerated,
      aiModel: aiModel || null,
      metaDescription: metaDescription || generateExcerpt(content, 160),
      ogImage: ogImage || null,
      pinned: pinned || false,
    };

    // Handle pinning - only one post can be pinned at a time
    if (pinned) {
      // Get currently pinned post ID
      const currentPinnedId = await kv.get('blog:pinned');
      if (currentPinnedId && currentPinnedId !== id) {
        // Unpin the currently pinned post
        const currentPinnedPost: any = await kv.get(`blog:post:${currentPinnedId}`);
        if (currentPinnedPost) {
          currentPinnedPost.pinned = false;
          await kv.set(`blog:post:${currentPinnedId}`, currentPinnedPost);
        }
      }
      // Set this post as pinned
      await kv.set('blog:pinned', id);
    }

    // Save to KV
    await kv.set(`blog:post:${id}`, post);

    // Add to sorted sets for querying
    // Use publishedAt for score so posts sort by publish date, not creation date
    const score = effectivePublishedAt
      ? new Date(effectivePublishedAt).getTime()
      : new Date(now).getTime();
    await kv.zadd('blog:posts', { score, member: id });
    await kv.zadd(`blog:posts:${team}`, { score, member: id });
    await kv.zadd(`blog:posts:type:${type}`, { score, member: id });

    // Create slug -> id mapping for lookups
    await kv.set(`blog:slug:${slug}`, id);

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
