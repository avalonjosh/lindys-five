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
  title: {
    default: "NHL Playoff Odds, Standings & Projections 2025-26 | Lindy's Five",
    template: "%s | Lindy's Five",
  },
  description:
    "NHL playoff odds, standings, and projections for all 32 teams. Track playoff probability, Stanley Cup odds, points pace, and playoff picture updated daily.",
  openGraph: {
    type: 'website',
    url: 'https://www.lindysfive.com/',
    title: "NHL Playoff Odds, Standings & Projections 2025-26 | Lindy's Five",
    description:
      "NHL playoff odds, standings, and projections for all 32 teams. Track playoff probability, Stanley Cup odds, points pace, and playoff picture updated daily.",
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "NHL Playoff Odds, Standings & Projections 2025-26 | Lindy's Five",
    description:
      "NHL playoff odds, standings, and projections for all 32 teams. Playoff probability, Stanley Cup odds, and playoff picture updated daily.",
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
