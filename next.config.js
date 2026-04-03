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
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/nhl-api/:path*',
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
