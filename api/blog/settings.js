import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(req) {
  const token = req.cookies?.admin_token;
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
const SETTINGS_KEYS = {
  'auto-publish-weekly': 'blog:settings:auto-publish-weekly',
  'auto-publish-news': 'blog:settings:auto-publish-news',
  'auto-publish-game-recap': 'blog:settings:auto-publish-game-recap',
  'auto-publish-set-recap': 'blog:settings:auto-publish-set-recap',
};

export default async function handler(req, res) {
  // GET - fetch all settings
  if (req.method === 'GET') {
    try {
      const settings = {};
      for (const [key, kvKey] of Object.entries(SETTINGS_KEYS)) {
        const value = await kv.get(kvKey);
        settings[key] = value === true;
      }
      return res.status(200).json({ settings });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  // POST - update a setting (requires admin auth)
  if (req.method === 'POST') {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { key, value } = req.body;

    if (!key || !SETTINGS_KEYS[key]) {
      return res.status(400).json({
        error: 'Invalid setting key',
        validKeys: Object.keys(SETTINGS_KEYS),
      });
    }

    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: 'Value must be a boolean' });
    }

    try {
      await kv.set(SETTINGS_KEYS[key], value);
      return res.status(200).json({ success: true, key, value });
    } catch (error) {
      console.error('Failed to update setting:', error);
      return res.status(500).json({ error: 'Failed to update setting' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export helper for cron jobs to check settings
export async function getAutoPublishSetting(type) {
  const keyMap = {
    'weekly': 'blog:settings:auto-publish-weekly',
    'news': 'blog:settings:auto-publish-news',
    'game-recap': 'blog:settings:auto-publish-game-recap',
    'set-recap': 'blog:settings:auto-publish-set-recap',
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
    const envMap = {
      'weekly': 'AUTO_PUBLISH_WEEKLY',
      'news': 'AUTO_PUBLISH_NEWS',
      'game-recap': 'AUTO_PUBLISH_GAME_RECAP',
      'set-recap': 'AUTO_PUBLISH_SET_RECAP',
    };
    return process.env[envMap[type]] === 'true';
  } catch {
    return false;
  }
}
