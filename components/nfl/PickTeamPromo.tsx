'use client';

import Link from 'next/link';
import { NFL_TEAMS } from '@/lib/teamConfig/nflTeams';
import { trackClick } from '@/lib/analytics';

/** "Pick the {NFL Team}" cross-promo card for same-market tracker pages.
 *  Mirrors GamePromo's card; two-team markets (NY, LA) get a button each. */
export default function PickTeamPromo({ teamIds, className }: { teamIds: string[]; className?: string }) {
  const teams = teamIds.map((id) => NFL_TEAMS[id]).filter(Boolean);
  if (teams.length === 0) return null;
  const lead = teams[0];

  return (
    <div
      className={`rounded-2xl border-2 bg-white p-5 text-center shadow-sm ${className ?? ''}`}
      style={{ borderColor: `${lead.colors.primary}33` }}
    >
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: lead.colors.primary }}>
        Lindy&apos;s Five NFL
      </p>
      <div className="mt-2 flex items-center justify-center gap-3">
        {teams.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.id} src={t.logo} alt={`${t.city} ${t.name} logo`} className="h-10 w-10 object-contain" />
        ))}
      </div>
      <h3 className="mt-1 text-xl font-bold text-gray-900" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        {teams.length === 1 ? `Pick the ${teams[0].name}` : 'Pick your NFL team'}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        Predict every game of the 2026 NFL season, save your picks, and see how accurate you were as the results roll in.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {teams.map((t) => (
          <Link
            key={t.id}
            href={`/pick-the-${t.pickSlug}`}
            onClick={() => trackClick(`pick-the-${t.pickSlug}`, 'nhl-tracker-promo')}
            className="inline-block rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: t.colors.primary }}
          >
            Pick the {t.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
