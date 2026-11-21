"use client";

import { Component, useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Battery,
  Cpu,
  Globe,
  MousePointerClick,
  Timer,
  Wifi,
} from "lucide-react";
import { usePerformanceMonitoringStore } from "@/store/usePerformanceMonitoringStore";
import type { NetworkConnectionType } from "@/lib/performance/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { TableDensityControl } from "@/components/TableDensityControl";
import { usePerformanceTableDensity } from "@/store/usePerformanceTableDensityStore";
import { TABLE_DENSITY_CLASSES, type TableDensity } from "@/lib/tableDensity";
import { cn } from "@/lib/utils";

function formatMs(ms: number): string {
  return `${ms} ms`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <Icon className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums text-foreground">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-foreground-muted">{sub}</div>}
    </div>
  );
}

function NetworkRow({
  type,
  count,
  avgApiMs,
  density,
}: {
  type: NetworkConnectionType;
  count: number;
  avgApiMs: number;
  density: TableDensity;
}) {
  const cell = TABLE_DENSITY_CLASSES[density].cell;
  const label =
    type === "wifi"
      ? "WiFi"
      : type === "cellular"
      ? "Mobile data"
      : type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <tr className="bg-white/5">
      <td className={cn("rounded-l-lg break-words text-foreground-muted", cell)}>{label}</td>
      <td className={cn("rounded-r-lg text-right tabular-nums text-foreground", cell)}>
        {count} calls · avg {avgApiMs} ms
      </td>
    </tr>
  );
}

function HeatmapCanvas({ points }: { points: { x: number; y: number }[] }) {
  if (points.length === 0) {
    return (
      <div className="p-3">
        <EmptyState
          title="No interactions recorded yet"
          description="Interact with the app and this heatmap will populate automatically."
          className="h-full rounded-lg bg-transparent py-6"
        />
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-slate-900"
      role="img"
      aria-label={`Interaction heatmap: ${points.length} recorded interactions, concentrated toward ${
        points.reduce((a, b) => a + b.y, 0) / points.length < 50 ? "the top" : "the bottom"
      } of the screen`}
    >
      {points.map((p, i) => (
        <div
          key={`${p.x}-${p.y}-${i}`}
          aria-hidden="true"
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/40 blur-sm"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        />
      ))}
    </div>
  );
}

type WidgetStatus = "loading" | "ready" | "error";

interface WidgetBoundaryProps {
  title: string;
  status: WidgetStatus;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Isolates a single dashboard widget: a failure inside one widget renders a
 * local retry state instead of taking down the whole dashboard, and retrying
 * only re-mounts that widget.
 */
class WidgetBoundary extends Component<
  WidgetBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prevProps: WidgetBoundaryProps) {
    if (prevProps.status !== this.props.status && this.props.status !== "error") {
      if (this.state.failed) this.setState({ failed: false });
    }
  }

  private handleRetry = () => {
    this.setState({ failed: false });
    this.props.onRetry();
  };

  render() {
    if (this.state.failed || this.props.status === "error") {
      return (
        <ErrorState
          title={`${this.props.title} unavailable`}
          description="This widget could not load. Other widgets are unaffected."
          onRetry={this.handleRetry}
          className="rounded-xl bg-transparent py-8"
        />
      );
    }

    if (this.props.status === "loading") {
      return <LoadingState label={`Loading ${this.props.title.toLowerCase()}…`} variant="inline" />;
    }

    return this.props.children;
  }
}

function useWidgetStatus() {
  const [status, setStatus] = useState<WidgetStatus>("ready");

  const retry = useCallback(() => {
    setStatus("loading");
    window.setTimeout(() => setStatus("ready"), 300);
  }, []);

  return { status, retry };
}

function WidgetSection({
  title,
  icon: Icon,
  iconClassName = "text-sky-400",
  isEmpty,
  emptyTitle,
  emptyDescription,
  status,
  onRetry,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  status: WidgetStatus;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
        <Icon className={`h-4 w-4 ${iconClassName}`} />
        {title}
      </h2>
      {isEmpty ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          className="rounded-xl bg-transparent py-6"
        />
      ) : (
        <WidgetBoundary title={title} status={status} onRetry={onRetry}>
          {children}
        </WidgetBoundary>
      )}
    </section>
  );
}

export function PerformanceDashboard() {
  const consent = usePerformanceMonitoringStore((s) => s.consent);
  const setConsent = usePerformanceMonitoringStore((s) => s.setConsent);
  const summary = usePerformanceMonitoringStore((s) => s.getSummary());
  const [tableDensity, setTableDensity] = usePerformanceTableDensity();
  const densityClasses = TABLE_DENSITY_CLASSES[tableDensity];
  const routeWidget = useWidgetStatus();
  const networkWidget = useWidgetStatus();
  const heatmapWidget = useWidgetStatus();
  const crashWidget = useWidgetStatus();

  const routeStats = useMemo(() => {
    const byRoute = new Map<string, number[]>();
    for (const entry of summary.routeLoads) {
      const list = byRoute.get(entry.route) ?? [];
      list.push(entry.loadTimeMs);
      byRoute.set(entry.route, list);
    }
    return Array.from(byRoute.entries()).map(([route, times]) => ({
      route,
      avgMs: avg(times),
      count: times.length,
    }));
  }, [summary.routeLoads]);

  const avgApiMs = avg(summary.apiResponses.map((e) => e.durationMs));
  const latestMemory = summary.memorySamples.at(-1);
  const latestBattery = summary.batterySamples.at(-1);
  const device = summary.device;

  if (consent === "pending") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <Activity className="mx-auto mb-3 h-8 w-8 text-sky-400" />
        <h2 className="text-lg font-semibold">Consent required</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Enable anonymous performance monitoring to view metrics on this page.
        </p>
        <button
          type="button"
          onClick={() => setConsent("granted")}
          className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Enable monitoring
        </button>
      </div>
    );
  }

  if (consent === "denied") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <h2 className="text-lg font-semibold">Monitoring disabled</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          You declined performance monitoring. You can enable it anytime.
        </p>
        <button
          type="button"
          onClick={() => setConsent("granted")}
          className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Enable monitoring
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-8"
      data-print-report
      data-print-title="StellarSwipe Performance Report"
      data-print-subtitle={`Generated ${new Date().toLocaleDateString()}`}
      data-print-date={new Date().toLocaleDateString()}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Avg page load"
          value={formatMs(avg(summary.routeLoads.map((r) => r.loadTimeMs)))}
          icon={Timer}
          sub={`${summary.routeLoads.length} samples`}
        />
        <StatCard
          label="Avg API response"
          value={formatMs(avgApiMs)}
          icon={Globe}
          sub={`${summary.apiResponses.length} requests`}
        />
        <StatCard
          label="Memory usage"
          value={
            latestMemory?.usedMb != null ? `${latestMemory.usedMb} MB` : "N/A"
          }
          icon={Cpu}
          sub={
            latestMemory?.totalMb != null
              ? `of ${latestMemory.totalMb} MB heap`
              : "Chrome only"
          }
        />
        <StatCard
          label="Battery"
          value={
            latestBattery?.level != null ? `${latestBattery.level}%` : "N/A"
          }
          icon={Battery}
          sub={
            latestBattery?.charging != null
              ? latestBattery.charging
                ? "Charging"
                : "On battery"
              : "API unavailable"
          }
        />
      </div>

      {device && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            <Cpu className="h-4 w-4 text-sky-400" />
            Device &amp; OS breakdown
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-foreground-muted">OS</dt>
              <dd className="font-medium">{device.os}</dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Device</dt>
              <dd className="font-medium capitalize">{device.deviceType}</dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Screen</dt>
              <dd className="font-medium">
                {device.screenWidth}×{device.screenHeight}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Network</dt>
              <dd className="font-medium capitalize">{device.networkType}</dd>
            </div>
          </dl>
        </section>
      )}

      <div className="flex justify-end" data-print-hide>
        <TableDensityControl
          value={tableDensity}
          onChange={setTableDensity}
          label="Performance table density"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetSection
          title="Page load time by route"
          icon={Timer}
          isEmpty={routeStats.length === 0}
          emptyTitle="No route data yet"
          emptyDescription="Route load timings will appear after you navigate through the app."
          status={routeWidget.status}
          onRetry={routeWidget.retry}
        >
          <table
            className={cn("w-full border-separate", densityClasses.table)}
            data-density={tableDensity}
          >
            <caption className="sr-only">Average page load time by route</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">Route</th>
                <th scope="col" className="sr-only">Average load time and sample count</th>
              </tr>
            </thead>
            <tbody>
              {routeStats.map((r) => (
                <tr key={r.route} className="bg-white/5">
                  <td className={cn("rounded-l-lg break-all", densityClasses.cell)}>
                    <Link href={r.route} className="font-mono text-sky-400 hover:underline">
                      {r.route}
                    </Link>
                  </td>
                  <td className={cn("rounded-r-lg text-right tabular-nums text-foreground", densityClasses.cell)}>
                    {r.avgMs} ms · {r.count}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WidgetSection>

        <WidgetSection
          title="Network type impact"
          icon={Wifi}
          isEmpty={summary.apiResponses.length === 0}
          emptyTitle="No API data yet"
          emptyDescription="API response metrics will appear once requests are captured."
          status={networkWidget.status}
          onRetry={networkWidget.retry}
        >
          <table
            className={cn("w-full border-separate", densityClasses.table)}
            data-density={tableDensity}
          >
            <caption className="sr-only">API calls and average response time by network type</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">Network type</th>
                <th scope="col" className="sr-only">Call count and average response time</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(summary.networkBreakdown) as [
                NetworkConnectionType,
                { count: number; avgApiMs: number },
              ][])
                .filter(([, v]) => v.count > 0)
                .map(([type, stats]) => (
                  <NetworkRow
                    key={type}
                    type={type}
                    count={stats.count}
                    avgApiMs={stats.avgApiMs}
                    density={tableDensity}
                  />
                ))}
            </tbody>
          </table>
        </WidgetSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetSection
          title="Interaction heatmap"
          icon={MousePointerClick}
          isEmpty={false}
          emptyTitle="No interactions recorded yet"
          emptyDescription="Interact with the app and this heatmap will populate automatically."
          status={heatmapWidget.status}
          onRetry={heatmapWidget.retry}
        >
          <HeatmapCanvas points={summary.heatmap} />
        </WidgetSection>

        <WidgetSection
          title="Crash reports"
          icon={AlertTriangle}
          iconClassName="text-red-400"
          isEmpty={summary.crashes.length === 0}
          emptyTitle="No crashes recorded"
          emptyDescription="Great news: no crash reports were captured in this session."
          status={crashWidget.status}
          onRetry={crashWidget.retry}
        >
          <ul className="max-h-80 space-y-3 overflow-y-auto">
              {summary.crashes
                .slice()
                .reverse()
                .map((crash) => (
                  <li
                    key={crash.id}
                    className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs"
                  >
                    <div className="font-semibold text-red-400">
                      {crash.message}
                    </div>
                    <div className="mt-1 text-foreground-muted">
                      {crash.route} ·{" "}
                      {new Date(crash.timestamp).toLocaleString()}
                    </div>
                    {crash.stack && (
                      <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-foreground-muted">
                        {crash.stack}
                      </pre>
                    )}
                    {crash.sessionSnapshot.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-foreground-muted">
                          Session recording ({crash.sessionSnapshot.length}{" "}
                          events)
                        </summary>
                        <ol className="mt-1 list-inside list-decimal space-y-0.5 text-[10px] text-foreground-muted">
                          {crash.sessionSnapshot.slice(-10).map((e, i) => (
                            <li key={i}>
                              [{e.type}] {e.label}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
        </WidgetSection>
      </div>
    </div>
  );
}
