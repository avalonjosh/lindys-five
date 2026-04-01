'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TEAMS } from '@/lib/teamConfig';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { getTeamUrl } from '@/lib/teamConfig';

const nhlGradients: Record<string, { from: string; to: string; border: string; accent: string }> = {
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

const mlbGradients: Record<string, { from: string; to: string; border: string; accent: string }> = {
  diamondbacks: { from: '#A71930', to: '#7d1224', border: '#E3D4AD', accent: '#E3D4AD' },
  braves: { from: '#CE1141', to: '#9c0d31', border: '#13274F', accent: '#EAAA00' },
  orioles: { from: '#DF4601', to: '#b83801', border: '#000000', accent: '#ffffff' },
  redsox: { from: '#BD3039', to: '#96262e', border: '#0C2340', accent: '#ffffff' },
  cubs: { from: '#0E3386', to: '#0a2666', border: '#CC3433', accent: '#CC3433' },
  whitesox: { from: '#27251F', to: '#131210', border: '#C4CED4', accent: '#C4CED4' },
  reds: { from: '#C6011F', to: '#9e0119', border: '#000000', accent: '#ffffff' },
  guardians: { from: '#00385D', to: '#002a46', border: '#E31937', accent: '#E31937' },
  rockies: { from: '#33006F', to: '#260054', border: '#C4CED4', accent: '#C4CED4' },
  tigers: { from: '#0C2340', to: '#081a30', border: '#FA4616', accent: '#FA4616' },
  astros: { from: '#002D62', to: '#00214a', border: '#EB6E1F', accent: '#EB6E1F' },
  royals: { from: '#004687', to: '#003366', border: '#BD9B60', accent: '#BD9B60' },
  angels: { from: '#BA0021', to: '#8e001a', border: '#003263', accent: '#ffffff' },
  dodgers: { from: '#005A9C', to: '#004478', border: '#EF3E42', accent: '#ffffff' },
  marlins: { from: '#00A3E0', to: '#007eb3', border: '#EF3340', accent: '#ffffff' },
  brewers: { from: '#12284B', to: '#0d1e38', border: '#FFC52F', accent: '#FFC52F' },
  twins: { from: '#002B5C', to: '#001f44', border: '#D31145', accent: '#D31145' },
  mets: { from: '#002D72', to: '#002157', border: '#FF5910', accent: '#FF5910' },
  yankees: { from: '#1C2841', to: '#131c2e', border: '#1C2841', accent: '#ffffff' },
  athletics: { from: '#003831', to: '#002a24', border: '#EFB21E', accent: '#EFB21E' },
  phillies: { from: '#E81828', to: '#b81320', border: '#002D72', accent: '#ffffff' },
  pirates: { from: '#27251F', to: '#131210', border: '#FDB827', accent: '#FDB827' },
  padres: { from: '#2F241D', to: '#1f1812', border: '#FFC425', accent: '#FFC425' },
  giants: { from: '#27251F', to: '#131210', border: '#FD5A1E', accent: '#FD5A1E' },
  mariners: { from: '#0C2C56', to: '#082140', border: '#005C5C', accent: '#005C5C' },
  cardinals: { from: '#C41E3A', to: '#9a182e', border: '#0C2340', accent: '#ffffff' },
  rays: { from: '#092C5C', to: '#062044', border: '#8FBCE6', accent: '#8FBCE6' },
  txrangers: { from: '#003278', to: '#00255c', border: '#C0111F', accent: '#C0111F' },
  bluejays: { from: '#134A8E', to: '#0e386b', border: '#E8291C', accent: '#E8291C' },
  nationals: { from: '#AB0003', to: '#820002', border: '#14225A', accent: '#ffffff' },
};

const bgTeamIds = ['lightning', 'orioles', 'reds', 'tigers', 'royals', 'dodgers', 'twins', 'athletics', 'padres', 'cardinals', 'nationals'];

const nhlTeamIds = [
  'ducks', 'bruins', 'sabres', 'flames', 'hurricanes', 'blackhawks', 'bluejackets',
  'avalanche', 'stars', 'redwings', 'oilers', 'panthers', 'kings',
  'wild', 'canadiens', 'predators', 'devils', 'islanders', 'rangers',
  'senators', 'flyers', 'penguins', 'sharks', 'kraken', 'blues',
  'lightning', 'mapleleafs', 'utah', 'canucks', 'goldenknights', 'capitals', 'jets',
];

const mlbTeamIds = [
  'diamondbacks', 'braves', 'orioles', 'redsox', 'cubs', 'whitesox',
  'reds', 'guardians', 'rockies', 'tigers', 'astros', 'royals',
  'angels', 'dodgers', 'marlins', 'brewers', 'twins', 'mets',
  'yankees', 'athletics', 'phillies', 'pirates', 'padres', 'giants',
  'mariners', 'cardinals', 'rays', 'txrangers', 'bluejays', 'nationals',
];

function getTeamData(teamId: string) {
  const nhlTeam = TEAMS[teamId];
  if (nhlTeam) return { name: `${nhlTeam.city} ${nhlTeam.name}`, logo: nhlTeam.logo, headerLogo: undefined };
  const mlbTeam = MLB_TEAMS[teamId];
  if (mlbTeam) return { name: `${mlbTeam.city} ${mlbTeam.name}`, logo: mlbTeam.logo, headerLogo: mlbTeam.headerLogo };
  return null;
}

function getGradient(teamId: string) {
  return nhlGradients[teamId] || mlbGradients[teamId] || null;
}

function FeaturedCard({ teamId }: { teamId: string }) {
  const team = getTeamData(teamId);
  const g = getGradient(teamId);
  if (!team || !g) return null;
  const useBg = bgTeamIds.includes(teamId);
  const displayLogo = team.headerLogo || team.logo;

  return (
    <Link
      href={getTeamUrl(teamId)}
      className="group relative rounded-2xl p-12 shadow-2xl border-4 transition-all duration-300 hover:scale-105 w-full max-w-md"
      style={{ background: `linear-gradient(to bottom right, ${g.from}, ${g.to})`, borderColor: g.border }}
    >
      <div className="flex flex-col items-center text-center">
        {useBg ? (
          <div className="mb-8 p-4 rounded-full bg-white">
            <Image src={team.logo} alt={team.name} width={128} height={128} className="w-32 h-32 group-hover:scale-110 transition-transform duration-300" />
          </div>
        ) : (
          <Image src={displayLogo} alt={team.name} width={160} height={160} className="w-40 h-40 mb-8 group-hover:scale-110 transition-transform duration-300" />
        )}
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{team.name}</h2>
        <p className="font-bold text-lg" style={{ color: g.accent }}>View →</p>
      </div>
    </Link>
  );
}

function TeamCard({ teamId }: { teamId: string }) {
  const team = getTeamData(teamId);
  const g = getGradient(teamId);
  if (!team || !g) return null;
  const useBg = bgTeamIds.includes(teamId);
  const displayLogo = team.headerLogo || team.logo;

  return (
    <Link
      href={getTeamUrl(teamId)}
      className="group relative rounded-2xl p-8 shadow-2xl border-2 transition-all duration-300 hover:scale-105"
      style={{ background: `linear-gradient(to bottom right, ${g.from}, ${g.to})`, borderColor: g.border }}
    >
      <div className="flex flex-col items-center text-center">
        {useBg ? (
          <div className="mb-6 p-4 rounded-full bg-white">
            <Image src={team.logo} alt={team.name} width={96} height={96} className="w-24 h-24 group-hover:scale-110 transition-transform duration-300" />
          </div>
        ) : (
          <Image src={displayLogo} alt={team.name} width={128} height={128} className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300" />
        )}
        <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{team.name}</h2>
        <p className="font-semibold" style={{ color: g.accent }}>View →</p>
      </div>
    </Link>
  );
}

function PlayoffOddsCTA() {
  return (
    <Link
      href="/nhl-playoff-odds"
      className="group relative rounded-2xl px-8 py-8 md:px-12 shadow-2xl border-4 transition-all duration-300 hover:scale-105 w-full max-w-md md:max-w-2xl"
      style={{ background: 'linear-gradient(to bottom right, #003087, #0A1128)', borderColor: '#ffffff' }}
    >
      <div className="flex flex-col items-center text-center md:flex-row md:text-left md:items-center gap-6 md:gap-8">
        <Image src="https://assets.nhle.com/logos/nhl/svg/NHL_light.svg" alt="NHL" width={120} height={120} className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
        <div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>NHL Playoff Odds 2025-26</h2>
          <p className="font-bold text-base md:text-lg text-white/70">Full standings & projections for all 32 teams →</p>
        </div>
      </div>
    </Link>
  );
}

interface FavoriteTeamsGridProps {
  sport: 'nhl' | 'mlb';
}

export default function FavoriteTeamsGrid({ sport }: FavoriteTeamsGridProps) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('favorite-teams');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setFavorites(parsed);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const allTeamIds = sport === 'nhl' ? nhlTeamIds : mlbTeamIds;
  const teamLookup = sport === 'nhl' ? TEAMS : MLB_TEAMS;
  const validFavorites = favorites.filter(id => teamLookup[id]);

  if (!loaded) {
    return (
      <>
        {sport === 'nhl' && (
          <div className="flex justify-center mb-16">
            <PlayoffOddsCTA />
          </div>
        )}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>All Teams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allTeamIds.map(id => <TeamCard key={id} teamId={id} />)}
        </div>
      </>
    );
  }

  if (validFavorites.length === 0) {
    return (
      <>
        {sport === 'nhl' && (
          <div className="flex justify-center mb-16">
            <PlayoffOddsCTA />
          </div>
        )}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>All Teams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {allTeamIds.map(id => <TeamCard key={id} teamId={id} />)}
        </div>
      </>
    );
  }

  const everyoneElse = allTeamIds.filter(id => !validFavorites.includes(id));

  return (
    <>
      <h2 className="text-3xl md:text-4xl font-bold text-yellow-400 text-center mb-8" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Your Teams</h2>
      <div className={`flex justify-center gap-6 mb-16 ${validFavorites.length > 1 ? 'flex-wrap' : ''}`}>
        {validFavorites.map(id => <FeaturedCard key={id} teamId={id} />)}
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Everyone Else</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {everyoneElse.map(id => <TeamCard key={id} teamId={id} />)}
      </div>
    </>
  );
}
