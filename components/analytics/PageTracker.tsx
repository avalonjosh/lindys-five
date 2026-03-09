'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useCallback, Suspense } from 'react';

function sendBeaconOrFetch(payload: object) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', body);
  } else {
    fetch('/api/analytics/track', {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }
}

// Session page counter (resets when tab closes)
let sessionPageCount = 0;

function PageTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef('');
  const pageEnteredAt = useRef(0);

  // Extract UTM params on mount / route change
  const getUtm = useCallback(() => {
    const source = searchParams.get('utm_source') || undefined;
    const medium = searchParams.get('utm_medium') || undefined;
    const campaign = searchParams.get('utm_campaign') || undefined;
    if (source || medium || campaign) return { source, medium, campaign };
    return undefined;
  }, [searchParams]);

  // Send exit/duration event for previous page
  const sendExit = useCallback(() => {
    if (!lastPath.current || !pageEnteredAt.current) return;
    const duration = Math.round((Date.now() - pageEnteredAt.current) / 1000);
    if (duration < 1) return;
    sendBeaconOrFetch({
      type: 'exit',
      path: lastPath.current,
      referrer: '',
      duration,
      sessionPages: sessionPageCount,
    });
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    if (pathname === lastPath.current) return;

    // Send exit for the previous page
    sendExit();

    // Track new pageview
    sessionPageCount++;
    pageEnteredAt.current = Date.now();
    lastPath.current = pathname;

    sendBeaconOrFetch({
      type: 'pageview',
      path: pathname,
      referrer: document.referrer || '',
      sessionPages: sessionPageCount,
      utm: getUtm(),
    });
  }, [pathname, getUtm, sendExit]);

  // Send exit on tab close / navigate away
  useEffect(() => {
    const handleUnload = () => sendExit();
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendExit();
    });
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [sendExit]);

  return null;
}

// Wrap in Suspense because useSearchParams requires it
export default function PageTracker() {
  return (
    <Suspense fallback={null}>
      <PageTrackerInner />
    </Suspense>
  );
}
