'use client';

// Frosted account entry for the team-colored tracker headers (NHL/MLB/NFL).
// Monogram when signed in, person icon when signed out; /account handles both.

import Link from 'next/link';
import { UserRound } from 'lucide-react';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';

interface HeaderProfileIconProps {
  user: PublicUser | null;
  /** For white-ish headers (e.g. Lightning/Penguins dark mode): renders a faint
   * chip in this color instead of the default frosted-white tint. */
  darkTint?: string;
}

export default function HeaderProfileIcon({ user, darkTint }: HeaderProfileIconProps) {
  return (
    <Link
      href="/account"
      title={user ? `My Account · ${user.username}` : 'Sign in to save picks'}
      aria-label="My Account"
      className="flex h-6 w-6 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-75"
      style={
        darkTint
          ? { backgroundColor: `${darkTint}18`, color: darkTint }
          : { backgroundColor: 'rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.85)' }
      }
    >
      {user ? (
        <span className="text-sm md:text-lg font-bold leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {user.username.charAt(0).toUpperCase()}
        </span>
      ) : (
        <UserRound className="h-3.5 w-3.5 md:h-4 md:w-4" />
      )}
    </Link>
  );
}
