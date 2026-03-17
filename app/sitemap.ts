import type { MetadataRoute } from 'next';
import { kv } from '@vercel/kv';

const TEAM_ROUTES = [
  'sabres', 'canadiens', 'redwings', 'senators', 'panthers', 'mapleleafs',
  'lightning', 'bruins', 'devils', 'penguins', 'hurricanes', 'capitals',
  'islanders', 'flyers', 'bluejackets', 'rangers', 'utah', 'avalanche',
  'jets', 'stars', 'blackhawks', 'predators', 'wild', 'blues',
  'goldenknights', 'oilers', 'canucks', 'flames', 'kings', 'ducks',
  'sharks', 'kraken',
];

const BASE_URL = 'https://www.lindysfive.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const urls: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/nhl-playoff-odds`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/playoffs`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/scores`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];

  // All 32 team tracker routes
  for (const team of TEAM_ROUTES) {
    urls.push({
      url: `${BASE_URL}/${team}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  // Blog pages
  urls.push(
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog/sabres`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog/bills`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  );

  // Dynamic blog posts from KV
  try {
    const postIds = (await kv.zrange('blog:posts', 0, -1, { rev: true })) || [];

    for (const id of postIds) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const post: any = await kv.get(`blog:post:${id}`);
      if (post && post.status === 'published') {
        const lastModified = post.updatedAt
          ? new Date(post.updatedAt)
          : post.publishedAt
            ? new Date(post.publishedAt)
            : now;

        urls.push({
          url: `${BASE_URL}/blog/${post.team}/${post.slug}`,
          lastModified,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch (error) {
    console.error('KV error fetching posts for sitemap:', error);
  }

  return urls;
}
