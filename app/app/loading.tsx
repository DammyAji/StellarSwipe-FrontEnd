import { SignalCardSkeleton } from "@/components/SignalCardSkeleton";

export default function AppLoading() {
  return (
    <main
      className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 text-foreground"
      aria-hidden="true"
    >
      <header className="mx-auto mb-6 flex w-full max-w-7xl items-center justify-between sm:mb-8">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-surface-high" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-high" />
      </header>
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div className="h-10 w-full animate-pulse rounded-2xl bg-surface-high" />
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 w-24 animate-pulse rounded-lg bg-surface-high" />
                <div className="h-8 w-8 animate-pulse rounded-lg bg-surface-high" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                <div className="h-4 w-16 animate-pulse rounded bg-surface-high" />
                <div className="flex items-center gap-3">
                  <div className="h-10 flex-1 animate-pulse rounded-lg bg-surface-high" />
                  <div className="h-10 w-28 animate-pulse rounded-lg bg-surface-high" />
                </div>
              </div>
              <div className="flex justify-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-surface-high" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                <div className="h-4 w-16 animate-pulse rounded bg-surface-high" />
                <div className="flex items-center gap-3">
                  <div className="h-10 flex-1 animate-pulse rounded-lg bg-surface-high" />
                  <div className="h-10 w-28 animate-pulse rounded-lg bg-surface-high" />
                </div>
              </div>
              <div className="h-4 w-40 animate-pulse rounded bg-surface-high" />
              <div className="h-12 w-full animate-pulse rounded-2xl bg-surface-high" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <SignalCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <aside className="hidden flex-col gap-4 md:flex">
            <div className="h-64 w-full animate-pulse rounded-3xl bg-surface-high" />
            <div className="h-40 w-full animate-pulse rounded-3xl bg-surface-high" />
          </aside>
        </div>
      </div>
    </main>
  );
}
