# StellarSwipe-FrontEnd

[![CI](https://github.com/AgesEmpire/StellarSwipe-FrontEnd/actions/workflows/ci.yml/badge.svg)](https://github.com/AgesEmpire/StellarSwipe-FrontEnd/actions/workflows/ci.yml)

## Overview

Modern, responsive web app featuring:

- Infinite scrolling signal feed
- Gamified swipe mechanics (Framer Motion drag gestures)
- Freighter wallet integration
- Real-time dashboard & trade execution

Connects to Soroban contracts for on-chain actions.

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

Set environment variables (.env.local):
    NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
    NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

Run dev server:
  npm run dev

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

| Metric | Budget |
|---|---|
| Performance score | ≥ 0.70 |
| LCP | ≤ 2500 ms |
| CLS | ≤ 0.10 |
| TBT | ≤ 300 ms |

To adjust a budget: edit the `assertions` block in `lighthouserc.js` and document the reason in your PR.

Lighthouse reports are uploaded as CI artifacts (`lighthouse-reports/`) for debugging failed runs.

## Worker Tracing

Asynchronous worker execution paths are instrumented via `src/tracing/worker-tracing.service.ts`.

### What is traced

| Worker | Span name |
|---|---|
| `/api/signals` route handler | `worker:signals:fetch` |
| Freighter wallet connect | `worker:wallet:connect` |
| Signal price polling interval | `worker:signalPrice:poll` |

### API

```ts
// Wrap any async function — returns its result, re-throws on error
const data = await traceWorker("worker:my:task", async () => fetchData(), { page: 1 });

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

```bash
npm test
```

