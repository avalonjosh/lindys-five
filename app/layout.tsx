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
    default: "Lindy's Five - Track Your Team's Road to the Playoffs",
    template: "%s | Lindy's Five",
  },
  description:
    "Track your NHL team's playoff race with 5-game set analysis. Live standings, projections, and insights for all 32 teams. Target: 6+ points per set.",
  openGraph: {
    type: 'website',
    url: 'https://lindysfive.com/',
    title: "Lindy's Five - Track Your Team's Road to the Playoffs",
    description:
      "Track your NHL team's playoff race with 5-game set analysis. Live standings, projections, and insights for all 32 teams.",
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Lindy's Five - Track Your Team's Road to the Playoffs",
    description:
      "Track your NHL team's playoff race with 5-game set analysis. Live standings, projections, and insights for all 32 teams.",
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
