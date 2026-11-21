# Project

## API Versioning

This server exposes a versioned REST API using **URI-based versioning**.

- The current stable version is **v1**.
- Requests without an explicit version resolve to the **default version (v1)**.
- Requests for an unsupported version (e.g. `/v2/...`) return a predictable `404 Not Found` instead of silently falling through to another version.

### Examples

| Request | Resolves to |
| --- | --- |
| `GET /health` | default version (`v1`) |
| `GET /v1/health` | explicit `v1` |
| `GET /v2/health` | `404 Not Found` (unsupported version) |

### Adding a new version

Found a vulnerability? Please don't open a public issue — see
[SECURITY.md](SECURITY.md) for how to report it privately, supported
versions, and our disclosure policy.

## Security Headers & CSP

`next.config.mjs` sets HTTP security headers on every route via `async headers()`:
`Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy:
strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`
(camera, microphone, geolocation, sensors, payment, USB, etc. disabled).

CSP sources currently allowed (update the constants in `next.config.mjs` when
adding a third-party integration):

| Directive | Sources |
| --- | --- |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'`, `https://*.sentry.io`, `https://*.ingest.sentry.io` |
| `connect-src` | `'self'`, Sentry ingest, Stellar Horizon (`horizon.stellar.org`, `horizon-testnet.stellar.org`, `horizon-futurenet.stellar.org`), Soroban RPC (`soroban-testnet.stellar.org`, `soroban-mainnet.stellar.org`), `https://stellar.expert`, and the matching `wss://` Horizon/Soroban WebSocket origins |
| `img-src` | `'self' data: blob: https:` (avatars, chart snapshots) |
| `style-src` | `'self' 'unsafe-inline'` |
| `worker-src` | `'self' blob:` (service worker / push notifications) |
| `frame-ancestors` | `'none'` |

Verify locally with `curl -I http://localhost:3000` against a production build
(`npm run build && npm start`).

## Tech Stack

- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS 4 + shadcn/ui
- Framer Motion (swipes/animations)
- TanStack Query (data fetching)
- @stellar/freighter-api + stellar-sdk
- Zustand (state)
- Vercel deployment

## Quick Start

1. Clone & install:
   ```bash
   git clone https://github.com/EndeMathew/StellarSwipe-frontend.git
   cd StellarSwipe-frontend
   npm install
   ```

Set environment variables (.env.local):
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

Run dev server:
npm run dev

### React Query Devtools

When running locally (`npm run dev`), the [React Query Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools) panel is automatically available — look for the floating TanStack logo in the corner of the app. Use it to inspect the live query cache, stale/fresh status, and refetch behaviour for hooks such as the signal feed (`["signals"]`).

The devtools are mounted only when `NODE_ENV === "development"`; the import is dead-code-eliminated from production builds, so the panel never ships to users and requires no manual toggling.

## Web Push Notifications

Push subscriptions (`lib/notifications.ts`'s `subscribeToPush`) require a VAPID public key at `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in your `.env.local`. Without it, `subscribeToPush()` silently returns `null` and users can never subscribe.

Generate a VAPID key pair locally:

```bash
npx web-push generate-vapid-keys
```

Set the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and keep the private key server-side only (used by whatever service dispatches the push messages) — never prefix it with `NEXT_PUBLIC_` or commit it.

## Storybook

Storybook provides an isolated visual catalog for all core UI primitives and components.

### PR Previews

Every pull request that touches `src/components/`, `src/app/`, `stories/`, or `.storybook/` automatically gets a hosted Storybook preview via [Chromatic](https://www.chromatic.com/):

1. Open the pull request on GitHub.
2. Look for the **📖 Storybook Preview** comment posted (or updated) by the CI bot — it contains the direct link.
3. Alternatively, scroll to the **Checks** section and click the **Chromatic Visual Regression** check → **Details**.

The preview is hosted by Chromatic and tied to the PR's build — no local setup required. Previews expire naturally when Chromatic's retention policy applies after the PR is merged or closed.

### Run locally

```bash
npm run storybook
# Opens at http://localhost:6006
```

Use the theme toolbar (sun/moon icon) to toggle between **light** and **dark** themes.

### Build static Storybook

```bash
npm run build-storybook
# Outputs to storybook-static/
```

### Add a new story

1. Create `stories/YourComponent.stories.tsx` alongside existing stories.
2. Follow the `Meta` / `StoryObj` pattern used in existing stories.
3. Tag with `autodocs` to auto-generate docs pages.

Stories are also used for **Chromatic visual regression** snapshots — any story in `stories/` is captured on every PR. To exclude a story from snapshots add `parameters: { chromatic: { disableSnapshot: true } }`.

## Bundle Size Gate

The CI bundle size check runs `ANALYZE=true npm run build` and compares output against `bundle-budget.json`.

To raise a budget intentionally:

1. Edit `bundle-budget.json` — increase `sizeKb` for the affected chunk.
2. Add a comment in the PR description explaining the accepted regression.

Run locally:

```bash
npm run build:analyze   # builds with analyzer, opens report in browser
npm run bundle:check    # validates current build against budget
```

## Lighthouse CI

Performance audits run automatically on every PR via Lighthouse CI (`lighthouserc.js`).

Budget thresholds (defined in `lighthouserc.js`):

| Metric            | Budget    |
| ----------------- | --------- |
| Performance score | ≥ 0.70    |
| LCP               | ≤ 2500 ms |
| CLS               | ≤ 0.10    |
| TBT               | ≤ 300 ms  |

To adjust a budget: edit the `assertions` block in `lighthouserc.js` and document the reason in your PR.

Lighthouse reports are uploaded as CI artifacts (`lighthouse-reports/`) for debugging failed runs.

## Contributing

We welcome contributions from external contributors. See [CONTRIBUTING.md](CONTRIBUTING.md)
for local setup, environment variables, dev/test/lint/e2e/Storybook commands, branch and
commit conventions, and the pull request review process.

## Additional documentation

Legacy implementation notes have been consolidated under `/docs` to reduce root clutter:

- [`/docs/page-transitions/`](docs/page-transitions/) – page transition placeholder system docs
- [`/docs/pull-to-refresh/`](docs/pull-to-refresh/) – pull-to-refresh gesture docs
- [`/docs/project/`](docs/project/) – project-level implementation summaries and guidelines

## Worker Tracing

Asynchronous worker execution paths are instrumented via `src/tracing/worker-tracing.service.ts`.

### What is traced

| Worker                        | Span name                 |
| ----------------------------- | ------------------------- |
| `/api/signals` route handler  | `worker:signals:fetch`    |
| Freighter wallet connect      | `worker:wallet:connect`   |
| Signal price polling interval | `worker:signalPrice:poll` |

### API

```ts
// Wrap any async function — returns its result, re-throws on error
const data = await traceWorker("worker:my:task", async () => fetchData(), {
  page: 1,
});

// Manual span lifecycle
const finish = startSpan("worker:my:task", { key: "value" });
try {
  await doWork();
  finish("ok");
} catch (err) {
  finish("error", err as Error);
}
```

Each span captures: `traceId`, `spanId`, `name`, `startedAt`, `endedAt`, `durationMs`, `status`, `attributes`, and `error` (if any).

In development (`NODE_ENV=development`) spans are logged to `console.debug`. Replace the `emit` function in the service to forward spans to any observability backend (Datadog, OpenTelemetry, etc.).

### Security

- Attributes are caller-controlled — the service never reads or mutates them.
- No secrets are injected or logged by the tracing layer itself.
- Existing authentication and authorization semantics are fully preserved.

### Running tests

Two test runners are configured:

- **Jest** — runs the main test suites from store-level `__tests__` directories:
  ```bash
  npm test           # Jest (no coverage)
  npm run test:coverage  # Jest with coverage
  ```
- **Vitest** — runs the comparison-tray suites at the project root `__tests__/`:
  ```bash
  npm run test:vitest
  ```

Both runners execute automatically in CI on every push/PR. The **Test (Jest)** step runs the main test suites, and the **Test (Vitest)** step runs the comparison-tray suites, ensuring that no regressions in the comparison-tray feature can merge undetected.

## Handsoff notes

<!-- handsoff-issue-707 -->
- #707: Persist dashboard widget visibility and layout

<!-- handsoff-issue-708 -->
- #708: Improve comparison view on narrow screens

<!-- handsoff-issue-810 -->
- #810: Preview estimated proceeds before closing a position

<!-- handsoff-issue-811 -->
- #811: Manage active price alerts with pause, edit, and trigger history

<!-- handsoff-issue-812 -->
- #812: Show signal source evidence in the expanded signal view

<!-- handsoff-issue-453 -->
- #453: Add Storybook stories for CommandPalette, ApiKeyManager, CSVImportModal, WalletDropdown, and QRPairingPanel

<!-- handsoff-issue-818 -->
- #818: Add keyboard inspection for individual comparison chart points

<!-- handsoff-issue-819 -->
- #819: Duplicate a journal entry as a starting point for a new trade note

<!-- handsoff-issue-821 -->
- #821: Link journal entries to transaction receipts

<!-- handsoff-issue-835 -->
- #835: Add a participant detail panel to the leaderboard

<!-- handsoff-issue-822 -->
- #822: Add suggested tags while editing journal entries

<!-- handsoff-issue-826 -->
- #826: Run a tax-report preflight for missing transaction data

<!-- handsoff-issue-827 -->
- #827: Add a transaction line-item review to tax report previews

<!-- handsoff-issue-828 -->
- #828: Set an expiration date when creating an API key

<!-- handsoff-issue-803 -->
- #803: Filter transaction activity by asset, direction, and status

<!-- handsoff-issue-936 -->
- #936: Rotate refresh credentials and detect reuse

<!-- handsoff-issue-937 -->
- #937: Add backend endpoints to list and revoke active sessions

<!-- handsoff-issue-946 -->
- #946: Add account profile read and update endpoints

<!-- handsoff-issue-862 -->
- #862: Separate realized and unrealized P&L in the portfolio summary

<!-- handsoff-issue-863 -->
- #863: Add lot-level cost basis details to position views

<!-- handsoff-issue-864 -->
- #864: Add configurable columns to the portfolio holdings table

<!-- handsoff-issue-913 -->
- #913: Validate NestJS environment configuration at startup

<!-- handsoff-issue-926 -->
- #926: Instrument NestJS requests with distributed tracing context

<!-- handsoff-issue-867 -->
- #867: Annotate deposits and withdrawals on portfolio performance charts

<!-- handsoff-issue-868 -->
- #868: Drill into portfolio holdings from allocation chart segments

1. Bump the default version in the NestJS bootstrap (`app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`).
2. Annotate controllers/handlers with `@Version('2')` where the new version applies.
3. Add e2e coverage for the new version alongside the existing default/explicit/unsupported cases.
