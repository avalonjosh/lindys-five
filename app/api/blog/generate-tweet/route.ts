import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { generateTweetText } from '@/lib/utils/postToX';

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

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, excerpt, content, team, type, slug } = await request.json();

  // Validate required fields
  if (!title || !team || !slug) {
    return NextResponse.json(
      { error: 'Missing required fields: title, team, and slug are required' },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI service not configured', details: 'ANTHROPIC_API_KEY environment variable is not set' },
      { status: 500 }
    );
  }

  try {
    const { tweetText, articleUrl, hashtags, fullTweet } = await generateTweetText({
      title,
      excerpt,
      content,
      team,
      type,
      slug,
    });

    return NextResponse.json({
      success: true,
      tweet: fullTweet,
      tweetText,
      url: articleUrl,
      hashtags,
    });
  } catch (error: any) {
    console.error('Error generating tweet:', error);

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate tweet', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
