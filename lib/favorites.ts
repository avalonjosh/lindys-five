/**
 * Client-side favorite teams (the hamburger stars / home grid). One shared
 * localStorage list, plus a window event so every mounted reader updates when
 * any writer changes it (nav, account page, auth modal, account sync).
 */

export const FAVORITES_KEY = 'favorite-teams';
export const FAVORITES_EVENT = 'favorites-changed';
/** Which account favorite has already been merged into this browser's list. */
const SYNCED_KEY = 'account-favorite-synced';

export function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFavorites(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { favorites: list } }));
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

/**
 * Merge the signed-in account's favorite into local favorites. Runs once per
 * favorite per browser, so a deliberate un-star afterwards sticks until the
 * account favorite changes again.
 */
export function syncAccountFavorite(slug: string | undefined | null): void {
  if (typeof window === 'undefined' || !slug) return;
  let synced: string | null = null;
  try {
    synced = localStorage.getItem(SYNCED_KEY);
  } catch {
    /* ignore */
  }
  if (synced === slug) return;
  mergeFavorite(slug);
  try {
    localStorage.setItem(SYNCED_KEY, slug);
  } catch {
    /* ignore */
  }
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
