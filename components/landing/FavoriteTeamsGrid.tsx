'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TEAMS } from '@/lib/teamConfig';

const teamGradients: Record<string, { from: string; to: string; border: string; accent: string }> = {
  sabres: { from: '#002654', to: '#001a3d', border: '#FCB514', accent: '#FCB514' },
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

const bgTeamIds = ['lightning'];

// All 32 teams in alphabetical order by city
const allTeamIds = [
  'ducks', 'bruins', 'sabres', 'flames', 'hurricanes', 'blackhawks', 'bluejackets',
  'avalanche', 'stars', 'redwings', 'oilers', 'panthers', 'kings',
  'wild', 'canadiens', 'predators', 'devils', 'islanders', 'rangers',
  'senators', 'flyers', 'penguins', 'sharks', 'kraken', 'blues',
  'lightning', 'mapleleafs', 'utah', 'canucks', 'goldenknights', 'capitals', 'jets',
];

function FeaturedCard({ teamId }: { teamId: string }) {
  const team = TEAMS[teamId];
  const g = teamGradients[teamId];
  if (!team || !g) return null;

  const useBg = bgTeamIds.includes(teamId);

  return (
    <Link
      href={`/${teamId}`}
      className="group relative rounded-2xl p-12 shadow-2xl border-4 transition-all duration-300 hover:scale-105 w-full max-w-md"
      style={{
        background: `linear-gradient(to bottom right, ${g.from}, ${g.to})`,
        borderColor: g.border,
      }}
    >
      <div className="flex flex-col items-center text-center">
        {useBg ? (
          <div className="mb-8 p-4 rounded-full bg-white">
            <Image
              src={team.logo}
              alt={`${team.city} ${team.name}`}
              width={128}
              height={128}
              className="w-32 h-32 group-hover:scale-110 transition-transform duration-300"
            />
          </div>
        ) : (
          <Image
            src={team.logo}
            alt={`${team.city} ${team.name}`}
            width={160}
            height={160}
            className="w-40 h-40 mb-8 group-hover:scale-110 transition-transform duration-300"
          />
        )}
        <h2
          className="text-4xl md:text-5xl font-bold text-white mb-3"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {team.city} {team.name}
        </h2>
        <p className="font-bold text-lg" style={{ color: g.accent }}>View →</p>
      </div>
    </Link>
  );
}

function TeamCard({ teamId }: { teamId: string }) {
  const team = TEAMS[teamId];
  const g = teamGradients[teamId];
  if (!team || !g) return null;

  const useBg = bgTeamIds.includes(teamId);

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
        {useBg ? (
          <div className="mb-6 p-4 rounded-full bg-white">
            <Image
              src={team.logo}
              alt={`${team.city} ${team.name}`}
              width={96}
              height={96}
              className="w-24 h-24 group-hover:scale-110 transition-transform duration-300"
            />
          </div>
        ) : (
          <Image
            src={team.logo}
            alt={`${team.city} ${team.name}`}
            width={128}
            height={128}
            className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
          />
        )}
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

function PlayoffOddsCTA() {
  return (
    <Link
      href="/nhl-playoff-odds"
      className="group relative rounded-2xl p-12 shadow-2xl border-4 transition-all duration-300 hover:scale-105 w-full max-w-md"
      style={{
        background: 'linear-gradient(to bottom right, #003087, #0A1128)',
        borderColor: '#ffffff',
      }}
    >
      <div className="flex flex-col items-center text-center">
        <Image
          src="https://assets.nhle.com/logos/nhl/svg/NHL_light.svg"
          alt="NHL"
          width={160}
          height={160}
          className="w-40 h-40 mb-8 group-hover:scale-110 transition-transform duration-300"
        />
        <h2
          className="text-4xl md:text-5xl font-bold text-white mb-3"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          NHL Playoff Odds 2026
        </h2>
        <p className="font-bold text-lg text-white/70">Full standings & projections for all 32 teams →</p>
      </div>
    </Link>
  );
}

export default function FavoriteTeamsGrid() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('favorite-teams');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
    setLoaded(true);
  }, []);

  // Before localStorage is read, render default layout (matches SSR)
  if (!loaded) {
    return (
      <>
        <div className="flex justify-center mb-16">
          <PlayoffOddsCTA />
        </div>

        <h2
          className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          All Teams
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allTeamIds.map(id => <TeamCard key={id} teamId={id} />)}
        </div>
      </>
    );
  }

  const validFavorites = favorites.filter(id => TEAMS[id]);

  // No favorites: playoff odds CTA featured, all 32 teams in grid
  if (validFavorites.length === 0) {
    return (
      <>
        <div className="flex justify-center mb-16">
          <PlayoffOddsCTA />
        </div>

        <h2
          className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          All Teams
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allTeamIds.map(id => <TeamCard key={id} teamId={id} />)}
        </div>
      </>
    );
  }

  // Has favorites: show them featured at top, everyone else below
  const everyoneElse = allTeamIds.filter(id => !validFavorites.includes(id));

  return (
    <>
      {/* Your Teams - featured */}
      <h2
        className="text-3xl md:text-4xl font-bold text-yellow-400 text-center mb-8"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        Your Teams
      </h2>
      <div className={`flex justify-center gap-6 mb-16 ${validFavorites.length > 1 ? 'flex-wrap' : ''}`}>
        {validFavorites.map(id => (
          <FeaturedCard key={id} teamId={id} />
        ))}
      </div>

      {/* Everyone Else */}
      <h2
        className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        Everyone Else
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {everyoneElse.map(id => <TeamCard key={id} teamId={id} />)}
      </div>
    </>
  );
}
