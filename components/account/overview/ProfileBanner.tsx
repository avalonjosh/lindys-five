'use client';

import Link from 'next/link';
import type { MLBTeamConfig, NFLTeamConfig, TeamConfig } from '@/lib/teamConfig';
import { cardColors, logoFor } from '@/components/home/YourTeamCard';

export interface BannerTile {
  value: string;
  label: string;
  highlight?: boolean;
  /** Makes the tile a link (the main team's odds go to its tracker). */
  href?: string;
}

/** Top of the profile: the main team's colors, the username, and a row of headline numbers. */
export default function ProfileBanner({
  username,
  createdAt,
  team,
  tiles,
}: {
  username: string;
  createdAt?: string;
  team?: TeamConfig | MLBTeamConfig | NFLTeamConfig;
  tiles: BannerTile[];
}) {
  const { bg, accent } = team ? cardColors(team.colors) : { bg: '#003087', accent: '#FFB81C' };
  const since = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const eyebrow = team
    ? `${team.city} ${team.name} fan${since ? ` · since ${since}` : ''}`
    : since ? `Member since ${since}` : 'My account';

  return (
    <div className="border-b-2" style={{ background: bg, borderColor: accent }}>
      <div className="relative mx-auto max-w-6xl overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        {team && (
          <img src={logoFor(team)} alt="" aria-hidden className="pointer-events-none absolute -right-12 -top-10 h-64 w-64 object-contain opacity-10 sm:h-80 sm:w-80" />
        )}
        <div className="relative flex flex-col gap-5">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold uppercase tracking-wider sm:text-xs" style={{ color: accent }}>{eyebrow}</div>
            <h1 className="truncate text-5xl leading-none text-white sm:text-6xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{username}</h1>
          </div>
          {tiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {tiles.slice(0, 5).map((t, i) => {
                const className = `min-w-0 rounded-xl bg-black/25 p-3 ${i > 2 ? 'hidden sm:block' : ''}`;
                const body = (
                  <>
                    <div className="truncate text-4xl leading-none sm:text-5xl" style={{ fontFamily: 'Bebas Neue, sans-serif', color: t.highlight ? accent : '#FFFFFF' }}>
                      {t.value}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-100">{t.label}{t.href && ' →'}</div>
                  </>
                );
                return t.href ? (
                  <Link key={t.label} href={t.href} className={`${className} transition-colors hover:bg-black/40`}>{body}</Link>
                ) : (
                  <div key={t.label} className={className}>{body}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
