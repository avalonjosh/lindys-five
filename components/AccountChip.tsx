'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, UserRound } from 'lucide-react';
import { useCurrentUser } from '@/components/perfectseason/useCurrentUser';
import { logout } from '@/lib/perfectseason/account';

/**
 * Account entry for the dark site headers (home, account page, NHL and MLB
 * hubs). Signed in: the username's initial, which opens a small menu (My
 * Account, Sign out). Signed out: "Sign in", which goes to /account.
 */
export default function AccountChip() {
  const { user, loading, setUser } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (loading) return <span className="inline-block h-8 w-8" aria-hidden />;
  if (!user) {
    return (
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.username}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none text-white transition-colors hover:bg-white/25"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        {user.username.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl">
          <div className="truncate border-b border-slate-700 px-3 py-2 text-xs text-slate-400">
            Signed in as <span className="font-bold text-white">{user.username}</span>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            <UserRound className="h-4 w-4" aria-hidden /> My Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              setUser(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
