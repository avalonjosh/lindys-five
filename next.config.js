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
  // lib/utils/ogImage.tsx renders card images inside Node serverless
  // functions (crons, admin routes). Two things the tracer misses on its own:
  // the brand fonts read from disk, and Next's compiled copy of @vercel/og,
  // whose Node build (index.node.js + wasm) is not traced into API routes
  // and throws ERR_MODULE_NOT_FOUND at runtime without this.
  outputFileTracingIncludes: {
    '/api/**/*': [
      './assets/fonts/*.ttf',
      './node_modules/next/dist/compiled/@vercel/og/**/*',
    ],
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
      // The internal NFL pick route (rewrite target of /pick-the-:team) should
      // never be a second live URL for the same page.
      {
        source: '/nfl/pick/:team',
        destination: '/pick-the-:team',
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
