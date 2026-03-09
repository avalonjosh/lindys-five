// Analytics types and utilities

export interface AnalyticsEvent {
  type: 'pageview' | 'click';
  path: string;
  referrer: string;
  target?: string;
  label?: string;
}

export interface ParsedUA {
  device: 'mobile' | 'desktop' | 'tablet';
  browser: string;
}

const BOT_PATTERNS = /bot|crawl|spider|slurp|bingbot|googlebot|yandex|baidu|duckduck|semrush|ahref|mj12bot|dotbot|petalbot|bytespider/i;

export function isBot(ua: string): boolean {
  return BOT_PATTERNS.test(ua);
}

export function parseUserAgent(ua: string): ParsedUA {
  // Device detection
  let device: ParsedUA['device'] = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    device = 'mobile';
  }

  // Browser detection
  let browser = 'other';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';

  return { device, browser };
}

export async function hashVisitorId(ip: string, ua: string, date: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}${ua}${date}${salt}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const arr = new Uint8Array(hash);
  return Array.from(arr.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parseReferrerDomain(referrer: string): string {
  if (!referrer) return 'direct';
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, '');
    // Skip self-referrals
    if (host === 'lindysfive.com') return 'direct';
    return host;
  } catch {
    return 'direct';
  }
}

export function derivePageType(path: string): string {
  if (path === '/') return 'landing';
  if (path === '/scores') return 'scores';
  if (path === '/nhl-playoff-odds') return 'playoff-odds';
  if (path.startsWith('/blog/') && path.split('/').length > 3) return 'blog-post';
  if (path.startsWith('/blog')) return 'blog-index';
  if (path.startsWith('/admin')) return 'admin';
  // Team pages are /{team-slug}
  return 'team';
}

export function extractTeamFromPath(path: string): string | null {
  // Team pages: /buffalo-sabres, /toronto-maple-leafs, etc.
  // Blog team pages: /blog/sabres, /blog/bills
  if (path.startsWith('/blog/')) {
    const parts = path.split('/');
    if (parts.length === 3 && !parts[2].includes('-')) return parts[2];
    return null;
  }
  const slug = path.replace(/^\//, '');
  if (slug && !slug.includes('/') && slug !== 'scores' && slug !== 'nhl-playoff-odds') {
    return slug;
  }
  return null;
}

export function getDateKey(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split('T')[0];
}

export function getHourKey(date?: Date): string {
  const d = date || new Date();
  return String(d.getUTCHours()).padStart(2, '0');
}

// Client-side click tracking utility
export function trackClick(target: string, label?: string) {
  if (typeof navigator === 'undefined') return;
  const payload = JSON.stringify({
    type: 'click',
    path: window.location.pathname,
    referrer: document.referrer || '',
    target,
    label,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', payload);
  } else {
    fetch('/api/analytics/track', {
      method: 'POST',
      body: payload,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }
}
