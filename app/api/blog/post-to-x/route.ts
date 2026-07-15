import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { tweetPublishedPost } from '@/lib/utils/postToX';

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

// POST - post a tweet for a blog post via the X API (admin only)
// Body: { slug: string, fullTweet?: string }
// fullTweet posts the given text verbatim (admin-edited in ShareToXModal);
// without it, tweet copy is generated automatically.
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug, fullTweet } = await request.json();

  if (!slug) {
    return NextResponse.json({ error: 'Missing required field: slug' }, { status: 400 });
  }

  try {
    const postId = await kv.get(`blog:slug:${slug}`);
    if (!postId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const post: any = await kv.get(`blog:post:${postId}`);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Manual posting is an explicit action — bypass the already-tweeted guard
    const result = await tweetPublishedPost(post, { fullTweet, force: true });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true, tweetId: result.tweetId });
  } catch (error: any) {
    console.error('Error posting to X:', error);
    return NextResponse.json({ error: 'Failed to post to X', details: error.message }, { status: 500 });
  }
}
