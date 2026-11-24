import React, { useCallback, useEffect, useRef, useState } from 'react';

export type StellarNetwork = 'mainnet' | 'testnet';

export interface TransactionReceiptData {
  hash?: string | null;
  asset?: string | null;
  amount?: string | number | null;
  time?: string | Date | null;
  status?: string | null;
  network?: StellarNetwork | null;
  /** Confirmed amount actually received/sent, distinct from any estimate. */
  actualAmount?: string | number | null;
  /** Confirmed fee actually paid, distinct from any estimate. */
  actualFee?: string | number | null;
  /** Estimated amount, shown separately from the confirmed actual amount. */
  estimatedAmount?: string | number | null;
  /** Estimated fee, shown separately from the confirmed actual fee. */
  estimatedFee?: string | number | null;
}

export interface TransactionReceiptProps {
  transaction: TransactionReceiptData;
  network?: StellarNetwork;
}

const EXPLORER_BASE: Record<StellarNetwork, string> = {
  mainnet: 'https://stellar.expert/explorer/public/tx',
  testnet: 'https://stellar.expert/explorer/testnet/tx',
};

function resolveNetwork(
  explicit: StellarNetwork | undefined,
  fromTx: StellarNetwork | null | undefined,
): StellarNetwork {
  if (explicit === 'mainnet' || explicit === 'testnet') return explicit;
  if (fromTx === 'mainnet' || fromTx === 'testnet') return fromTx;
  return 'mainnet';
}

export function buildExplorerUrl(
  hash: string | null | undefined,
  network: StellarNetwork = 'mainnet',
): string | null {
  if (!hash || typeof hash !== 'string') return null;
  const trimmed = hash.trim();
  if (!trimmed) return null;
  const base = EXPLORER_BASE[network] ?? EXPLORER_BASE.mainnet;
  return `${base}/${encodeURIComponent(trimmed)}`;
}

function formatTime(time: string | Date | null | undefined): string | null {
  if (!time) return null;
  const date = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatAmount(amount: string | number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  const str = String(amount).trim();
  return str ? str : null;
}

function formatFee(fee: string | number | null | undefined): string | null {
  const formatted = formatAmount(fee);
  return formatted === null ? null : formatted;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="receipt-field">
      <dt className="receipt-field__label">{label}</dt>
      <dd className="receipt-field__value">
        {value === null ? <span className="receipt-field__unavailable">Unavailable</span> : value}
      </dd>
    </div>
  );
}

const CONFIRMED_STATUSES = new Set(['confirmed', 'success', 'succeeded', 'complete', 'completed']);

function isConfirmedStatus(status: string | null): boolean {
  if (!status) return false;
  return CONFIRMED_STATUSES.has(status.trim().toLowerCase());
}

type CopyState = 'idle' | 'success' | 'error' | 'unavailable';

function HashField({ hash, confirmed }: { hash: string | null; confirmed: boolean }) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), 4000);
  }, []);

  const selectHash = useCallback(() => {
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!hash || !confirmed) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        setCopyState('unavailable');
        selectHash();
        scheduleReset();
        return;
      }
      await navigator.clipboard.writeText(hash);
      setCopyState('success');
      scheduleReset();
    } catch {
      setCopyState('error');
      selectHash();
      scheduleReset();
    }
  }, [hash, confirmed, scheduleReset, selectHash]);

  const canCopy = Boolean(hash) && confirmed;

  let feedback: string | null = null;
  if (copyState === 'success') feedback = 'Transaction hash copied to clipboard.';
  else if (copyState === 'error')
    feedback = 'Could not copy automatically. The hash is selected — press Ctrl+C or Cmd+C to copy.';
  else if (copyState === 'unavailable')
    feedback = 'Clipboard unavailable. The hash is selected — press Ctrl+C or Cmd+C to copy.';

  return (
    <div className="receipt-field">
      <dt className="receipt-field__label">Transaction hash</dt>
      <dd className="receipt-field__value">
        {hash === null ? (
          <span className="receipt-field__unavailable">Unavailable</span>
        ) : (
          <span className="receipt-field__hash">
            <input
              ref={inputRef}
              className="receipt-field__hash-input"
              type="text"
              readOnly
              value={hash}
              aria-label="Transaction hash"
              onFocus={(event) => event.currentTarget.select()}
            />
            {canCopy ? (
              <button
                type="button"
                className="receipt-field__copy"
                onClick={handleCopy}
                aria-label="Copy transaction hash"
              >
                Copy
              </button>
            ) : (
              <span className="receipt-field__copy-unavailable">Copy unavailable until confirmed</span>
            )}
          </span>
        )}
      </dd>
      <span className="receipt-field__feedback" role="status" aria-live="polite">
        {feedback}
      </span>
    </div>
  );
}

export default function TransactionReceipt({ transaction, network }: TransactionReceiptProps) {
  const resolvedNetwork = resolveNetwork(network, transaction.network);
  const hash = transaction.hash && transaction.hash.trim() ? transaction.hash.trim() : null;
  const explorerUrl = buildExplorerUrl(hash, resolvedNetwork);
  const asset = transaction.asset && transaction.asset.trim() ? transaction.asset.trim() : null;
  const amount = formatAmount(transaction.amount);
  const time = formatTime(transaction.time);
  const status = transaction.status && transaction.status.trim() ? transaction.status.trim() : null;
  const actualAmount = formatAmount(transaction.actualAmount);
  const actualFee = formatFee(transaction.actualFee);
  const estimatedAmount = formatAmount(transaction.estimatedAmount);
  const estimatedFee = formatFee(transaction.estimatedFee);

  return (
    <section className="transaction-receipt" aria-label="Transaction receipt">
      <h2 className="transaction-receipt__title">Transaction receipt</h2>
      <dl className="transaction-receipt__fields">
        <HashField hash={hash} confirmed={confirmed} />
        <Field label="Asset" value={asset} />
        <Field label="Amount" value={amount} />
        <Field label="Time" value={time} />
        <Field label="Status" value={status} />
      </dl>
      <h3 className="transaction-receipt__subtitle">Confirmed actuals</h3>
      <dl className="transaction-receipt__fields transaction-receipt__fields--actual">
        <Field label="Actual amount" value={actualAmount} />
        <Field label="Actual fee" value={actualFee} />
      </dl>
      {estimatedAmount !== null || estimatedFee !== null ? (
        <>
          <h3 className="transaction-receipt__subtitle">Estimates</h3>
          <dl className="transaction-receipt__fields transaction-receipt__fields--estimated">
            <Field label="Estimated amount" value={estimatedAmount} />
            <Field label="Estimated fee" value={estimatedFee} />
          </dl>
        </>
      ) : null}
      {explorerUrl ? (
        <a
          className="transaction-receipt__explorer-link"
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Stellar explorer ({resolvedNetwork})
        </a>
      ) : (
        <p className="transaction-receipt__explorer-unavailable">
          Explorer link unavailable
        </p>
      )}
    </section>
  );
}
