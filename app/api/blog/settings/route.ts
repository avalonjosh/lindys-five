import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { getAutoPublishSetting, getAutoXSetting } from '@/lib/blogSettings';

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
  'auto-publish-playoff-game-recap': 'blog:settings:auto-publish-playoff-game-recap',
  'auto-publish-series-recap': 'blog:settings:auto-publish-series-recap',
  // Bills
  'auto-publish-bills-news': 'blog:settings:auto-publish-bills-news',
  'auto-publish-bills-weekly': 'blog:settings:auto-publish-bills-weekly',
  'auto-publish-bills-game-recap': 'blog:settings:auto-publish-bills-game-recap',
  // Auto-post to X per content type (default ON when unset)
  'auto-x-weekly': 'blog:settings:auto-x-weekly',
  'auto-x-news': 'blog:settings:auto-x-news',
  'auto-x-game-recap': 'blog:settings:auto-x-game-recap',
  'auto-x-set-recap': 'blog:settings:auto-x-set-recap',
  'auto-x-playoff-game-recap': 'blog:settings:auto-x-playoff-game-recap',
  'auto-x-series-recap': 'blog:settings:auto-x-series-recap',
  'auto-x-bills-news': 'blog:settings:auto-x-bills-news',
  'auto-x-bills-weekly': 'blog:settings:auto-x-bills-weekly',
  'auto-x-bills-game-recap': 'blog:settings:auto-x-bills-game-recap',
  // Email programs (gate the digest + MLB recap crons; toggled from the Newsletter admin)
  'weekly-digest-enabled': 'blog:settings:weekly-digest-enabled',
  'mlb-recap-enabled': 'blog:settings:mlb-recap-enabled',
  'mlb-set-recap-enabled': 'blog:settings:mlb-set-recap-enabled',
};

// GET - fetch all settings (effective values: KV, falling back to env for auto-publish keys)
export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const settings: Record<string, boolean> = {};
    for (const [key, kvKey] of Object.entries(SETTINGS_KEYS)) {
      if (key.startsWith('auto-publish-')) {
        settings[key] = await getAutoPublishSetting(key.replace('auto-publish-', ''));
      } else if (key.startsWith('auto-x-')) {
        settings[key] = await getAutoXSetting(key.replace('auto-x-', ''));
      } else {
        const value = await kv.get(kvKey);
        settings[key] = value === true;
      }
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
