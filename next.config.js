// NHL team slugs for 301 redirects from /{team} to /nhl/{team}
const NHL_SLUGS = [
  'sabres', 'canadiens', 'redwings', 'senators', 'panthers', 'mapleleafs',
  'lightning', 'bruins', 'devils', 'penguins', 'hurricanes', 'capitals',
  'islanders', 'flyers', 'bluejackets', 'rangers', 'utah', 'avalanche',
  'jets', 'stars', 'blackhawks', 'predators', 'wild', 'blues',
  'goldenknights', 'oilers', 'canucks', 'flames', 'kings', 'ducks',
  'sharks', 'kraken',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Brand fonts read from disk by lib/utils/ogImage.tsx at render time —
  // make sure they're bundled into every serverless function that uses it
  outputFileTracingIncludes: {
    '/api/**/*': ['./assets/fonts/*.ttf'],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/nhl-api/:path*',
      },
      // Next.js can't declare partial dynamic segments (pick-the-[team]), so
      // the pretty NFL pick URLs rewrite to an internal dynamic route.
      {
        source: '/pick-the-:team',
        destination: '/nfl/pick/:team',
      },
    ];
  },
  async redirects() {
    return [
      ...NHL_SLUGS.map((slug) => ({
        source: `/${slug}`,
        destination: `/nhl/${slug}`,
        permanent: true,
      })),
      {
        source: '/scores',
        destination: '/nhl/scores',
        permanent: true,
      },
      {
        source: '/scores/:gameId',
        destination: '/nhl/scores/:gameId',
        permanent: true,
      },
      {
        source: '/162',
        destination: '/162-0',
        permanent: true,
      },
      {
        source: '/82',
        destination: '/82-0',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.nhle.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.mlbstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'img.mlbstatic.com',
      },
    ],
  },
};

export default nextConfig;
