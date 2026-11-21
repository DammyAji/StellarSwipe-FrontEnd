import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const isStorybook = process.argv.some((arg) => arg.includes("storybook"));

// Origins allowed by the Content-Security-Policy. Keep in sync with README.md.
const SENTRY_ORIGINS = ["https://*.sentry.io", "https://*.ingest.sentry.io"];
const STELLAR_ORIGINS = [
  "https://horizon.stellar.org",
  "https://horizon-testnet.stellar.org",
  "https://horizon-futurenet.stellar.org",
  "https://soroban-testnet.stellar.org",
  "https://soroban-mainnet.stellar.org",
  "https://stellar.expert",
];
const STELLAR_WS_ORIGINS = [
  "wss://horizon.stellar.org",
  "wss://horizon-testnet.stellar.org",
  "wss://horizon-futurenet.stellar.org",
  "wss://soroban-testnet.stellar.org",
  "wss://soroban-mainnet.stellar.org",
];

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; Sentry loads its SDK bundle.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SENTRY_ORIGINS.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${[...SENTRY_ORIGINS, ...STELLAR_ORIGINS, ...STELLAR_WS_ORIGINS].join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), xr-spatial-tracking=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  experimental: {
    instrumentationHook: !isStorybook,
  },
  images: {
    // #436: explicit avatar/image host allowlist — no wildcard hostnames.
    // Only hosts listed here may be optimised by next/image. Arbitrary
    // user-supplied avatar URLs are rejected client-side by
    // `isAllowedAvatarUrl` (lib/avatarHosts.ts) and fall back to initials.
    // To add a provider avatar host safely: add the exact hostname (and path
    // prefix if the CDN is shared) to BOTH this list and lib/avatarHosts.ts,
    // then document it in docs/avatar-host-allowlist.md.
    remotePatterns: [
      // Generated identicon/avatar service used by leaderboard + provider profiles
      { protocol: "https", hostname: "api.dicebear.com", pathname: "/7.x/**" },
      // GitHub-hosted avatars (provider profiles linked to GitHub accounts)
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Gravatar (email-derived avatars)
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "www.gravatar.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Service worker must be served from the root scope and stay fresh.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

const configWithBundleAnalyzer = withBundleAnalyzer(nextConfig);

export default isStorybook
  ? nextConfig
  : withSentryConfig(configWithBundleAnalyzer, {
      org: "your-org",
      project: "your-project",
      silent: true,
      widenClientFileUpload: true,
      webpack: {
        reactComponentAnnotation: { enabled: true },
        treeshake: { removeDebugLogging: true },
        automaticVercelMonitors: true,
      },
      hideSourceMaps: true,
    });
