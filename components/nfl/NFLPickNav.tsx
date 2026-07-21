'use client';

// Lean hamburger nav between the 32 Pick the {Team} pages, grouped by division.
// Deliberately lighter than TeamNav/MLBTeamNav (no standings, no tabs).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NFL_TEAMS } from '@/lib/teamConfig/nflTeams';

const NFL_DIVISIONS: Record<string, string[]> = {
  'AFC East': ['bills', 'dolphins', 'patriots', 'nyjets'],
  'AFC North': ['ravens', 'bengals', 'browns', 'steelers'],
  'AFC South': ['texans', 'colts', 'jaguars', 'titans'],
  'AFC West': ['broncos', 'chiefs', 'raiders', 'chargers'],
  'NFC East': ['cowboys', 'nygiants', 'eagles', 'commanders'],
  'NFC North': ['bears', 'lions', 'packers', 'vikings'],
  'NFC South': ['falcons', 'carpanthers', 'saints', 'buccaneers'],
  'NFC West': ['azcardinals', 'rams', '49ers', 'seahawks'],
};

interface NFLPickNavProps {
  currentTeamId: string;
}

export default function NFLPickNav({ currentTeamId }: NFLPickNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch NFL team"
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-11 z-50 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 text-left shadow-2xl">
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Pick the …
          </div>
          {Object.entries(NFL_DIVISIONS).map(([division, ids]) => (
            <div key={division}>
              <div className="px-2 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {division}
              </div>
              {ids.map((id) => {
                const team = NFL_TEAMS[id];
                if (!team) return null;
                const active = id === currentTeamId;
                return (
                  <Link
                    key={id}
                    href={`/pick-the-${team.pickSlug}`}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      active ? 'font-bold text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: `${team.colors.primary}14` } : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={team.logo} alt="" className="h-5 w-5 object-contain" />
                    {team.city} {team.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
