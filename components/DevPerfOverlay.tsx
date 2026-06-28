"use client";

/**
 * DevPerfOverlay
 *
 * A lightweight performance-budget overlay that is ONLY rendered in
 * development builds (process.env.NODE_ENV !== "production").
 *
 * Metrics shown:
 *  - Frame / render time (via requestAnimationFrame delta)
 *  - API latency (last fetch duration, patched via PerformanceObserver)
 *  - React Query cache hit status (stale vs fresh)
 *
 * The overlay is unobtrusive: fixed to the bottom-right corner, semi-transparent,
 * and can be minimised with a single click.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PerfMetrics {
  frameMs: number;
  apiLatencyMs: number | null;
  cacheHit: boolean | null;
}

const INITIAL_METRICS: PerfMetrics = {
  frameMs: 0,
  apiLatencyMs: null,
  cacheHit: null,
};

function useFrameTime() {
  const [frameMs, setFrameMs] = useState(0);
  const lastRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function tick(now: number) {
      if (lastRef.current !== 0) {
        setFrameMs(Math.round(now - lastRef.current));
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return frameMs;
}

function useApiLatency() {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntriesByType("resource") as PerformanceResourceTiming[];
      const apiEntries = entries.filter(
        (e) => e.initiatorType === "fetch" && e.name.includes("/api/")
      );
      if (apiEntries.length > 0) {
        const last = apiEntries[apiEntries.length - 1];
        setLatency(Math.round(last.duration));
      }
    });

    try {
      observer.observe({ type: "resource", buffered: true });
    } catch {
      // PerformanceObserver not supported in this environment
    }

    return () => observer.disconnect();
  }, []);

  return latency;
}

function useCacheHitStatus() {
  const queryClient = useQueryClient();
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);

  useEffect(() => {
    function check() {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      if (queries.length === 0) {
        setCacheHit(null);
        return;
      }
      // A query is a "cache hit" when it has data and is not currently fetching
      const hits = queries.filter((q) => q.state.data !== undefined && !q.state.fetchStatus);
      setCacheHit(hits.length > 0);
    }

    check();
    const unsubscribe = queryClient.getQueryCache().subscribe(check);
    return () => unsubscribe();
  }, [queryClient]);

  return cacheHit;
}

function MetricRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "good" | "warn" | "bad" | "neutral";
}) {
  const statusColor =
    status === "good"
      ? "text-emerald-400"
      : status === "warn"
      ? "text-yellow-400"
      : status === "bad"
      ? "text-red-400"
      : "text-slate-300";

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-mono font-semibold tabular-nums", statusColor)}>{value}</span>
    </div>
  );
}

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  startTime: number;
  duration: number | null;
  status: number | null;
}

const MAX_REQUESTS = 25;
let requests: NetworkRequest[] = [];
const listeners = new Set<() => void>();

function addRequest(req: NetworkRequest) {
  requests.push(req);
  if (requests.length > MAX_REQUESTS) {
    requests.shift();
  }
  listeners.forEach((l) => l());
}

function updateRequest(id: string, updates: Partial<NetworkRequest>) {
  requests = requests.map((r) => (r.id === id ? { ...r, ...updates } : r));
  listeners.forEach((l) => l());
}

function clearRequests() {
  requests = [];
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const originalFetch = window.fetch;
  let requestIdCounter = 0;

  window.fetch = async function (input, init) {
    const id = `req_${++requestIdCounter}_${Date.now()}`;
    const startTime = performance.now();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const method = init?.method ?? "GET";

    addRequest({
      id,
      url,
      method,
      startTime,
      duration: null,
      status: null,
    });

    try {
      const response = await originalFetch(input, init);
      const endTime = performance.now();
      updateRequest(id, {
        duration: Math.round(endTime - startTime),
        status: response.status,
      });
      return response;
    } catch (error) {
      const endTime = performance.now();
      updateRequest(id, {
        duration: Math.round(endTime - startTime),
        status: 0,
      });
      throw error;
    }
  };
}

function useNetworkRequests() {
  const [list, setList] = useState<NetworkRequest[]>([]);

  useEffect(() => {
    setList([...requests]);
    const listener = () => setList([...requests]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return list;
}

export function DevPerfOverlay() {
  // Hard-guard: never render in production
  if (process.env.NODE_ENV === "production") return null;

  return <DevPerfOverlayInner />;
}

function DevPerfOverlayInner() {
  const frameMs = useFrameTime();
  const apiLatency = useApiLatency();
  const cacheHit = useCacheHitStatus();
  const [minimised, setMinimised] = useState(false);
  const [showWaterfall, setShowWaterfall] = useState(false);
  const list = useNetworkRequests();

  const frameStatus =
    frameMs === 0
      ? "neutral"
      : frameMs <= 16
      ? "good"
      : frameMs <= 33
      ? "warn"
      : "bad";

  const latencyStatus =
    apiLatency === null
      ? "neutral"
      : apiLatency < 200
      ? "good"
      : apiLatency < 500
      ? "warn"
      : "bad";

  const cacheStatus =
    cacheHit === null ? "neutral" : cacheHit ? "good" : "warn";

  return (
    <div
      role="complementary"
      aria-label="Performance metrics overlay (dev mode only)"
      className={cn(
        "fixed bottom-4 right-4 z-[9999] flex items-end gap-3 select-none text-[11px]"
      )}
    >
      {/* Waterfall Panel */}
      {showWaterfall && !minimised && (
        <div className="w-80 rounded-xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-sm flex flex-col max-h-80">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="font-semibold text-slate-300">Network Waterfall</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearRequests}
                className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowWaterfall(false)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
            {list.length === 0 ? (
              <div className="text-slate-500 text-center py-4">No requests captured</div>
            ) : (
              (() => {
                const nowVal = performance.now();
                const requestTimes = list.map((r) => {
                  const start = r.startTime;
                  const end =
                    r.startTime + (r.duration !== null ? r.duration : nowVal - r.startTime);
                  return { start, end };
                });
                const minStart =
                  requestTimes.length > 0 ? Math.min(...requestTimes.map((t) => t.start)) : 0;
                const maxEnd =
                  requestTimes.length > 0 ? Math.max(...requestTimes.map((t) => t.end)) : 100;
                const totalDuration = maxEnd - minStart || 1;

                return list.map((r, idx) => {
                  const times = requestTimes[idx];
                  const leftPercent = ((times.start - minStart) / totalDuration) * 100;
                  const widthPercent = Math.max(((times.end - times.start) / totalDuration) * 100, 2);

                  let displayUrl = r.url;
                  try {
                    const urlObj = new URL(r.url, window.location.origin);
                    displayUrl = urlObj.pathname + urlObj.search;
                  } catch {}

                  // Limit URL display length
                  if (displayUrl.length > 35) {
                    displayUrl = "..." + displayUrl.slice(-32);
                  }

                  const statusColor =
                    r.status === null
                      ? "text-sky-400"
                      : r.status >= 200 && r.status < 300
                      ? "text-emerald-400"
                      : r.status >= 400
                      ? "text-red-400"
                      : "text-yellow-400";

                  return (
                    <div key={r.id} className="space-y-0.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-[9px] font-mono">
                        <span className="text-slate-400 truncate max-w-[180px]" title={r.url}>
                          <span className="text-slate-600 mr-1">{r.method}</span>
                          {displayUrl}
                        </span>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <span className={statusColor}>
                            {r.status === null ? "pending" : r.status}
                          </span>
                          <span className="text-slate-500">
                            {r.duration === null ? "" : `${r.duration}ms`}
                          </span>
                        </div>
                      </div>
                      {/* Waterfall visual bar */}
                      <div className="relative h-1.5 w-full bg-slate-800/50 rounded-sm overflow-hidden">
                        <div
                          className={cn(
                            "absolute h-full rounded-sm transition-all duration-150",
                            r.status === null
                              ? "bg-sky-500 animate-pulse"
                              : r.status >= 200 && r.status < 300
                              ? "bg-emerald-500"
                              : r.status >= 400
                              ? "bg-red-500"
                              : "bg-yellow-500"
                          )}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      )}

      {/* Main Overlay Card */}
      <div
        className={cn(
          "border border-white/10 bg-slate-950/90 rounded-xl shadow-2xl shadow-black/60 backdrop-blur-sm transition-all",
          minimised ? "w-auto" : "w-52"
        )}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setMinimised((v) => !v)}
          aria-expanded={!minimised}
          aria-label={minimised ? "Expand performance overlay" : "Minimise performance overlay"}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Activity size={11} className="text-sky-400" aria-hidden="true" />
            {!minimised && "Perf"}
            <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-400">
              DEV
            </span>
          </span>
          {minimised ? (
            <ChevronUp size={11} className="text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronDown size={11} className="text-slate-500" aria-hidden="true" />
          )}
        </button>

        {/* Metrics */}
        {!minimised && (
          <div className="border-t border-white/10 px-3 py-2 space-y-1.5">
            <MetricRow
              label="Frame time"
              value={frameMs === 0 ? "—" : `${frameMs} ms`}
              status={frameStatus}
            />
            <MetricRow
              label="API latency"
              value={apiLatency === null ? "—" : `${apiLatency} ms`}
              status={latencyStatus}
            />
            <MetricRow
              label="Cache"
              value={cacheHit === null ? "—" : cacheHit ? "HIT" : "MISS"}
              status={cacheStatus}
            />
            <button
              type="button"
              onClick={() => setShowWaterfall((v) => !v)}
              className="flex items-center justify-between w-full text-left py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
            >
              <span>Network Waterfall</span>
              <span className="text-sky-400 font-mono">{list.length} reqs</span>
            </button>
            <div className="pt-1 border-t border-white/5 text-[10px] text-slate-600">
              Hidden in production
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

