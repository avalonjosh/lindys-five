'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PageTracker() {
  const pathname = usePathname();
  const lastPath = useRef('');

  useEffect(() => {
    // Skip admin paths
    if (pathname.startsWith('/admin')) return;
    // Prevent duplicate fires for same path
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    const payload = JSON.stringify({
      type: 'pageview',
      path: pathname,
      referrer: document.referrer || '',
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
  }, [pathname]);

  return null;
}
