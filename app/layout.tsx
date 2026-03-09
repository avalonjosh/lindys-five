import type { Metadata } from 'next';
import Script from 'next/script';
import { Bebas_Neue, Permanent_Marker } from 'next/font/google';
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
    default: "NHL Playoff Odds & Tracker 2026 | Lindy's Five",
    template: "%s | Lindy's Five",
  },
  description:
    "Track NHL playoff odds, projections, and standings for all 32 teams. 5-game set analysis, points pace, and playoff probability updated daily.",
  openGraph: {
    type: 'website',
    url: 'https://lindysfive.com/',
    title: "NHL Playoff Odds & Tracker 2026 | Lindy's Five",
    description:
      "Track NHL playoff odds, projections, and standings for all 32 teams. 5-game set analysis, points pace, and playoff probability updated daily.",
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "NHL Playoff Odds & Tracker 2026 | Lindy's Five",
    description:
      "Track NHL playoff odds, projections, and standings for all 32 teams. 5-game set analysis and playoff probability updated daily.",
  },
  icons: {
    icon: '/favicon.svg',
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
