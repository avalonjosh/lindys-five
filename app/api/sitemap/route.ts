import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// All 32 team routes (matching main.tsx routes)
const TEAM_ROUTES = [
  'sabres', 'canadiens', 'redwings', 'senators', 'panthers', 'mapleleafs',
  'lightning', 'bruins', 'devils', 'penguins', 'hurricanes', 'capitals',
  'islanders', 'flyers', 'bluejackets', 'rangers', 'utah', 'avalanche',
  'jets', 'stars', 'blackhawks', 'predators', 'wild', 'blues',
  'goldenknights', 'oilers', 'canucks', 'flames', 'kings', 'ducks',
  'sharks', 'kraken'
];

export async function GET(_request: NextRequest) {
  try {
    const baseUrl = 'https://lindysfive.com';
    const now = new Date().toISOString().split('T')[0];

    let urlsXml = '';

    // Homepage
    urlsXml += `
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

    // All 32 team tracker routes
    for (const team of TEAM_ROUTES) {
      urlsXml += `
  <url>
    <loc>${baseUrl}/${team}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    // Blog index
    urlsXml += `
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

    // Blog team pages
    urlsXml += `
  <url>
    <loc>${baseUrl}/blog/sabres</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

    urlsXml += `
  <url>
    <loc>${baseUrl}/blog/bills</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

    // Fetch published blog posts from Vercel KV
    try {
      const postIds = await kv.zrange('blog:posts', 0, -1, { rev: true }) || [];

      for (const id of postIds) {
        const post: any = await kv.get(`blog:post:${id}`);
        if (post && post.status === 'published') {
          const lastmod = post.updatedAt
            ? new Date(post.updatedAt).toISOString().split('T')[0]
            : post.publishedAt
              ? new Date(post.publishedAt).toISOString().split('T')[0]
              : now;

          urlsXml += `
  <url>
    <loc>${baseUrl}/blog/${post.team}/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }
      }
    } catch (kvError) {
      // If KV fails, continue with static routes only
      console.error('KV error fetching posts for sitemap:', kvError);
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlsXml}
</urlset>`;

    // Set cache headers (24 hours)
    return new Response(sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 's-maxage=86400, stale-while-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return NextResponse.json({ error: 'Failed to generate sitemap' }, { status: 500 });
  }
}
