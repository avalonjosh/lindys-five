'use client';

import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { useCurrentUser } from '@/components/perfectseason/useCurrentUser';

/**
 * Account entry for the dark site headers (home, NHL and MLB hubs): the
 * username's initial when signed in, "Sign in" when not. Both go to /account.
 */
export default function AccountChip() {
  const { user, loading } = useCurrentUser();
  if (loading) return <span className="inline-block h-8 w-8" aria-hidden />;
  return user ? (
    <Link
      href="/account"
      title={`My Account · ${user.username}`}
      aria-label="My Account"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none text-white transition-colors hover:bg-white/25"
      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
    >
      {user.username.charAt(0).toUpperCase()}
    </Link>
  ) : (
    <Link
      href="/account"
      aria-label="Sign in"
      className="flex h-8 min-w-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/15 px-2 text-xs font-bold text-white transition-colors hover:bg-white/25 sm:px-3"
    >
      <UserRound className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sign in</span>
    </Link>
  );
}
