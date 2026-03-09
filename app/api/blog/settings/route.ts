import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Settings keys
const SETTINGS_KEYS: Record<string, string> = {
  // Sabres
  'auto-publish-weekly': 'blog:settings:auto-publish-weekly',
  'auto-publish-news': 'blog:settings:auto-publish-news',
  'auto-publish-game-recap': 'blog:settings:auto-publish-game-recap',
  'auto-publish-set-recap': 'blog:settings:auto-publish-set-recap',
  // Bills
  'auto-publish-bills-news': 'blog:settings:auto-publish-bills-news',
  'auto-publish-bills-weekly': 'blog:settings:auto-publish-bills-weekly',
  'auto-publish-bills-game-recap': 'blog:settings:auto-publish-bills-game-recap',
};

// GET - fetch all settings
export async function GET(_request: NextRequest) {
  try {
    const settings: Record<string, boolean> = {};
    for (const [key, kvKey] of Object.entries(SETTINGS_KEYS)) {
      const value = await kv.get(kvKey);
      settings[key] = value === true;
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - update a setting (requires admin auth)
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { key, value } = await request.json();

  if (!key || !SETTINGS_KEYS[key]) {
    return NextResponse.json(
      { error: 'Invalid setting key', validKeys: Object.keys(SETTINGS_KEYS) },
      { status: 400 }
    );
  }

  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'Value must be a boolean' }, { status: 400 });
  }

  try {
    await kv.set(SETTINGS_KEYS[key], value);
    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error('Failed to update setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

// Export helper for cron jobs to check settings
export async function getAutoPublishSetting(type: string): Promise<boolean> {
  const keyMap: Record<string, string> = {
    // Sabres
    'weekly': 'blog:settings:auto-publish-weekly',
    'news': 'blog:settings:auto-publish-news',
    'game-recap': 'blog:settings:auto-publish-game-recap',
    'set-recap': 'blog:settings:auto-publish-set-recap',
    // Bills
    'bills-news': 'blog:settings:auto-publish-bills-news',
    'bills-weekly': 'blog:settings:auto-publish-bills-weekly',
    'bills-game-recap': 'blog:settings:auto-publish-bills-game-recap',
  };

  const kvKey = keyMap[type];
  if (!kvKey) return false;

  try {
    const value = await kv.get(kvKey);
    // If KV value exists, use it; otherwise fall back to env var
    if (value !== null) {
      return value === true;
    }
    // Fall back to environment variable
    const envMap: Record<string, string> = {
      // Sabres
      'weekly': 'AUTO_PUBLISH_WEEKLY',
      'news': 'AUTO_PUBLISH_NEWS',
      'game-recap': 'AUTO_PUBLISH_GAME_RECAP',
      'set-recap': 'AUTO_PUBLISH_SET_RECAP',
      // Bills
      'bills-news': 'AUTO_PUBLISH_BILLS_NEWS',
      'bills-weekly': 'AUTO_PUBLISH_BILLS_WEEKLY',
      'bills-game-recap': 'AUTO_PUBLISH_BILLS_GAME_RECAP',
    };
    return process.env[envMap[type]] === 'true';
  } catch {
    return false;
  }
}
