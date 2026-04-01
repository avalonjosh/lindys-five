'use client';

import { useState, useEffect } from 'react';
import type { MLBPitcherPreview } from '@/lib/types/mlb';
import { fetchPitcherStats } from '@/lib/services/mlbApi';

interface Props {
  awayPitcherId?: number;
  homePitcherId?: number;
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogo: string;
  homeLogo: string;
}

function PitcherCard({ pitcher, teamAbbrev, teamLogo, label }: {
  pitcher: MLBPitcherPreview | null;
  teamAbbrev: string;
  teamLogo: string;
  label: string;
}) {
  return (
    <div className="flex-1 text-center">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{label}</div>
      {pitcher ? (
        <>
          <img
            src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcher.id}/headshot/67/current`}
            alt={pitcher.name}
            className="w-20 h-20 rounded-full mx-auto mb-2 object-cover bg-gray-100"
          />
          <div className="text-sm font-bold text-gray-900 mb-1">{pitcher.name}</div>
          <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {pitcher.era} ERA
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {pitcher.wins}-{pitcher.losses} &bull; {pitcher.ip} IP &bull; {pitcher.so} SO
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {pitcher.whip} WHIP
          </div>
        </>
      ) : (
        <>
          <img src={teamLogo} alt={teamAbbrev} className="w-16 h-16 mx-auto mb-2 opacity-40" />
          <div className="text-sm text-gray-400">TBD</div>
        </>
      )}
    </div>
  );
}

export default function MLBProbablePitchers({ awayPitcherId, homePitcherId, awayAbbrev, homeAbbrev, awayLogo, homeLogo }: Props) {
  const [awayPitcher, setAwayPitcher] = useState<MLBPitcherPreview | null>(null);
  const [homePitcher, setHomePitcher] = useState<MLBPitcherPreview | null>(null);

  useEffect(() => {
    const season = new Date().getFullYear();
    if (awayPitcherId) fetchPitcherStats(awayPitcherId, season).then(setAwayPitcher);
    if (homePitcherId) fetchPitcherStats(homePitcherId, season).then(setHomePitcher);
  }, [awayPitcherId, homePitcherId]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 md:p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Probable Pitchers</h3>
      <div className="flex items-start gap-4">
        <PitcherCard pitcher={awayPitcher} teamAbbrev={awayAbbrev} teamLogo={awayLogo} label={awayAbbrev} />
        <div className="text-xl font-light text-gray-300 pt-8">vs</div>
        <PitcherCard pitcher={homePitcher} teamAbbrev={homeAbbrev} teamLogo={homeLogo} label={homeAbbrev} />
      </div>
    </div>
  );
}
