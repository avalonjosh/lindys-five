'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GA_ID = 'G-ZQRG7XK9D6';

/** Loads GA4 on public routes only. Admin sessions (the operator's own
 *  traffic) are excluded so the dashboard measures visitors, not us. */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
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
