import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
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

// Generate excerpt from content
function generateExcerpt(content: string, maxLength: number = 200): string {
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

// GET - Fetch single post by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  try {
    // Look up post ID by slug
    const postId = await kv.get(`blog:slug:${slug}`);

    if (!postId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch the post
    const post: any = await kv.get(`blog:post:${postId}`);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if post is published (unless admin)
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin && post.status !== 'published') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Track view for published posts (but not for admin views)
    if (post.status === 'published' && !isAdmin) {
      await kv.incr(`blog:views:${postId}`);
    }

    // Fetch view count for admin
    let views = 0;
    if (isAdmin) {
      views = (await kv.get(`blog:views:${postId}`)) || 0;
    }

    return NextResponse.json({ post, views });
  } catch (error) {
    console.error('Error fetching post:', error);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}

// PUT - Update post (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Look up post ID by slug
    const postId = await kv.get(`blog:slug:${slug}`);

    if (!postId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch existing post
    const existingPost: any = await kv.get(`blog:post:${postId}`);

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
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
      publishedAt,
      pinned,
    } = await request.json();

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
      ogImage: ogImage !== undefined ? ogImage : existingPost.ogImage,
      pinned: pinned !== undefined ? pinned : existingPost.pinned,
    };

    // Handle pinning logic
    if (pinned !== undefined) {
      if (pinned) {
        // Pinning this post - unpin any currently pinned post first
        const currentPinnedId = await kv.get('blog:pinned');
        if (currentPinnedId && currentPinnedId !== postId) {
          const currentPinnedPost: any = await kv.get(`blog:post:${currentPinnedId}`);
          if (currentPinnedPost) {
            currentPinnedPost.pinned = false;
            await kv.set(`blog:post:${currentPinnedId}`, currentPinnedPost);
          }
        }
        // Set this post as pinned
        await kv.set('blog:pinned', postId);
      } else {
        // Unpinning this post
        const currentPinnedId = await kv.get('blog:pinned');
        if (currentPinnedId === postId) {
          await kv.del('blog:pinned');
        }
      }
    }

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

    return NextResponse.json({ success: true, post: updatedPost });
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

// DELETE - Delete post (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Look up post ID by slug
    const postId = await kv.get(`blog:slug:${slug}`);

    if (!postId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch the post to get team and type for cleanup
    const post: any = await kv.get(`blog:post:${postId}`);

    if (post) {
      // Remove from sorted sets
      await kv.zrem('blog:posts', postId as string);
      await kv.zrem(`blog:posts:${post.team}`, postId as string);
      await kv.zrem(`blog:posts:type:${post.type}`, postId as string);

      // If this was the pinned post, remove the pinned key
      if (post.pinned) {
        const currentPinnedId = await kv.get('blog:pinned');
        if (currentPinnedId === postId) {
          await kv.del('blog:pinned');
        }
      }
    }

    // Delete the post and slug mapping
    await kv.del(`blog:post:${postId}`);
    await kv.del(`blog:slug:${slug}`);

    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
