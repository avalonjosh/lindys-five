import { kv } from '@vercel/kv';
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

// Generate a URL-friendly slug from title
function generateSlug(title, date) {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return `${titleSlug}-${dateStr}`;
}

// Generate a unique slug by checking for existing slugs and appending suffix if needed
async function generateUniqueSlug(title, date, maxAttempts = 10) {
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
function generateExcerpt(content, maxLength = 200) {
  // Remove markdown formatting
  const plainText = content
    .replace(/#{1,6}\s/g, '')  // Headers
    .replace(/\*\*|__/g, '')   // Bold
    .replace(/\*|_/g, '')      // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
    .replace(/\n+/g, ' ')      // Newlines
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength).trim() + '...';
}

export default async function handler(req, res) {
  // GET - List posts
  if (req.method === 'GET') {
    try {
      const { team, status, type, limit = 20, offset = 0 } = req.query;

      // Get all post IDs (sorted by publish date, newest first)
      let postIds = await kv.zrange('blog:posts', 0, -1, { rev: true }) || [];

      // If filtering by team, use team-specific set
      if (team) {
        postIds = await kv.zrange(`blog:posts:${team}`, 0, -1, { rev: true }) || [];
      }

      // Fetch post data
      const posts = [];
      for (const id of postIds) {
        const post = await kv.get(`blog:post:${id}`);
        if (post) {
          // Apply filters
          if (status && post.status !== status) continue;
          if (type && post.type !== type) continue;

          // For public requests, only show published posts
          const isAdmin = await verifyAdmin(req);
          if (!isAdmin && post.status !== 'published') continue;

          posts.push(post);
        }
      }

      // Apply pagination
      const paginatedPosts = posts.slice(Number(offset), Number(offset) + Number(limit));

      return res.status(200).json({
        posts: paginatedPosts,
        total: posts.length,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }
  }

  // POST - Create new post (admin only)
  if (req.method === 'POST') {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
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
        pinned = false
      } = req.body;

      // Validate required fields
      if (!title || !content || !team || !type) {
        return res.status(400).json({
          error: 'Missing required fields: title, content, team, type'
        });
      }

      // Validate team
      if (!['sabres', 'bills'].includes(team)) {
        return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
      }

      // Validate type
      if (!['game-recap', 'set-recap', 'custom', 'weekly-roundup', 'news-analysis'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
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
        pinned: pinned || false
      };

      // Handle pinning - only one post can be pinned at a time
      if (pinned) {
        // Get currently pinned post ID
        const currentPinnedId = await kv.get('blog:pinned');
        if (currentPinnedId && currentPinnedId !== id) {
          // Unpin the currently pinned post
          const currentPinnedPost = await kv.get(`blog:post:${currentPinnedId}`);
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

      return res.status(201).json({
        success: true,
        post
      });
    } catch (error) {
      console.error('Error creating post:', error);
      return res.status(500).json({ error: 'Failed to create post' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}
