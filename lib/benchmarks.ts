import type { PricePoint } from "@/hooks/usePriceHistory";

/**
 * Registry of benchmarks that portfolio performance can be compared against.
 * Each entry carries the source metadata surfaced in the benchmark selector,
 * chart legends, summaries and exports (#784).
 */

export type BenchmarkGroup = "Stellar assets" | "Stablecoins" | "Indices";

export type BenchmarkStatus = "available" | "stale" | "unavailable";

export interface BenchmarkDefinition {
  id: string;
  /** Short label used in legends, e.g. "XLM". */
  label: string;
  /** Longer label used in the selector and summaries. */
  name: string;
  group: BenchmarkGroup;
  /** Price history asset used to derive the benchmark series. */
  asset: string;
  /** Unit the benchmark is quoted in. */
  unit: string;
  source: string;
  sourceUrl?: string;
  methodology: string;
  /** How often the source publishes new values. */
  updateFrequency: string;
  /** Epoch ms of the last value received from the source. */
  lastUpdated: number;
  status: BenchmarkStatus;
  /** Reason shown when the benchmark is stale or unavailable. */
  statusReason?: string;
  /** Fee assumptions applied to derive the fee-adjusted benchmark series. */
  feeAssumptions?: BenchmarkFeeAssumptions;
}

/**
 * Fee inputs used to derive a fee-adjusted benchmark series (#1112). Values are
 * expressed as decimal fractions (0.001 = 10 bps) so they can be applied
 * directly to returns.
 */
export interface BenchmarkFeeAssumptions {
  /** Annual management/expense fee charged by the benchmark vehicle. */
  managementFee: number;
  /** Per-trade fee applied when rebalancing or transacting. */
  tradingFee: number;
  /** Annualised slippage/spread cost assumed on top of trading fees. */
  slippage: number;
  /** How often the benchmark is rebalanced, used to annualise trading costs. */
  rebalanceFrequency: "none" | "monthly" | "quarterly" | "annually";
  /** Free-form note surfaced alongside the adjusted values. */
  note?: string;
}

export type FeeDataStatus = "complete" | "partial" | "unavailable";

export interface BenchmarkFeeInfo {
  /** Whether every fee input needed for an adjusted series is present. */
  status: FeeDataStatus;
  /** The assumptions that are available (may be a subset). */
  assumptions: Partial<BenchmarkFeeAssumptions>;
  /** Human-readable list of the inputs that are missing. */
  missingInputs: string[];
  /** True only when an adjusted series can be computed without guessing. */
  canAdjust: boolean;
}

export const DEFAULT_BENCHMARK_ID = "xlm";

const HOUR = 60 * 60 * 1000;

export const BENCHMARKS: BenchmarkDefinition[] = [
  {
    id: "xlm",
    label: "XLM",
    name: "Stellar Lumens (XLM)",
    group: "Stellar assets",
    asset: "XLM",
    unit: "USD",
    source: "Stellar DEX (Horizon trade aggregations)",
    sourceUrl: "https://developers.stellar.org/docs/data/horizon",
    methodology: "Daily close of XLM/USDC trades, volume-weighted.",
    updateFrequency: "Every 5 minutes",
    lastUpdated: Date.now() - 5 * 60 * 1000,
    status: "available",
    feeAssumptions: {
      managementFee: 0,
      tradingFee: 0.001,
      slippage: 0.0005,
      rebalanceFrequency: "none",
      note: "Spot XLM has no management fee; DEX trading fees and spread are included.",
    },
  },
  {
    id: "yxlm",
    label: "yXLM",
    name: "Ultra Stellar yXLM",
    group: "Stellar assets",
    asset: "yXLM",
    unit: "USD",
    source: "Stellar DEX (Horizon trade aggregations)",
    sourceUrl: "https://developers.stellar.org/docs/data/horizon",
    methodology: "Daily close of yXLM/USDC trades, volume-weighted.",
    updateFrequency: "Every 15 minutes",
    lastUpdated: Date.now() - 20 * 60 * 1000,
    status: "available",
    feeAssumptions: {
      managementFee: 0.01,
      tradingFee: 0.001,
      slippage: 0.0005,
      rebalanceFrequency: "none",
      note: "1% annual management fee plus DEX trading costs.",
    },
  },
  {
    id: "aqua",
    label: "AQUA",
    name: "Aquarius (AQUA)",
    group: "Stellar assets",
    asset: "AQUA",
    unit: "USD",
    source: "Aquarius AMM pools",
    sourceUrl: "https://aqua.network",
    methodology: "Daily close of the AQUA/USDC AMM pool price.",
    updateFrequency: "Hourly",
    lastUpdated: Date.now() - 7 * HOUR,
    status: "stale",
    statusReason: "The source has not published a new value in over 6 hours.",
    feeAssumptions: {
      managementFee: 0.02,
      tradingFee: 0.003,
      slippage: 0.001,
      rebalanceFrequency: "monthly",
      note: "2% annual management fee; monthly rebalancing costs are annualised.",
    },
  },
  {
    id: "usdc",
    label: "USDC",
    name: "USD Coin (USDC)",
    group: "Stablecoins",
    asset: "USDC",
    unit: "USD",
    source: "Circle attestation reports",
    sourceUrl: "https://www.circle.com/usdc",
    methodology: "Pegged 1:1 to USD; used as a cash-equivalent baseline.",
    updateFrequency: "Daily",
    lastUpdated: Date.now() - 3 * HOUR,
    status: "available",
    feeAssumptions: {
      managementFee: 0,
      tradingFee: 0,
      slippage: 0,
      rebalanceFrequency: "none",
      note: "Cash-equivalent baseline; no fees applied.",
    },
  },
  {
    id: "stellar-top10",
    label: "Stellar Top 10",
    name: "Stellar Top 10 Index",
    group: "Indices",
    asset: "STELLAR10",
    unit: "Index points",
    source: "StellarSwipe Research",
    methodology:
      "Market-cap weighted basket of the 10 most liquid Stellar assets, rebalanced monthly.",
    updateFrequency: "Daily at 00:00 UTC",
    lastUpdated: Date.now() - 30 * HOUR,
    status: "unavailable",
    statusReason: "The index provider is temporarily not publishing data.",
    feeAssumptions: {
      managementFee: 0.005,
      tradingFee: 0.002,
      rebalanceFrequency: "monthly",
      note: "0.5% annual management fee; slippage is not published by the provider.",
    },
  },
];

export const BENCHMARK_GROUPS: BenchmarkGroup[] = [
  "Stellar assets",
  "Stablecoins",
  "Indices",
];

export function getBenchmark(id: string | null | undefined): BenchmarkDefinition | undefined {
  if (!id) return undefined;
  return BENCHMARKS.find((b) => b.id === id);
}

export function isBenchmarkUsable(benchmark: BenchmarkDefinition | undefined): boolean {
  return Boolean(benchmark) && benchmark!.status !== "unavailable";
}

const FEE_INPUT_LABELS: Record<keyof BenchmarkFeeAssumptions, string> = {
  managementFee: "management fee",
  tradingFee: "trading fee",
  slippage: "slippage",
  rebalanceFrequency: "rebalance frequency",
  note: "note",
};

const REQUIRED_FEE_INPUTS: (keyof BenchmarkFeeAssumptions)[] = [
  "managementFee",
  "tradingFee",
  "slippage",
  "rebalanceFrequency",
];

/**
 * Reports which fee inputs are available for a benchmark so the comparison UI
 * can disclose incomplete fee data instead of presenting adjusted values as
 * fact (#1112).
 */
export function getBenchmarkFeeInfo(
  benchmark: BenchmarkDefinition | undefined
): BenchmarkFeeInfo {
  const assumptions = benchmark?.feeAssumptions ?? {};
  const missingInputs = REQUIRED_FEE_INPUTS.filter(
    (key) => assumptions[key] === undefined || assumptions[key] === null
  ).map((key) => FEE_INPUT_LABELS[key]);

  const presentCount = REQUIRED_FEE_INPUTS.length - missingInputs.length;
  let status: FeeDataStatus;
  if (presentCount === REQUIRED_FEE_INPUTS.length) status = "complete";
  else if (presentCount === 0) status = "unavailable";
  else status = "partial";

  return {
    status,
    assumptions,
    missingInputs,
    canAdjust: status === "complete",
  };
}

/** True when a fee-adjusted series can be derived without guessing inputs. */
export function hasCompleteFeeData(
  benchmark: BenchmarkDefinition | undefined
): boolean {
  return getBenchmarkFeeInfo(benchmark).canAdjust;
}

/**
 * Disclosure text describing the fee assumptions behind an adjusted series.
 * Always states that adjusted values are estimates and names any missing
 * inputs so incomplete fee data is never hidden.
 */
export function formatBenchmarkFeeDisclosure(
  benchmark: BenchmarkDefinition | undefined
): string {
  const info = getBenchmarkFeeInfo(benchmark);
  const { assumptions } = info;

  if (info.status === "unavailable") {
    return "Fee-adjusted values are unavailable: no fee assumptions are published for this benchmark. Showing gross values only.";
  }

  const parts: string[] = [];
  if (assumptions.managementFee !== undefined) {
    parts.push(`${formatPercent(assumptions.managementFee)} annual management fee`);
  }
  if (assumptions.tradingFee !== undefined) {
    parts.push(`${formatPercent(assumptions.tradingFee)} per-trade fee`);
  }
  if (assumptions.slippage !== undefined) {
    parts.push(`${formatPercent(assumptions.slippage)} slippage`);
  }
  if (assumptions.rebalanceFrequency !== undefined) {
    parts.push(
      assumptions.rebalanceFrequency === "none"
        ? "no rebalancing"
        : `${assumptions.rebalanceFrequency} rebalancing`
    );
  }

  const summary = parts.length > 0 ? parts.join(", ") : "no fee inputs";
  const note = assumptions.note ? ` ${assumptions.note}` : "";

  if (info.status === "partial") {
    return `Adjusted values are estimates based on ${summary}.${note} Incomplete fee data: ${info.missingInputs.join(", ")} not published, so adjusted values may be overstated.`;
  }

  return `Adjusted values are estimates based on ${summary}.${note}`;
}

function formatPercent(value: number): string {
  const pct = value * 100;
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}

/** Case-insensitive search across label, name, group and source. */
export function searchBenchmarks(query: string): BenchmarkDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return BENCHMARKS;
  return BENCHMARKS.filter((b) =>
    [b.label, b.name, b.group, b.source].some((field) =>
      field.toLowerCase().includes(q)
    )
  );
}

export function groupBenchmarks(
  list: BenchmarkDefinition[]
): { group: BenchmarkGroup; items: BenchmarkDefinition[] }[] {
  return BENCHMARK_GROUPS.map((group) => ({
    group,
    items: list.filter((b) => b.group === group),
  })).filter((g) => g.items.length > 0);
}

/** Human-readable freshness such as "Updated 5 min ago". */
export function formatBenchmarkFreshness(
  benchmark: BenchmarkDefinition,
  now: number = Date.now()
): string {
  const diff = Math.max(0, now - benchmark.lastUpdated);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

/**
 * Derives a benchmark price series from the base XLM history. The mock data
 * layer only exposes one reference history, so other benchmarks are modelled
 * as deterministic transforms of it. Swap for real feeds when available.
 */
export function deriveBenchmarkPrices(
  benchmark: BenchmarkDefinition,
  baseHistory: PricePoint[]
): PricePoint[] {
  if (benchmark.id === "usdc") {
    return baseHistory.map((p) => ({ timestamp: p.timestamp, price: 1 }));
  }
  const factor: Record<string, { beta: number; drift: number }> = {
    xlm: { beta: 1, drift: 0 },
    yxlm: { beta: 1.02, drift: 0.0004 },
    aqua: { beta: 1.8, drift: -0.001 },
    "stellar-top10": { beta: 0.7, drift: 0.0008 },
  };
  const { beta, drift } = factor[benchmark.id] ?? { beta: 1, drift: 0 };
  const start = baseHistory[0]?.price ?? 1;
  return baseHistory.map((p, i) => {
    const change = (p.price - start) / start;
    return {
      timestamp: p.timestamp,
      price: parseFloat((start * (1 + change * beta + drift * i)).toFixed(6)),
    };
  });
}
