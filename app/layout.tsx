import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import { Bebas_Neue, Permanent_Marker } from 'next/font/google';
import PageTracker from '@/components/analytics/PageTracker';
import NewsletterVerified from '@/components/newsletter/NewsletterVerified';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  display: 'swap',
});

const permanentMarker = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-permanent-marker',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lindysfive.com'),
  title: {
    default: "Lindy's Five — NHL & MLB Playoff Odds, Standings & Projections",
    template: "%s | Lindy's Five",
  },
  description:
    "NHL and MLB playoff odds, standings, and projections for all 32 NHL teams and all 30 MLB teams. Playoff probability, Stanley Cup and World Series odds, points pace, and win pace updated daily.",
  openGraph: {
    type: 'website',
    url: 'https://www.lindysfive.com/',
    title: "Lindy's Five — NHL & MLB Playoff Odds, Standings & Projections",
    description:
      "NHL and MLB playoff odds, standings, and projections for all 32 NHL teams and all 30 MLB teams. Updated daily.",
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Lindy's Five — NHL & MLB Playoff Odds, Standings & Projections",
    description:
      "NHL and MLB playoff odds, standings, and projections for all 32 NHL teams and all 30 MLB teams. Updated daily.",
  },
  icons: {
    icon: '/favicon.svg',
  },
  other: {
    'impact-site-verification': '48d72d29-439f-487e-b8ad-27c53de0eb72',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${permanentMarker.variable}`}>
      <body>
        <PageTracker />
        <Suspense><NewsletterVerified /></Suspense>
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-ZQRG7XK9D6"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ZQRG7XK9D6');
          `}
        </Script>
      </body>
    </html>
  );
}
