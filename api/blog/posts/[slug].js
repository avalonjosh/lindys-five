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

// Generate excerpt from content
function generateExcerpt(content, maxLength = 200) {
  const plainText = content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength).trim() + '...';
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  // GET - Fetch single post by slug
  if (req.method === 'GET') {
    try {
      // Look up post ID by slug
      const postId = await kv.get(`blog:slug:${slug}`);

      if (!postId) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Fetch the post
      const post = await kv.get(`blog:post:${postId}`);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Check if post is published (unless admin)
      const isAdmin = await verifyAdmin(req);
      if (!isAdmin && post.status !== 'published') {
        return res.status(404).json({ error: 'Post not found' });
      }

      return res.status(200).json({ post });
    } catch (error) {
      console.error('Error fetching post:', error);
      return res.status(500).json({ error: 'Failed to fetch post' });
    }
  }

  // PUT - Update post (admin only)
  if (req.method === 'PUT') {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Look up post ID by slug
      const postId = await kv.get(`blog:slug:${slug}`);

      if (!postId) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Fetch existing post
      const existingPost = await kv.get(`blog:post:${postId}`);

      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const {
        title,
        content,
        status,
        gameId,
        opponent,
        gameDate,
        setNumber,
        metaDescription,
        ogImage,
        publishedAt
      } = req.body;

      const now = new Date().toISOString();

      // Update the post
      const updatedPost = {
        ...existingPost,
        title: title !== undefined ? title : existingPost.title,
        content: content !== undefined ? content : existingPost.content,
        excerpt: content !== undefined ? generateExcerpt(content) : existingPost.excerpt,
        status: status !== undefined ? status : existingPost.status,
        updatedAt: now,
        gameId: gameId !== undefined ? gameId : existingPost.gameId,
        opponent: opponent !== undefined ? opponent : existingPost.opponent,
        gameDate: gameDate !== undefined ? gameDate : existingPost.gameDate,
        setNumber: setNumber !== undefined ? setNumber : existingPost.setNumber,
        metaDescription: metaDescription !== undefined ? metaDescription : existingPost.metaDescription,
        ogImage: ogImage !== undefined ? ogImage : existingPost.ogImage
      };

      // Handle publishedAt: use custom date if provided, otherwise default to now when publishing
      if (publishedAt !== undefined) {
        // Custom publish date provided - use it (can be set or cleared)
        updatedPost.publishedAt = publishedAt || null;
      } else if (status === 'published' && !existingPost.publishedAt) {
        // Publishing for the first time without custom date - use now
        updatedPost.publishedAt = now;
      }

      // Save updated post
      await kv.set(`blog:post:${postId}`, updatedPost);

      // Update sorted set scores if publishedAt changed (for correct sort order)
      const newPublishedAt = updatedPost.publishedAt;
      const oldPublishedAt = existingPost.publishedAt;
      if (newPublishedAt !== oldPublishedAt) {
        // Calculate new score based on publishedAt (or createdAt for unpublished)
        const newScore = newPublishedAt
          ? new Date(newPublishedAt).getTime()
          : new Date(existingPost.createdAt).getTime();

        // Update all sorted sets with new score
        await kv.zadd('blog:posts', { score: newScore, member: postId });
        await kv.zadd(`blog:posts:${existingPost.team}`, { score: newScore, member: postId });
        await kv.zadd(`blog:posts:type:${existingPost.type}`, { score: newScore, member: postId });
      }

      return res.status(200).json({
        success: true,
        post: updatedPost
      });
    } catch (error) {
      console.error('Error updating post:', error);
      return res.status(500).json({ error: 'Failed to update post' });
    }
  }

  // DELETE - Delete post (admin only)
  if (req.method === 'DELETE') {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Look up post ID by slug
      const postId = await kv.get(`blog:slug:${slug}`);

      if (!postId) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Fetch the post to get team and type for cleanup
      const post = await kv.get(`blog:post:${postId}`);

      if (post) {
        // Remove from sorted sets
        await kv.zrem('blog:posts', postId);
        await kv.zrem(`blog:posts:${post.team}`, postId);
        await kv.zrem(`blog:posts:type:${post.type}`, postId);
      }

      // Delete the post and slug mapping
      await kv.del(`blog:post:${postId}`);
      await kv.del(`blog:slug:${slug}`);

      return res.status(200).json({
        success: true,
        message: 'Post deleted'
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      return res.status(500).json({ error: 'Failed to delete post' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}
