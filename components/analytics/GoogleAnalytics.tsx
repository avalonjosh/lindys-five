'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GA_ID = 'G-ZQRG7XK9D6';

/** Loads GA4 on public routes only. Admin sessions (the operator's own
 *  traffic) are excluded so the dashboard measures visitors, not us. */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  // Reset, confirm-email and email-preference pages carry private tokens or ids in their URLs; keep them out of analytics.
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/account/reset') || pathname?.startsWith('/account/confirm-email') || pathname?.startsWith('/email-preferences')) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
