/**
 * Client-side favorite teams (the hamburger stars / home grid). One shared
 * localStorage list, plus a window event so every mounted reader updates when
 * any writer changes it (nav, account page, auth modal, account sync).
 *
 * For a signed-in account the list is a cache of the account's "My Teams"
 * (synced in useCurrentUser): local changes are pushed to the account, and on
 * load the account's list wins unless this browser has unsent changes.
 */

import type { PublicUser } from './perfectseason/leaderboard';

export const FAVORITES_KEY = 'favorite-teams';
export const FAVORITES_EVENT = 'favorites-changed';
/** Set when the list changed with no account connected to receive it. */
const DIRTY_KEY = 'favorites-dirty';
const syncedKey = (userId: string) => `account-teams-synced:${userId}`;

let remote: ((list: string[]) => void) | null = null;

/** Where local changes go while signed in (null when signed out). */
export function setFavoritesRemote(fn: ((list: string[]) => void) | null): void {
  remote = fn;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFavorites(list: string[], opts: { fromAccount?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  storageSet(FAVORITES_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { favorites: list } }));
  if (opts.fromAccount) return;
  if (remote) remote(list);
  else storageSet(DIRTY_KEY, '1');
}

/** Put `slug` at the front of the list if it isn't there already. */
export function mergeFavorite(slug: string | undefined | null): void {
  if (!slug) return;
  const list = readFavorites();
  if (list.includes(slug)) return;
  writeFavorites([slug, ...list]);
}

/** Replace `previous` with `next` (a favorite switch), or just drop `previous` when `next` is empty. */
export function swapFavorite(previous: string | undefined | null, next: string | undefined | null): void {
  const list = readFavorites();
  const withoutOld = previous ? list.filter((t) => t !== previous) : list;
  writeFavorites(next ? [next, ...withoutOld.filter((t) => t !== next)] : withoutOld);
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/**
 * Reconcile this browser's list with the signed-in account's teams. First time
 * this account is seen here: the union (nothing starred before signing in is
 * lost). After that: the account wins, unless this browser changed the list
 * while no account was listening, in which case the browser's list is sent up.
 * `push` saves a list to the account.
 */
export function syncAccountTeams(user: PublicUser, push: (list: string[]) => void): void {
  if (typeof window === 'undefined') return;
  const server = user.teams ?? (user.favoriteTeam ? [user.favoriteTeam] : []);
  const local = readFavorites();
  let next: string[];
  if (!storageGet(syncedKey(user.id))) next = [...server, ...local.filter((t) => !server.includes(t))];
  else if (storageGet(DIRTY_KEY) === '1') next = local;
  else next = server;

  if (!sameList(next, local)) writeFavorites(next, { fromAccount: true });
  storageSet(syncedKey(user.id), '1');
  storageSet(DIRTY_KEY, null);
  if (!sameList(next, server)) push(next);
}

/** Subscribe to favorites changes from this tab (custom event) and other tabs (storage event). */
export function onFavoritesChange(handler: (favorites: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onCustom = () => handler(readFavorites());
  const onStorage = (e: StorageEvent) => {
    if (e.key === FAVORITES_KEY || e.key === null) handler(readFavorites());
  };
  window.addEventListener(FAVORITES_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
