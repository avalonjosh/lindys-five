'use client';

import { useEffect, useState } from 'react';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';
import { readFavorites, onFavoritesChange } from '@/lib/favorites';
import InlineEmailCapture from '@/components/newsletter/InlineEmailCapture';
import NewsletterSignup from '@/components/newsletter/NewsletterSignup';

/** Team recap signup when a favorite is set, general list otherwise; hidden once subscribed on this browser. */
export default function HomeEmailSignup() {
  const [state, setState] = useState<{ subscribed: boolean; favorite: string | null } | null>(null);

  useEffect(() => {
    const read = (list: string[]) => {
      let subscribed = false;
      try {
        subscribed = localStorage.getItem('newsletter-subscribed') === '1';
      } catch {
        /* storage unavailable */
      }
      setState({ subscribed, favorite: list.find((s) => s in NHL_TEAMS || s in MLB_TEAMS) ?? null });
    };
    read(readFavorites());
    return onFavoritesChange(read);
  }, []);

  if (!state || state.subscribed) return null;

  const team = state.favorite ? NHL_TEAMS[state.favorite] ?? MLB_TEAMS[state.favorite] : null;
  if (!team) {
    return (
      <InlineEmailCapture
        source="home"
        theme="dark"
        heading="Get your team's playoff updates"
        subtext="Playoff odds, new puzzles, and leaderboards. No spam, unsubscribe anytime."
      />
    );
  }

  return (
    <NewsletterSignup
      key={team.id}
      teams={[team.id]}
      variant="compact"
      source="home"
      teamDisplayName={team.name}
      primaryColor={team.colors.primary}
      accentColor={team.colors.accent === team.colors.primary ? '#FFFFFF' : team.colors.accent}
    />
  );
}
