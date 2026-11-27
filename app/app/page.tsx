"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SignalFeedServer } from "@/components/signal/SignalFeedServer";
import { SignalCardSkeleton } from "@/components/SignalCardSkeleton";

function SignalFeedSkeleton() {
  return (
    <div
      className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-4"
      role="status"
      aria-label="Loading signal feed"
    >
      <span className="sr-only">Loading signal feed…</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <SignalCardSkeleton key={i} />
      ))}
    </div>
  );
}

      <div className="space-y-4">
        <LiquidityManager />
        <SwapInterface />
        <Suspense fallback={<SignalFeedSkeleton />}>
          <SignalFeedServer />
        </Suspense>
      </div>
  );
}

export default function AppPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <LiquidityManager />
        <SwapInterface />
        <Suspense fallback={<SignalFeedSkeleton />}>
          <SignalFeedServer />
        </Suspense>
      </div>
    </AppShell>
  );
}
