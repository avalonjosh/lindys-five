import { getPublishedPosts } from '@/lib/kv';

export async function GET() {
  const posts = await getPublishedPosts();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lindy's Five - NHL Playoff Tracker Blog</title>
    <link>https://www.lindysfive.com/blog/sabres</link>
    <description>NHL playoff odds, game recaps, set analysis, and projections for all 32 teams.</description>
    <language>en-us</language>
    <atom:link href="https://www.lindysfive.com/feed.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>https://www.lindysfive.com/blog/${post.team}/${post.slug}</link>
      <description><![CDATA[${post.metaDescription || post.excerpt || ''}]]></description>
      <pubDate>${new Date(post.publishedAt || post.createdAt).toUTCString()}</pubDate>
      <guid isPermaLink="true">https://www.lindysfive.com/blog/${post.team}/${post.slug}</guid>
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
