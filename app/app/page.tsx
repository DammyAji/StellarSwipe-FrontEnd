import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SignalFeedServer } from "@/components/signal/SignalFeedServer";
import { SignalCardSkeleton } from "@/components/SignalCardSkeleton";
import { TransactionHistory } from "@/components/history/TransactionHistory";

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

export default function AppPage() {
  return (
    <AppShell>
      <Suspense fallback={<SignalFeedSkeleton />}>
        <SignalFeedServer />
      </Suspense>
      <section className="mt-6" aria-label="Transaction history">
        <TransactionHistory />
      </section>
    </AppShell>
  );
}
