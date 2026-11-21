'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TradeQuote } from '@/lib/trade/quote';

interface TradeReviewProps {
  quote: TradeQuote | null;
  amount: string;
  onRefreshQuote: (amount: string) => Promise<TradeQuote>;
  onConfirm: (quote: TradeQuote) => void | Promise<void>;
  onCancel?: () => void;
}

function isQuoteExpired(quote: TradeQuote | null): boolean {
  if (!quote) return true;
  if (quote.expiresAt == null) return false;
  const expiresAt =
    typeof quote.expiresAt === 'number'
      ? quote.expiresAt
      : new Date(quote.expiresAt).getTime();
  return Number.isFinite(expiresAt) ? Date.now() >= expiresAt : false;
}

export default function TradeReview({
  quote,
  amount,
  onRefreshQuote,
  onConfirm,
  onCancel,
}: TradeReviewProps) {
  const [expired, setExpired] = useState<boolean>(() => isQuoteExpired(quote));
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [activeQuote, setActiveQuote] = useState<TradeQuote | null>(quote);

  useEffect(() => {
    setActiveQuote(quote);
    setExpired(isQuoteExpired(quote));
    setRefreshError(null);
  }, [quote]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const nextQuote = await onRefreshQuote(amount);
      setActiveQuote(nextQuote);
      setExpired(isQuoteExpired(nextQuote));
    } catch (err) {
      setRefreshError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to refresh the quote. Please try again.',
      );
    } finally {
      setRefreshing(false);
    }
  }, [amount, onRefreshQuote]);

  const canConfirm = !expired && !refreshing && activeQuote != null;

  return (
    <section
      className="trade-review flex flex-col gap-3 max-[900px]:landscape:gap-2"
      aria-label="Trade review"
    >
      <h2>Review trade</h2>

      <dl className="trade-review__summary">
        <div>
          <dt>Amount</dt>
          <dd>{amount}</dd>
        </div>
        {activeQuote ? (
          <div>
            <dt>Rate</dt>
            <dd>{activeQuote.rate}</dd>
          </div>
        ) : null}
      </dl>

      {expired ? (
        <div className="trade-review__expired" role="alert">
          <p>
            This quote has expired. Signing is disabled until you refresh to get
            an up-to-date quote.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
          >
            {refreshing ? 'Refreshing quote…' : 'Refresh quote'}
          </button>
        </div>
      ) : null}

      {refreshError ? (
        <div className="trade-review__error" role="alert">
          <p>{refreshError}</p>
          <p>Your entered amount has been kept. You can retry the refresh.</p>
          <button type="button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Retrying…' : 'Retry refresh'}
          </button>
        </div>
      ) : null}

      <div className="trade-review__actions flex flex-wrap gap-2 max-[900px]:landscape:flex-row-reverse max-[900px]:landscape:justify-start">
        <button
          type="button"
          onClick={() => activeQuote && onConfirm(activeQuote)}
          disabled={!canConfirm}
        >
          Confirm trade
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={refreshing}>
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
