import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { PageTransitionPlaceholder } from "@/components/PageTransitionPlaceholder";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { TradeStatusBanner } from "@/components/TradeStatusBanner";
import { TransactionFailure } from "@/components/TransactionFailure";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { WebVitalsReporting } from "@/components/WebVitalsReporting";
import { ComparisonTray } from "@/components/ComparisonTray";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { GuidedTourSpotlight } from "@/components/GuidedTourSpotlight";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { MobileNav } from "@/components/MobileNav";
import { ToastViewport } from "@/components/ToastViewport";
import { DesktopNavRail } from "@/components/DesktopNavRail";
import { DemoModeIndicator } from "@/components/DemoModeIndicator";
import { WalletProvider } from "@/components/WalletProvider";

// Dev-only overlays (~950 lines combined) render null in production but were
// previously statically imported into every page's root layout bundle. They
// only ever render for developers, so ship them as a lazily-loaded chunk
// instead of inflating the initial payload for every real user.
const DevPerfOverlay = dynamic(
  () => import("@/components/DevPerfOverlay").then((m) => m.DevPerfOverlay),
  { ssr: false }
);
const AnalyticsDebugConsole = dynamic(
  () =>
    import("@/components/AnalyticsDebugConsole").then(
      (m) => m.AnalyticsDebugConsole
    ),
  { ssr: false }
);

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
});

export const metadata: Metadata = {
  title: "StellarSwipe",
  description: "Stellar-powered swipe app",
  openGraph: {
    title: "StellarSwipe",
    description: "Stellar-powered swipe app — discover top signal providers, trade tokens, and track performance on the Stellar network.",
    url: "/",
    siteName: "StellarSwipe",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "StellarSwipe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StellarSwipe",
    description: "Stellar-powered swipe app — discover top signal providers, trade tokens, and track performance on the Stellar network.",
  },
};

// viewport is exported separately so Next.js sets the correct meta tag
// (including viewport-fit=cover for iOS safe-area inset support).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={inter.variable}
    >
      <head>
        {/*
         * Blocking inline script — runs synchronously before any paint.
         * Reads the persisted Zustand theme ("stellar-theme" → state.theme),
         * falls back to the OS prefers-color-scheme, then applies the correct
         * .dark / .light class to <html> before any CSS or React hydration.
         * Also applies the persisted high-contrast preference ("stellar-contrast")
         * so it never flashes the default palette first (#788).
         * suppressHydrationWarning on <html> lets React reconcile safely.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('stellar-theme');var t=s?JSON.parse(s).state?.theme:null;if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}try{var c=localStorage.getItem('stellar-contrast');if(c&&JSON.parse(c).state?.highContrast===true){document.documentElement.classList.add('high-contrast');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          {/* Wallet connection state (Freighter & Albedo) is provided app-wide
              so the navbar and any page can read the connected public key. */}
          <WalletProvider>
            {/* Skip link — visually hidden until focused; lets keyboard users bypass nav */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <NetworkStatusIndicator />
            <DemoModeIndicator />
            <RouteAnnouncer />
            <ScrollRestoration />
            <WebVitalsReporting />
            <Navbar />
            <MobileNav />
            <PageTransitionPlaceholder />
            {/* id="main-content" is the skip-link target; pages provide the <main> landmark */}
            {/* #757 — Collapsible desktop navigation rail sits alongside page content */}
            <div id="main-content" tabIndex={-1} className="outline-none flex">
              <DesktopNavRail />
              <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
            </div>
            <TradeStatusBanner />
            <TransactionFailure />
            <DevPerfOverlay />
            <AnalyticsDebugConsole />
            <ComparisonTray />
            <NotificationPermissionPrompt />
            <PWAInstallPrompt />
            <GuidedTourSpotlight />
            {/* Bounded, non-overlapping toast region. Positioned below the fixed
                navbar and above the mobile nav / primary form actions so queued
                messages never cover navigation or submit buttons. */}
            <ToastViewport />
          </WalletProvider>
        </Providers>
      </body>
    </html>
  );
}
