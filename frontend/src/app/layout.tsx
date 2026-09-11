import type { Metadata, Viewport } from "next";
import ErrorBoundary from '@/components/ErrorBoundary';
import "./globals.css";

const SITE_URL = "https://sarvadarshi.demo";
const SITE_NAME = "Sarvadarshi";
const SITE_TITLE = "Sarvadarshi — Disruption Intelligence";
const SITE_DESCRIPTION = "Sarvadarshi — real-time supply chain disruption prediction, supplier risk scoring, and cascade analysis on a global intelligence platform.";

export const viewport: Viewport = {
  themeColor: "#58a6ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Sarvadarshi",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "supply chain", "disruption prediction", "supplier risk", "risk scoring",
    "cascade analysis", "Monte Carlo", "Bayesian", "lead time forecasting",
    "port congestion", "trade route", "logistics", "supply chain intelligence",
    "supply chain monitoring", "supply chain risk management",
  ],
  authors: [{ name: "Sarvadarshi" }],
  creator: "Sarvadarshi",
  publisher: "Sarvadarshi",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  category: "technology",
  classification: "Supply Chain Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ErrorBoundary name="Sarvadarshi">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
