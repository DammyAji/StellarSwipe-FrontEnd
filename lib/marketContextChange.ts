export const MATERIAL_MARKET_MOVE_PERCENT = 2;
export const MARKET_CONTEXT_MAX_AGE_MS = 5 * 60 * 1000;

export interface MarketContextQuote {
  pair: string;
  price: number | null;
  observedAt: string | null;
  source?: string | null;
}

export type MarketContextStatus = "loading" | "ready" | "empty" | "error";

export interface MarketContextSnapshot {
  status: MarketContextStatus;
  reference?: MarketContextQuote | null;
  current?: MarketContextQuote | null;
  /** Human-readable description of the reference, e.g. "Recommendation issued". */
  referenceLabel?: string | null;
  error?: string | null;
}

export type MarketContextAssessment =
  | { comparable: false; reason: string }
  | {
      comparable: true;
      changePercent: number;
      materiallyChanged: boolean;
      referenceTime: number;
      currentTime: number;
    };

function parseValidTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Compares two trustworthy quotes without changing a recommendation's status.
 * A current quote must be recent, and both quotes must refer to the same pair.
 */
export function assessMarketContextChange(
  reference: MarketContextQuote | null | undefined,
  current: MarketContextQuote | null | undefined,
  referenceLabel: string | null | undefined,
  now = Date.now(),
  thresholdPercent = MATERIAL_MARKET_MOVE_PERCENT,
): MarketContextAssessment {
  if (!reference || !current) {
    return { comparable: false, reason: "Reference or current quote is unavailable." };
  }
  if (!referenceLabel?.trim()) {
    return { comparable: false, reason: "The quote reference is unavailable." };
  }
  if (!reference.pair.trim() || !current.pair.trim() || reference.pair.trim() !== current.pair.trim()) {
    return { comparable: false, reason: "Quote pairs do not match." };
  }
  if (!isValidPrice(reference.price) || !isValidPrice(current.price)) {
    return { comparable: false, reason: "A valid reference and current price are required." };
  }

  const referenceTime = parseValidTime(reference.observedAt);
  const currentTime = parseValidTime(current.observedAt);
  if (referenceTime === null || currentTime === null) {
    return { comparable: false, reason: "Quote timestamps are unavailable or invalid." };
  }
  if (referenceTime > now || currentTime > now) {
    return { comparable: false, reason: "A quote timestamp is in the future." };
  }
  if (now - currentTime > MARKET_CONTEXT_MAX_AGE_MS) {
    return { comparable: false, reason: "The current quote is too old to compare." };
  }

  const changePercent = Number(
    (((current.price - reference.price) / reference.price) * 100).toFixed(4),
  );
  return {
    comparable: true,
    changePercent,
    materiallyChanged: Math.abs(changePercent) >= thresholdPercent,
    referenceTime,
    currentTime,
  };
}
