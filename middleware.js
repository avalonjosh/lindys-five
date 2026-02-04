import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Social media crawler user agents
const SOCIAL_CRAWLERS = [
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'WhatsApp',
  'Discordbot',
  'Pinterest',
  'Embedly',
];

// Check if user agent is a social media crawler
function isSocialCrawler(userAgent) {
  if (!userAgent) return false;
  return SOCIAL_CRAWLERS.some((crawler) =>
    userAgent.toLowerCase().includes(crawler.toLowerCase())
  );
}

// Generate minimal HTML with meta tags for crawlers
function generateCrawlerHTML(post, url) {
  const title = post.title || 'Lindy\'s Five';
  const description = post.metaDescription || post.excerpt || 'Buffalo Sabres and Bills coverage';
  const image = post.ogImage || 'https://lindysfive.com/og-default.png';
  const siteName = 'Lindy\'s Five';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} | ${siteName}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:image" content="${image}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">

  <!-- Redirect regular browsers to the SPA -->
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>Redirecting to <a href="${url}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;
}

// Escape HTML special characters
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // Only process /blog/:team/:slug paths
  const blogMatch = pathname.match(/^\/blog\/(sabres|bills)\/([^/]+)$/);
  if (!blogMatch) {
    return NextResponse.next();
  }

  // Only intercept social media crawlers
  if (!isSocialCrawler(userAgent)) {
    return NextResponse.next();
  }

  const [, team, slug] = blogMatch;

  try {
    // Fetch post from KV
    const postId = await kv.get(`blog:slug:${slug}`);
    if (!postId) {
      return NextResponse.next();
    }

    const post = await kv.get(`blog:post:${postId}`);
    if (!post || post.status !== 'published') {
      return NextResponse.next();
    }

    // Generate HTML with meta tags
    const url = `https://lindysfive.com/blog/${team}/${slug}`;
    const html = generateCrawlerHTML(post, url);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, let the request pass through normally
    return NextResponse.next();
  }
}

// Only run middleware on blog post paths
export const config = {
  matcher: '/blog/:team/:slug*',
};
