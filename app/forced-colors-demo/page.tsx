import { DemoModeToggle } from "@/components/DemoModeToggle";
import { PositionLimitToggle } from "@/components/PositionLimitToggle";
import { PremiumSignalBadge } from "@/components/PremiumSignalBadge";
import { SignalBadge } from "@/components/SignalBadge";

export default function ForcedColorsDemoPage() {
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-foreground-muted">
            Accessibility QA
          </p>
          <h1 className="text-2xl font-semibold">Forced-colors / high-contrast demo</h1>
          <p className="max-w-2xl text-sm text-foreground-muted">
            This page renders the same badge, toggle, and control patterns that should remain legible under Windows High Contrast and forced-colors media queries.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <SignalBadge signal="BUY" />
            <SignalBadge signal="SELL" />
            <SignalBadge signal="NEUTRAL" />
            <PremiumSignalBadge hasAccess />
            <PremiumSignalBadge hasAccess={false} requiredStake={2500} />
            <DemoModeToggle />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <PositionLimitToggle portfolioBalance={12000} />
        </section>
      </div>
    </main>
  );
}
