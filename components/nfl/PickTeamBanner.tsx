'use client';

// Slim, dismissible discovery strip for Pick the {Team}, shown on same-market
// tracker pages until the visitor either dismisses it or tries a pick page
// (pick pages set `pickthe-visited`). Deliberately a strip, not a modal — it
// must never stack with the newsletter popup.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { NFL_TEAMS } from '@/lib/teamConfig/nflTeams';
import { trackClick } from '@/lib/analytics';

export default function PickTeamBanner({ teamIds }: { teamIds: string[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('pickthe-banner-dismissed') === '1') return;
      if (localStorage.getItem('pickthe-visited') === '1') return;
      setVisible(true);
    } catch {
      /* storage unavailable: stay hidden */
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('pickthe-banner-dismissed', '1');
    } catch { /* ignore */ }
  };

  const teams = teamIds.map((id) => NFL_TEAMS[id]).filter(Boolean);
  if (!visible || teams.length === 0) return null;
  const lead = teams[0];

  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm"
      style={{ backgroundColor: `${lead.colors.primary}0d`, borderColor: `${lead.colors.primary}33` }}
    >
      <span aria-hidden className="flex-shrink-0">🏈</span>
      <p className="min-w-0 flex-1 text-gray-700">
        <span className="font-bold">New:</span>{' '}
        {teams.map((t, i) => (
          <span key={t.id}>
            {i > 0 && ' · '}
            <Link
              href={`/pick-the-${t.pickSlug}`}
              onClick={() => {
                trackClick(`pick-the-${t.pickSlug}`, 'nhl-tracker-banner');
                dismiss();
              }}
              className="font-bold underline hover:opacity-80"
              style={{ color: t.colors.primary }}
            >
              Pick the {t.name}
            </Link>
          </span>
        ))}
        {' '}— predict every game of the 2026 season and track your accuracy.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
