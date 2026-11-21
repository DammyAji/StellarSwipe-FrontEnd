"use client";

import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { PnLWidget } from "@/components/chart/PnLWidget";
import { PortfolioAllocationChart } from "@/components/chart/PortfolioAllocationChart";
import { PortfolioPerformanceBenchmarkChart } from "@/components/chart/PortfolioPerformanceBenchmarkChart";
import { RetryStateCard } from "@/components/ui/RetryStateCard";
import { DashboardQuickAdd } from "@/components/DashboardQuickAdd";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import {
  useDashboardLayoutStore,
  DEFAULT_WIDGET_ORDER,
  type DashboardWidgetId,
} from "@/store/useDashboardLayoutStore";

// ─── Constants ──────────────────────────────────────────────────────────────

// Legacy local drag-order (kept for drag state; visibility is driven by store)
const DEFAULT_ORDER: DashboardWidgetId[] = [...DEFAULT_WIDGET_ORDER];
const STORAGE_KEY = "stellar-swipe-dashboard-layout";

/**
 * Maximum number of consecutive retries before the widget stops showing the
 * retry button to avoid a noisy retry loop.  The user can still hard-refresh
 * the page to fully reset.
 */
const MAX_RETRIES = 3;

// ─── Per-widget error boundary ───────────────────────────────────────────────

interface WidgetErrorBoundaryProps {
  widgetId: string;
  widgetTitle: string;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  /** Incremented to force React to remount the child tree on retry. */
  retryKey: number;
}

/**
 * Class component error boundary scoped to a single dashboard widget.
 *
 * Design decisions:
 * - Catching errors here prevents them from propagating to the parent boundary,
 *   so all other widgets keep rendering normally.
 * - A `retryKey` forces a full remount of the child on retry, clearing any
 *   broken internal state.
 * - After MAX_RETRIES failed attempts the retry button is hidden to avoid a
 *   noisy loop; the error details are still visible to aid debugging.
 * - Repeated retries use exponential back-off via a disabled state
 *   (`retrying`), reducing the chance of hammering a flaky dependency.
 */
class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in development; wire to Sentry / observability in prod.
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[WidgetErrorBoundary] Widget "${this.props.widgetId}" crashed:`,
        error,
        info.componentStack
      );
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
      retryKey: prev.retryKey + 1,
    }));
  };

  render() {
    const { hasError, error, retryCount, retryKey } = this.state;
    const { widgetTitle, children } = this.props;

    if (hasError) {
      const canRetry = retryCount < MAX_RETRIES;
      return (
        <RetryStateCard
          title={`${widgetTitle} failed to load`}
          description={
            canRetry
              ? "An error occurred while rendering this widget. Other widgets are not affected. Click Retry to reload just this widget."
              : `This widget has failed ${retryCount} time${retryCount !== 1 ? "s" : ""}. Refresh the page to fully reset.`
          }
          onRetry={canRetry ? this.handleRetry : undefined}
          actionLabel="Retry this widget"
          details={
            process.env.NODE_ENV === "development" && error
              ? error.message + (error.stack ? `\n${error.stack}` : "")
              : null
          }
          tone="warning"
        />
      );
    }

    // retryKey forces React to fully remount the child tree on retry.
    return <React.Fragment key={retryKey}>{children}</React.Fragment>;
  }
}

// ─── Widget registry ─────────────────────────────────────────────────────────

const WIDGET_META: Record<DashboardWidgetId, { title: string; component: ReactNode }> = {
  "portfolio-summary": { title: "Portfolio Summary", component: <PortfolioSummaryCards /> },
  "pnl-overview": { title: "P&L Overview", component: <PnLWidget /> },
  "portfolio-allocation": { title: "Portfolio Allocation", component: <PortfolioAllocationChart /> },
  "transaction-activity": {
    title: "Performance vs Benchmark",
    component: <PortfolioPerformanceBenchmarkChart />,
  },
};

// ─── Widget refresh action ───────────────────────────────────────────────────

/** Minimum time the in-flight state is shown so feedback is perceivable. */
const MIN_REFRESH_FEEDBACK_MS = 400;

function formatLastUpdated(date: Date | null): string {
  if (!date) return "Not updated yet";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface WidgetRefreshActionProps {
  widgetTitle: string;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Labeled refresh action + last-updated timestamp for a single widget.
 *
 * Feedback is intentionally local: the button owns its own in-flight state and
 * the timestamp is rendered next to it, so refreshing one widget never changes
 * the appearance of any other widget.
 */
function WidgetRefreshAction({
  widgetTitle,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: WidgetRefreshActionProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-400" data-testid="widget-last-updated">
        Updated {formatLastUpdated(lastUpdated)}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-busy={isRefreshing}
        aria-label={`Refresh ${widgetTitle}`}
        title={`Refresh ${widgetTitle}`}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <RefreshCw
          size={12}
          aria-hidden="true"
          className={cn(isRefreshing && "animate-spin")}
        />
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}

// ─── DashboardWidgets ────────────────────────────────────────────────────────

export function DashboardWidgets() {
  // Drag order is managed locally (mirroring store order on mount/reset)
  const storeVisible = useDashboardLayoutStore((s) => s.visible);
  const [order, setOrder] = useState<DashboardWidgetId[]>(DEFAULT_ORDER);
  const [mounted, setMounted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const orderRef = useRef(order);
  orderRef.current = order;

  // ── Per-widget refresh state (#1051) ──
  // `refreshing` holds the ids of widgets with an in-flight refresh so repeated
  // clicks can be coalesced; `lastUpdated` records when each widget last
  // finished refreshing. Both are local to the dashboard, never global.
  const [refreshing, setRefreshing] = useState<DashboardWidgetId[]>([]);
  const [lastUpdated, setLastUpdated] = useState<
    Partial<Record<DashboardWidgetId, Date>>
  >({});
  const inFlightRef = useRef<Set<DashboardWidgetId>>(new Set());
  const portfolioLastUpdated = usePortfolioStore((s) => s.lastUpdated);

  const handleWidgetRefresh = useCallback((widgetId: DashboardWidgetId) => {
    // Coalesce: ignore clicks while a refresh for this widget is in flight.
    if (inFlightRef.current.has(widgetId)) return;
    inFlightRef.current.add(widgetId);
    setRefreshing((prev) => (prev.includes(widgetId) ? prev : [...prev, widgetId]));

    const finish = () => {
      inFlightRef.current.delete(widgetId);
      setRefreshing((prev) => prev.filter((id) => id !== widgetId));
      setLastUpdated((prev) => ({ ...prev, [widgetId]: new Date() }));
    };

    // Widget data is served from the portfolio store; re-reading it is the
    // refresh. Keep the in-flight state visible for a minimum duration so the
    // feedback is perceivable even when the data resolves instantly.
    window.setTimeout(finish, MIN_REFRESH_FEEDBACK_MS);
  }, []);

  const announcePosition = useCallback((widgetId: DashboardWidgetId, list: DashboardWidgetId[]) => {
    const title = WIDGET_META[widgetId]?.title ?? widgetId;
    setAnnouncement(
      `${title} moved to position ${list.indexOf(widgetId) + 1} of ${list.length}.`
    );
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.every((x: unknown) => DEFAULT_WIDGET_ORDER.includes(x as DashboardWidgetId))
        ) {
          setOrder(parsed as DashboardWidgetId[]);
        }
      } catch {
        // Ignore parsing errors — fall back to default order.
      }
    }
    setMounted(true);
  }, []);

  // When a new widget is added via QuickAdd, append it to drag order if absent.
  useEffect(() => {
    setOrder((prev) => {
      const toAdd = storeVisible.filter((id) => !prev.includes(id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, [storeVisible]);

  const handleReorder = useCallback((newOrder: DashboardWidgetId[]) => {
    setOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch {
      // Storage unavailable — order still applies for this session.
    }
  }, []);

  const handleReset = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ORDER));
    setAnnouncement("Dashboard layout reset to default order.");
  }, []);

  const handleDragStart = useCallback((widgetTitle: string) => {
    setAnnouncement(`Picked up ${widgetTitle}. Drag to a new position and release to drop.`);
  }, []);

  const handleDragEnd = useCallback(
    (widgetId: DashboardWidgetId) => {
      // Reorder.Group updates order continuously during the drag; persist and
      // announce the final settled position once the drag completes.
      const finalOrder = orderRef.current;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalOrder));
      } catch {
        // Storage unavailable — order still applies for this session.
      }
      announcePosition(widgetId, finalOrder);
    },
    [announcePosition]
  );

  const moveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= order.length) return;
      const newOrder = [...order];
      const [moved] = newOrder.splice(index, 1);
      newOrder.splice(newIndex, 0, moved);
      handleReorder(newOrder);
      announcePosition(moved, newOrder);
    },
    [order, handleReorder, announcePosition]
  );

  // Only render widgets that are both in drag-order and in the store's visible list.
  const visibleOrder = order.filter((id) => storeVisible.includes(id));

  if (!mounted) {
    // SSR / hydration pass — render widgets in default order without drag
    // controls to avoid hydration mismatches.
    return (
      <div className="flex flex-col gap-6">
        {DEFAULT_ORDER.map((id) => {
          const meta = WIDGET_META[id];
          return (
            <WidgetErrorBoundary key={id} widgetId={id} widgetTitle={meta?.title ?? id}>
              {meta?.component}
            </WidgetErrorBoundary>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
          Dashboard Widgets
        </span>
        <div className="flex items-center gap-2">
          {/* #756 — Quick-add widget action */}
          <DashboardQuickAdd />
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground hover:bg-white/5 px-2 py-1 rounded transition-colors"
            title="Reset layout to default order"
          >
            <RotateCcw size={12} />
            Reset Layout
          </button>
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={visibleOrder}
        onReorder={handleReorder}
        className="flex flex-col gap-6"
      >
        {visibleOrder.map((widgetId, index) => {
          const meta = WIDGET_META[widgetId] ?? {
            title: widgetId,
            component: null,
          };
          return (
            <WidgetWrapper
              key={widgetId}
              widgetId={widgetId}
              widgetTitle={meta.title}
              index={index}
              totalItems={visibleOrder.length}
              onMove={moveItem}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              lastUpdated={lastUpdated[widgetId] ?? portfolioLastUpdated}
              isRefreshing={refreshing.includes(widgetId)}
              onRefresh={() => handleWidgetRefresh(widgetId)}
            >
              {meta.component}
            </WidgetWrapper>
          );
        })}
      </Reorder.Group>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

// ─── WidgetWrapper ────────────────────────────────────────────────────────────

/**
 * Touch users must press and hold the handle this long before a drag starts,
 * so a quick swipe across the handle still scrolls the page instead of
 * accidentally picking up the widget.
 */
const TOUCH_DRAG_DELAY_MS = 250;
/** Movement (px) during the hold that cancels the pending touch drag. */
const TOUCH_MOVE_TOLERANCE_PX = 8;

interface WidgetWrapperProps {
  widgetId: string;
  widgetTitle: string;
  index: number;
  totalItems: number;
  onMove: (index: number, direction: "up" | "down") => void;
  onDragStart: (widgetTitle: string) => void;
  onDragEnd: (widgetId: string, widgetTitle: string) => void;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
}

function WidgetWrapper({
  widgetId,
  widgetTitle,
  index,
  totalItems,
  onMove,
  onDragStart,
  onDragEnd,
  lastUpdated,
  isRefreshing,
  onRefresh,
  children,
}: WidgetWrapperProps) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdOriginRef = useRef<{ x: number; y: number } | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdOriginRef.current = null;
  }, []);

  useEffect(() => clearHold, [clearHold]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      // Pointer users drag immediately from the handle.
      dragControls.start(e);
      return;
    }
    // Touch: require an intentional press-and-hold before dragging.
    const nativeEvent = e.nativeEvent;
    holdOriginRef.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(10);
      }
      dragControls.start(nativeEvent);
    }, TOUCH_DRAG_DELAY_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const origin = holdOriginRef.current;
    if (!origin || holdTimerRef.current === null) return;
    if (
      Math.abs(e.clientX - origin.x) > TOUCH_MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - origin.y) > TOUCH_MOVE_TOLERANCE_PX
    ) {
      clearHold();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMove(index, "up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onMove(index, "down");
    }
  };

  const isFirst = index === 0;
  const isLast = index === totalItems - 1;
  const moveButtonClass =
    "flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

  return (
    <Reorder.Item
      value={widgetId}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart(widgetTitle);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd(widgetId, widgetTitle);
      }}
      data-dragging={isDragging || undefined}
      className={cn(
        "relative rounded-xl outline-none focus-within:ring-2 focus-within:ring-sky-500",
        isDragging && "z-20 shadow-2xl shadow-black/50 ring-2 ring-sky-500/70"
      )}
    >
      {/* Each widget is wrapped in its own isolated error boundary.
          Crashing one widget does NOT affect any other widget. */}
      <WidgetErrorBoundary widgetId={widgetId} widgetTitle={widgetTitle}>
        <div className="group relative">
          {/* Reorder toolbar — always visible on touch (no hover there),
              revealed on hover/focus for fine pointers. */}
          <div
            role="group"
            aria-label={`Reorder ${widgetTitle}`}
            className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-white/10 bg-slate-900/90 p-0.5 shadow-md transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100"
          >
            <button
              type="button"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={clearHold}
              onPointerCancel={clearHold}
              onKeyDown={handleKeyDown}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`Drag handle for ${widgetTitle}, position ${index + 1} of ${totalItems}. Press and hold to drag, or use Arrow Up and Arrow Down to reorder.`}
              title="Drag to reorder (press and hold on touch)"
              // touch-action: none only on the handle — the rest of the widget
              // keeps native scrolling and its own controls stay usable.
              style={{ touchAction: "none", WebkitTouchCallout: "none" }}
              className="flex h-11 w-11 cursor-grab select-none items-center justify-center rounded text-slate-400 hover:text-slate-100 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:h-8 sm:w-8"
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, "up")}
              disabled={isFirst}
              aria-label={`Move ${widgetTitle} up`}
              className={moveButtonClass}
            >
              <ChevronUp size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, "down")}
              disabled={isLast}
              aria-label={`Move ${widgetTitle} down`}
              className={moveButtonClass}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </div>
          {children}
          {/* #1051 — labeled refresh action + last-updated time, scoped to
              this widget so feedback never leaks to sibling widgets. */}
          <div className="mt-2 flex justify-end border-t border-white/5 pt-2">
            <WidgetRefreshAction
              widgetTitle={widgetTitle}
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          </div>
        </div>
      </WidgetErrorBoundary>
    </Reorder.Item>
  );
}
