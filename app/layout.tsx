import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { PageTransitionPlaceholder } from "@/components/PageTransitionPlaceholder";
import { TradeStatusBanner } from "@/components/TradeStatusBanner";
import { DevPerfOverlay } from "@/components/DevPerfOverlay";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { WebVitalsReporting } from "@/components/WebVitalsReporting";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
});

export const metadata: Metadata = {
  title: "StellarSwipe",
  description: "Stellar-powered swipe app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Apply persisted theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var item=localStorage.getItem('stellar-theme');var theme=item?JSON.parse(item).state?.theme:null; if(!theme){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';} document.documentElement.classList.remove('light','dark'); document.documentElement.classList.add(theme);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          <ScrollRestoration />
          <WebVitalsReporting />
          <Navbar />
          <PageTransitionPlaceholder />
          {children}
          <TradeStatusBanner />
          <DevPerfOverlay />
        </Providers>
      </body>
    </html>
  );
}
