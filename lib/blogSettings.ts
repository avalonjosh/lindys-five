import { kv } from '@vercel/kv';

// Every auto-publishable content type: cron type string -> KV key + env fallback.
// The admin settings UI key is `auto-publish-${type}`.
export const AUTO_PUBLISH_TYPES: Record<string, { kvKey: string; envVar: string }> = {
  // Sabres
  'weekly': { kvKey: 'blog:settings:auto-publish-weekly', envVar: 'AUTO_PUBLISH_WEEKLY' },
  'news': { kvKey: 'blog:settings:auto-publish-news', envVar: 'AUTO_PUBLISH_NEWS' },
  'game-recap': { kvKey: 'blog:settings:auto-publish-game-recap', envVar: 'AUTO_PUBLISH_GAME_RECAP' },
  'set-recap': { kvKey: 'blog:settings:auto-publish-set-recap', envVar: 'AUTO_PUBLISH_SET_RECAP' },
  'playoff-game-recap': { kvKey: 'blog:settings:auto-publish-playoff-game-recap', envVar: 'AUTO_PUBLISH_PLAYOFF_GAME_RECAP' },
  'series-recap': { kvKey: 'blog:settings:auto-publish-series-recap', envVar: 'AUTO_PUBLISH_SERIES_RECAP' },
  // Bills
  'bills-news': { kvKey: 'blog:settings:auto-publish-bills-news', envVar: 'AUTO_PUBLISH_BILLS_NEWS' },
  'bills-weekly': { kvKey: 'blog:settings:auto-publish-bills-weekly', envVar: 'AUTO_PUBLISH_BILLS_WEEKLY' },
  'bills-game-recap': { kvKey: 'blog:settings:auto-publish-bills-game-recap', envVar: 'AUTO_PUBLISH_BILLS_GAME_RECAP' },
};

// Per-type "auto-post to X" toggles. The admin settings UI key is `auto-x-${type}`.
// Unset defaults to ON so tweeting keeps working for types nobody has toggled.
export function autoXKvKey(type: string): string | null {
  return AUTO_PUBLISH_TYPES[type] ? `blog:settings:auto-x-${type}` : null;
}

export async function getAutoXSetting(type: string): Promise<boolean> {
  const kvKey = autoXKvKey(type);
  if (!kvKey) {
    console.error(`getAutoXSetting: unknown type "${type}" — treating as auto-X ON. Add it to AUTO_PUBLISH_TYPES in lib/blogSettings.ts.`);
    return true;
  }
  try {
    const value = await kv.get(kvKey);
    return value !== false;
  } catch (error) {
    console.error(`getAutoXSetting: KV read failed for "${type}" — treating as auto-X ON for this run`, error);
    return true;
  }
}

// Map a post's (type, team) to its auto-X toggle. Used by the manual publish
// paths, which see post types (news-analysis, weekly-roundup, ...) rather than
// cron type strings. Custom posts and unknown combos have no toggle -> tweet.
export function autoXTypeForPost(postType: string, team: string): string | null {
  if (team === 'bills') {
    if (postType === 'game-recap') return 'bills-game-recap';
    if (postType === 'weekly-roundup') return 'bills-weekly';
    if (postType === 'news-analysis') return 'bills-news';
    return null;
  }
  const map: Record<string, string> = {
    'game-recap': 'game-recap',
    'set-recap': 'set-recap',
    'news-analysis': 'news',
    'weekly-roundup': 'weekly',
    'playoff-game-recap': 'playoff-game-recap',
    'series-recap': 'series-recap',
  };
  return map[postType] ?? null;
}

export async function getAutoXSettingForPost(postType: string, team: string): Promise<boolean> {
  const type = autoXTypeForPost(postType, team);
  return type ? getAutoXSetting(type) : true;
}

export async function getAutoPublishSetting(type: string): Promise<boolean> {
  const entry = AUTO_PUBLISH_TYPES[type];
  if (!entry) {
    console.error(`getAutoPublishSetting: unknown type "${type}" — treating as auto-publish OFF. Add it to AUTO_PUBLISH_TYPES in lib/blogSettings.ts.`);
    return false;
  }

  try {
    const value = await kv.get(entry.kvKey);
    // If KV value exists, use it; otherwise fall back to env var
    if (value !== null) {
      return value === true;
    }
    return process.env[entry.envVar] === 'true';
  } catch (error) {
    console.error(`getAutoPublishSetting: KV read failed for "${type}" — treating as auto-publish OFF for this run`, error);
    return false;
  }
}
