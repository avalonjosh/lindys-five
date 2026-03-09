import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const postId = await kv.get(`blog:slug:${slug}`);
    if (!postId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    await kv.incr(`blog:views:${postId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
