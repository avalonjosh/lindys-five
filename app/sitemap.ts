import type { MetadataRoute } from 'next';
import { kv } from '@vercel/kv';
import { NFL_TEAMS } from '@/lib/teamConfig/nflTeams';

const NHL_TEAM_ROUTES = [
  'sabres', 'canadiens', 'redwings', 'senators', 'panthers', 'mapleleafs',
  'lightning', 'bruins', 'devils', 'penguins', 'hurricanes', 'capitals',
  'islanders', 'flyers', 'bluejackets', 'rangers', 'utah', 'avalanche',
  'jets', 'stars', 'blackhawks', 'predators', 'wild', 'blues',
  'goldenknights', 'oilers', 'canucks', 'flames', 'kings', 'ducks',
  'sharks', 'kraken',
];

const MLB_TEAM_ROUTES = [
  'diamondbacks', 'braves', 'orioles', 'redsox', 'cubs', 'whitesox',
  'reds', 'guardians', 'rockies', 'tigers', 'astros', 'royals',
  'angels', 'dodgers', 'marlins', 'brewers', 'twins', 'mets',
  'yankees', 'athletics', 'phillies', 'pirates', 'padres', 'giants',
  'mariners', 'cardinals', 'rays', 'txrangers', 'bluejays', 'nationals',
];

const BASE_URL = 'https://www.lindysfive.com';

// Static URLs carry no lastModified: a build-time timestamp on every URL is
// noise Google learns to ignore. Only blog posts have a real modified date.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const urls: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/nhl-playoff-odds`,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/playoffs`,
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/how-playoff-odds-work`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/nhl/scores`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/nhl`,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/mlb`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/mlb/playoff-odds`,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${BASE_URL}/mlb/scores`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/nhl/sabres/history`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/82-0`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/82-0/leaderboard`,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/162-0`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/162-0/leaderboard`,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ];

  // All 32 NHL team tracker routes + gear/tickets hubs
  for (const team of NHL_TEAM_ROUTES) {
    urls.push({ url: `${BASE_URL}/nhl/${team}`, changeFrequency: 'daily', priority: 0.9 });
    urls.push({ url: `${BASE_URL}/nhl/${team}/gear`, changeFrequency: 'weekly', priority: 0.5 });
    urls.push({ url: `${BASE_URL}/nhl/${team}/tickets`, changeFrequency: 'weekly', priority: 0.5 });
  }

  // All 30 MLB team tracker routes + gear/tickets hubs
  for (const team of MLB_TEAM_ROUTES) {
    urls.push({ url: `${BASE_URL}/mlb/${team}`, changeFrequency: 'daily', priority: 0.85 });
    urls.push({ url: `${BASE_URL}/mlb/${team}/gear`, changeFrequency: 'weekly', priority: 0.5 });
    urls.push({ url: `${BASE_URL}/mlb/${team}/tickets`, changeFrequency: 'weekly', priority: 0.5 });
  }

  // All 32 NFL Pick the {Team} pages (Bills boosted — the flagship)
  for (const team of Object.values(NFL_TEAMS)) {
    urls.push({
      url: `${BASE_URL}/pick-the-${team.pickSlug}`,
      changeFrequency: 'weekly',
      priority: team.id === 'bills' ? 0.8 : 0.7,
    });
  }

  // Blog pages
  urls.push(
    {
      url: `${BASE_URL}/blog`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog/sabres`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog/bills`,
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
      // Auto game/set recaps are noindexed on the post page; keep them out here too.
      if (post && post.status === 'published' && post.type !== 'game-recap' && post.type !== 'set-recap') {
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
