import type { Metadata } from 'next';
import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';

export const metadata: Metadata = {
  title: "Lindy's Five - Track Your Team's Road to the Playoffs",
  description:
    "Track your NHL team's playoff race with 5-game set analysis. Live standings, projections, and insights for all 32 teams. Target: 6+ points per set.",
  openGraph: {
    title: "Lindy's Five - Track Your Team's Road to the Playoffs",
    description:
      "Track your NHL team's playoff race with 5-game set analysis. Live standings, projections, and insights for all 32 teams.",
    type: 'website',
    url: 'https://lindysfive.com/',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Lindy's Five - Track Your Team's Road to the Playoffs",
    description:
      "Track your NHL team's playoff race with 5-game set analysis. Live standings, projections, and insights for all 32 teams.",
  },
  alternates: {
    canonical: 'https://lindysfive.com/',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: "Lindy's Five",
      description:
        "Track your NHL team's playoff race with 5-game set analysis",
      url: 'https://lindysfive.com',
      publisher: {
        '@type': 'Organization',
        name: 'JRR Apps',
      },
    }),
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: "Lindy's Five",
            description:
              "Track your NHL team's playoff race with 5-game set analysis",
            url: 'https://lindysfive.com',
            publisher: {
              '@type': 'Organization',
              name: 'JRR Apps',
            },
          }),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-5xl md:text-7xl font-bold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-2">
              Track Your Team&apos;s Road to the Playoffs
            </p>
            <p className="text-sm md:text-base text-gray-400">
              5-Game Set Analysis &bull; Target: 6+ points per set
            </p>
          </div>

          {/* Buffalo Sabres - Featured */}
          <div className="flex justify-center mb-16">
            <Link
              href="/sabres"
              className="group relative bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl p-12 shadow-2xl border-4 border-[#FCB514] hover:border-[#FFD700] transition-all duration-300 hover:scale-105 hover:shadow-[#FCB514]/50 w-full max-w-md"
            >
              <div className="flex flex-col items-center text-center">
                <img
                  src={TEAMS.sabres.logo}
                  alt="Buffalo Sabres"
                  className="w-40 h-40 mb-8 group-hover:scale-110 transition-transform duration-300"
                />
                <h2
                  className="text-4xl md:text-5xl font-bold text-white mb-3"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  {TEAMS.sabres.city} {TEAMS.sabres.name}
                </h2>
                <p className="text-[#FCB514] font-bold text-lg">View →</p>
              </div>
            </Link>
          </div>

          {/* Everyone Else Section */}
          <div className="mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Everyone Else
            </h2>

            {/* All teams alphabetically by city */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <TeamCard teamId="ducks" />
              <TeamCard teamId="bruins" />
              <TeamCard teamId="flames" />
              <TeamCard teamId="hurricanes" />
              <TeamCard teamId="blackhawks" />
              <TeamCard teamId="bluejackets" />
              <TeamCard teamId="avalanche" />
              <TeamCard teamId="stars" />
              <TeamCard teamId="redwings" />
              <TeamCard teamId="oilers" />
              <TeamCard teamId="panthers" />
              <TeamCard teamId="kings" />
              <TeamCard teamId="wild" />
              <TeamCard teamId="canadiens" />
              <TeamCard teamId="predators" />
              <TeamCard teamId="devils" />
              <TeamCard teamId="islanders" />
              <TeamCard teamId="rangers" />
              <TeamCard teamId="senators" />
              <TeamCard teamId="flyers" />
              <TeamCard teamId="penguins" />
              <TeamCard teamId="sharks" />
              <TeamCard teamId="kraken" />
              <TeamCard teamId="blues" />
              <TeamCardWithBg teamId="lightning" />
              <TeamCard teamId="mapleleafs" />
              <TeamCard teamId="utah" />
              <TeamCard teamId="canucks" />
              <TeamCard teamId="goldenknights" />
              <TeamCard teamId="capitals" />
              <TeamCard teamId="jets" />
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-gray-400 text-sm">
            <p>&copy; {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
          </div>
        </div>
      </div>
    </>
  );
}

// Team card gradient mappings for the landing page
const teamGradients: Record<string, { from: string; to: string; border: string; accent: string }> = {
  ducks: { from: '#F47A38', to: '#d66530', border: '#B9975B', accent: '#B9975B' },
  bruins: { from: '#000000', to: '#1a1a1a', border: '#FFB81C', accent: '#FFB81C' },
  flames: { from: '#C8102E', to: '#9c0d24', border: '#F1BE48', accent: '#F1BE48' },
  hurricanes: { from: '#CE1126', to: '#a00e1e', border: '#000000', accent: '#ffffff' },
  blackhawks: { from: '#CF0A2C', to: '#a00822', border: '#000000', accent: '#ffffff' },
  bluejackets: { from: '#002654', to: '#001b3d', border: '#CE1126', accent: '#CE1126' },
  avalanche: { from: '#6F263D', to: '#561d30', border: '#236192', accent: '#236192' },
  stars: { from: '#006847', to: '#004d35', border: '#8F8F8C', accent: '#8F8F8C' },
  redwings: { from: '#CE1126', to: '#a00e1e', border: '#ffffff', accent: '#ffffff' },
  oilers: { from: '#041E42', to: '#02152e', border: '#FF4C00', accent: '#FF4C00' },
  panthers: { from: '#C8102E', to: '#9c0d24', border: '#B9975B', accent: '#B9975B' },
  kings: { from: '#111111', to: '#000000', border: '#A2AAAD', accent: '#A2AAAD' },
  wild: { from: '#154734', to: '#0f3526', border: '#A6192E', accent: '#A6192E' },
  canadiens: { from: '#AF1E2D', to: '#8a1824', border: '#192168', accent: '#ffffff' },
  predators: { from: '#FFB81C', to: '#d99915', border: '#041E42', accent: '#041E42' },
  devils: { from: '#CE1126', to: '#a00e1e', border: '#000000', accent: '#ffffff' },
  islanders: { from: '#00539B', to: '#003d75', border: '#F47D30', accent: '#F47D30' },
  rangers: { from: '#0038A8', to: '#002a7f', border: '#CE1126', accent: '#CE1126' },
  senators: { from: '#C52032', to: '#9a1827', border: '#C8AA76', accent: '#C8AA76' },
  flyers: { from: '#F74902', to: '#c93a02', border: '#000000', accent: '#ffffff' },
  penguins: { from: '#000000', to: '#1a1a1a', border: '#FCB514', accent: '#FCB514' },
  sharks: { from: '#006D75', to: '#005159', border: '#EA7200', accent: '#EA7200' },
  kraken: { from: '#001628', to: '#000a14', border: '#96D8D8', accent: '#96D8D8' },
  blues: { from: '#002F87', to: '#00226b', border: '#FCB514', accent: '#FCB514' },
  lightning: { from: '#002868', to: '#001d4d', border: '#ffffff', accent: '#ffffff' },
  mapleleafs: { from: '#003E7E', to: '#002f61', border: '#ffffff', accent: '#ffffff' },
  utah: { from: '#69B3E7', to: '#4a9cd4', border: '#000000', accent: '#ffffff' },
  canucks: { from: '#00205B', to: '#001543', border: '#00843D', accent: '#00843D' },
  goldenknights: { from: '#333F42', to: '#1f2628', border: '#B4975A', accent: '#B4975A' },
  capitals: { from: '#041E42', to: '#02152e', border: '#C8102E', accent: '#C8102E' },
  jets: { from: '#041E42', to: '#02152e', border: '#AC162C', accent: '#AC162C' },
};

function TeamCard({ teamId }: { teamId: string }) {
  const team = TEAMS[teamId];
  const g = teamGradients[teamId];
  if (!team || !g) return null;

  return (
    <Link
      href={`/${teamId}`}
      className="group relative rounded-2xl p-8 shadow-2xl border-2 transition-all duration-300 hover:scale-105"
      style={{
        background: `linear-gradient(to bottom right, ${g.from}, ${g.to})`,
        borderColor: g.border,
      }}
    >
      <div className="flex flex-col items-center text-center">
        <img
          src={team.logo}
          alt={`${team.city} ${team.name}`}
          className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
        />
        <h2
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {team.city} {team.name}
        </h2>
        <p className="font-semibold" style={{ color: g.accent }}>
          View →
        </p>
      </div>
    </Link>
  );
}

function TeamCardWithBg({ teamId }: { teamId: string }) {
  const team = TEAMS[teamId];
  const g = teamGradients[teamId];
  if (!team || !g) return null;

  return (
    <Link
      href={`/${teamId}`}
      className="group relative rounded-2xl p-8 shadow-2xl border-2 transition-all duration-300 hover:scale-105"
      style={{
        background: `linear-gradient(to bottom right, ${g.from}, ${g.to})`,
        borderColor: g.border,
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 p-4 rounded-full bg-white">
          <img
            src={team.logo}
            alt={`${team.city} ${team.name}`}
            className="w-24 h-24 group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <h2
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {team.city} {team.name}
        </h2>
        <p className="font-semibold" style={{ color: g.accent }}>
          View →
        </p>
      </div>
    </Link>
  );
}
