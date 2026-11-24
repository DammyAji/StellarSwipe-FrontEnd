"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
// Ref-based in-flight flag ensures only one confirm request is sent per user
// action — covers both the button click and the Enter-key shortcut paths.
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Info,
  AlertCircle,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { isTopOverlay } from "@/hooks/overlayManager";
import { useDemoModeStore } from "@/store/useDemoModeStore";
import { usePositionLimitStore } from "@/store/usePositionLimitStore";
import { useTradePresetsStore } from "@/store/useTradePresetsStore";
import { TradePresetEditor } from "@/components/TradePresetEditor";
import { useWalletStore } from "@/store/useWalletStore";
import { FeeDisclosurePanel } from "@/components/FeeDisclosurePanel";
import { SlippageWarning } from "@/components/SlippageWarning";
import { usePriceFormat } from "@/hooks/usePriceFormat";
import { validateTradeField } from "@/lib/tradeSchemas";
import { useNetworkMismatch } from "@/components/NetworkMismatchBanner";
import { NetworkSwitchDialog } from "@/components/NetworkSwitchDialog";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { WalletSelectionModal } from "@/components/WalletSelectionModal";
import {
  isTradeWalletEligible,
  resolvePreferredTradeWallet,
} from "@/lib/tradeWalletSelection";
import { useQuoteStatus } from "@/hooks/useQuoteStatus";
import { useTradeEntryModeStore } from "@/store/useTradeEntryModeStore";
import { roundStellarAmount } from "@/lib/stellarAmount";

function truncateKey(key: string) {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

type ModalStep = "input" | "review" | "optimistic";

type OrderType = "LIMIT" | "MARKET";

export interface PositionDetails {
  amount: string;
  price: number;
  orderType: OrderType;
  walletPublicKey: string;
}

/** Market price snapshot. `expiresAt` is epoch ms; omit when validity is unknown. */
export interface TradeQuote {
  price: number;
  expiresAt?: number;
  /** Total quote fees in display currency, when the quote provides them. */
  fees?: number;
}

interface TradeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: (details: PositionDetails) => void;
  walletBalance?: number;
  marketPrice?: number;
  portfolioBalance?: number;
  /** Current quote; its price overrides `marketPrice` and its expiry gates confirmation. */
  quote?: TradeQuote;
  /** Fetches a fresh quote. On rejection the draft is kept and the error is shown. */
  onRefreshQuote?: () => Promise<TradeQuote>;
}

const mockBuildTx = (_order: object) =>
  new Promise<void>((res) =>
    setTimeout(() => {
      res();
    }, 800)
  );

// The order form only trades XLM today; it is part of the draft context so a
// draft can never be restored into a different asset.
const ASSET_CODE = "XLM";
const TRADE_DRAFT_PREFIX = "trade-draft:";

interface TradeDraftFields {
  type: OrderType;
  limitPrice: string;
  amount: string;
  stopLoss: number;
  positionLimit: boolean;
}

interface TradeDraft extends TradeDraftFields {
  /** Asset, network and wallet the draft was entered under. */
  context: string;
}

const DEFAULT_DRAFT: TradeDraftFields = {
  type: "LIMIT",
  limitPrice: "",
  amount: "",
  stopLoss: 10,
  positionLimit: false,
};

function isDefaultDraft(fields: TradeDraftFields): boolean {
  return (Object.keys(DEFAULT_DRAFT) as (keyof TradeDraftFields)[]).every(
    (key) => fields[key] === DEFAULT_DRAFT[key]
  );
}

function readTradeDraft(
  key: string,
  context: string
): TradeDraftFields | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as TradeDraft;
    if (!draft || draft.context !== context) return null;
    return {
      type: draft.type === "MARKET" ? "MARKET" : "LIMIT",
      limitPrice: typeof draft.limitPrice === "string" ? draft.limitPrice : "",
      amount: typeof draft.amount === "string" ? draft.amount : "",
      stopLoss: typeof draft.stopLoss === "number" ? draft.stopLoss : 10,
      positionLimit: draft.positionLimit === true,
    };
  } catch {
    return null;
  }
}

function writeTradeDraft(
  key: string,
  context: string,
  fields: TradeDraftFields
) {
  try {
    if (isDefaultDraft(fields)) {
      localStorage.removeItem(key);
      return;
    }
    const draft: TradeDraft = { context, ...fields };
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage unavailable — the draft is simply not kept.
  }
}

function clearTradeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export function TradeModal({
  open,
  onClose,
  onConfirm,
  walletBalance = 250,
  marketPrice: marketPriceProp = 0.4821,
  portfolioBalance = 0,
  quote,
  onRefreshQuote,
}: TradeModalProps) {
  const [step, setStep] = useState<ModalStep>("input");
  const [type, setType] = useState<OrderType>("LIMIT");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [stopLoss, setStopLoss] = useState(10);
  const [positionLimit, setPositionLimit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ limitPrice: false, amount: false });
  // Slippage warning: shown when estimated slippage exceeds threshold
  const [slippageAcknowledged, setSlippageAcknowledged] = useState(false);
  // Stores the failure message when on-chain confirmation fails after optimistic success
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [editingPresets, setEditingPresets] = useState(false);
  const { presets: sizePresets } = useTradePresetsStore();
  // Quote fetched via onRefreshQuote; takes precedence over the `quote` prop
  const [refreshedQuote, setRefreshedQuote] = useState<TradeQuote | null>(null);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  // Clock for the quote countdown; only ticks while a quote with expiry is shown
  const [now, setNow] = useState(() => Date.now());
  // Prerequisite actions (#1075): connect a wallet / switch network without
  // losing the order the user is reviewing.
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);
  const [selectedTradeWallet, setSelectedTradeWallet] = useState("");
  const [tradeWalletInitialized, setTradeWalletInitialized] = useState(false);
  // Entry mode: asset units (XLM) or display currency (USDC). New forms start
  // in the user's saved default; switching preserves the value where possible.
  const defaultEntryMode = useTradeEntryModeStore((s) => s.defaultMode);
  const [entryMode, setEntryMode] = useState<"asset" | "currency">("asset");
  const [currencyAmount, setCurrencyAmount] = useState("");
  const { isDemoMode } = useDemoModeStore();
  const walletNetworkDraft = useWalletStore((s) => s.network);
  const wallets = useWalletStore((s) => s.wallets);
  const defaultTradeWalletPublicKey = useWalletStore(
    (s) => s.defaultTradeWalletPublicKey
  );
  const walletConnected = useWalletStore((s) => s.isConnected);
  const draftContext = `${ASSET_CODE}:${walletNetworkDraft}:${selectedTradeWallet}`;
  const draftKey = `${TRADE_DRAFT_PREFIX}${draftContext}`;
  const { enabled: positionLimitEnabled, percentage: positionLimitPercentage } =
    usePositionLimitStore();
  const {
    isMismatch: networkMismatch,
    walletNetwork,
    appNetwork,
    state: networkState,
  } = useNetworkMismatch();
  const walletReady = isTradeWalletEligible(
    selectedTradeWallet,
    wallets,
    walletConnected && tradeWalletInitialized
  );
  const walletKey = walletReady ? selectedTradeWallet : null;
  const selectedWalletNickname =
    wallets.find((wallet) => wallet.publicKey === walletKey)?.nickname;
  const networkLabel = networkMismatch
    ? walletNetwork
    : networkState.status === "match"
    ? appNetwork
    : "Unverified";
  const fmt = usePriceFormat();

  // Live-region ref for announcing order-type changes to screen readers
  const liveRegionRef = useRef<HTMLSpanElement>(null);

  /**
   * In-flight ref for the confirm action.
   * Using a ref (not just `submitting` state) so the guard check is
   * synchronous — closing the window between a React re-render and the
   * next event, which could otherwise allow a second submission to slip
   * through on rapid double-click or quick Enter-key presses.
   */
  const confirmInFlightRef = useRef(false);

  // Calculate position limit in USD value
  const positionLimitInUSD = useMemo(() => {
    if (!positionLimitEnabled || !portfolioBalance) return null;
    return (portfolioBalance * positionLimitPercentage) / 100;
  }, [positionLimitEnabled, portfolioBalance, positionLimitPercentage]);

  const limitPriceError =
    type === "LIMIT" && touched.limitPrice
      ? validateTradeField(limitPrice, "Limit price")
      : "";
  const amountError = touched.amount
    ? validateTradeField(amount, "Amount")
    : "";

  const focusTrapRef = useFocusTrap({
    isActive: open,
    initialFocus: 'button[data-order-type="LIMIT"]',
  });

  const activeQuote = refreshedQuote ?? quote;
  const marketPrice = activeQuote?.price ?? marketPriceProp;
  const quoteExpiresAt = activeQuote?.expiresAt;
  const quoteSecondsLeft =
    quoteExpiresAt !== undefined
      ? Math.max(0, Math.ceil((quoteExpiresAt - now) / 1000))
      : null;
  const quoteExpired = quoteSecondsLeft === 0;
  const quoteStatus = useQuoteStatus(activeQuote);

  const price = type === "MARKET" ? marketPrice : parseFloat(limitPrice) || 0;

  // Exact Stellar amount actually submitted. Asset precision rules may round
  // the user's input; the review discloses any difference.
  const enteredAmount = parseFloat(amount) || 0;
  const submittedAmount = roundStellarAmount(enteredAmount);
  const amountRounded = submittedAmount !== enteredAmount;
  const total = price * submittedAmount;
  const insufficient = total > walletBalance;
  const exceedsPositionLimit =
    positionLimitEnabled &&
    positionLimitInUSD !== null &&
    total > positionLimitInUSD;
  const hasErrors = !!amountError || (type === "LIMIT" && !!limitPriceError);

  // Estimate slippage: market orders use a fixed proxy; limit orders use
  // the deviation between the user's limit price and the current market price.
  const estimatedSlippage =
    type === "MARKET"
      ? 0.12 // proxy for AMM price impact shown in footer
      : price > 0
      ? Math.abs((price - marketPrice) / marketPrice) * 100
      : 0;
  const SLIPPAGE_THRESHOLD = 1; // percent
  const showSlippageWarning =
    estimatedSlippage > SLIPPAGE_THRESHOLD && !slippageAcknowledged && !!amount;

  const disabled =
    !amount ||
    (type === "LIMIT" && !limitPrice) ||
    insufficient ||
    exceedsPositionLimit ||
    submitting ||
    hasErrors ||
    showSlippageWarning ||
    networkMismatch ||
    !walletReady;

  // Prerequisites that must be met before the order can be reviewed (#1075).
  // The review step is only reachable once both are satisfied, so the user is
  // never asked to confirm an order they cannot sign.
  const prerequisitesMet = walletReady && !networkMismatch;
  const reviewDisabled = disabled || !prerequisitesMet;

  // Start each new trade with the saved default only if that account is still
  // connected. A missing/stale default leaves the selector unchosen.
  useEffect(() => {
    if (!open) {
      setTradeWalletInitialized(false);
      return;
    }

    const walletState = useWalletStore.getState();
    setSelectedTradeWallet(
      resolvePreferredTradeWallet(
        walletState.defaultTradeWalletPublicKey,
        walletState.wallets,
        walletState.isConnected,
      ) ?? "",
    );
    setTradeWalletInitialized(true);
  }, [open]);

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      setStep("input");
      setTouched({ limitPrice: false, amount: false });
      setSlippageAcknowledged(false);
      setConfirmError(null);
      setRefreshedQuote(null);
      setQuoteError(null);
      setEntryMode(defaultEntryMode);
      setCurrencyAmount("");
    }
  }, [open, defaultEntryMode]);

  // Restore the unfinished draft for this asset/network/wallet. A draft from
  // another context is never applied, so the fields fall back to defaults.
  // Skip the next save so the restored values aren't written back mid-load.
  const skipDraftSaveRef = useRef(false);
  useEffect(() => {
    if (!open || !tradeWalletInitialized) return;
    const draft = readTradeDraft(draftKey, draftContext) ?? DEFAULT_DRAFT;
    skipDraftSaveRef.current = true;
    setType(draft.type);
    setLimitPrice(draft.limitPrice);
    setAmount(draft.amount);
    setStopLoss(draft.stopLoss);
    setPositionLimit(draft.positionLimit);
  }, [open, tradeWalletInitialized, draftKey, draftContext]);

  // Persist entry fields so leaving the trade flow doesn't lose them.
  useEffect(() => {
    if (!open) return;
    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false;
      return;
    }
    writeTradeDraft(draftKey, draftContext, {
      type,
      limitPrice,
      amount,
      stopLoss,
      positionLimit,
    });
  }, [
    open,
    draftKey,
    draftContext,
    type,
    limitPrice,
    amount,
    stopLoss,
    positionLimit,
  ]);

  // Tick the quote countdown once a second while an expiring quote is shown
  useEffect(() => {
    if (!open || quoteExpiresAt === undefined) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, quoteExpiresAt]);

  // Switching or disconnecting the wallet invalidates the review: the order was
  // reviewed against the previous account, so send the user back to the input step.
  // Skipped while submitting so an in-flight confirm is not interrupted.
  // The entered order is kept, so returning after connecting/switching lands
  // back on the same order (#1075).
  const walletKeyRef = useRef(walletKey);
  useEffect(() => {
    if (walletKeyRef.current === walletKey) return;
    walletKeyRef.current = walletKey;
    if (submitting) return;
    setStep((s) => (s === "review" ? "input" : s));
    setSlippageAcknowledged(false);
    setConfirmError(null);
  }, [walletKey, submitting]);

  // If a chosen account disconnects while a trade is being reviewed, clear
  // only the per-trade choice; never silently fall back to another account.
  useEffect(() => {
    if (
      !selectedTradeWallet ||
      isTradeWalletEligible(selectedTradeWallet, wallets, walletConnected) ||
      submitting
    ) {
      return;
    }
    setSelectedTradeWallet("");
    setStep((currentStep) => (currentStep === "review" ? "input" : currentStep));
    setSlippageAcknowledged(false);
    setConfirmError(null);
  }, [selectedTradeWallet, wallets, walletConnected, submitting]);

  // A network switch also invalidates the review (the order was priced on the
  // previous network); keep the entered order and return to the input step.
  const networkRef = useRef(walletNetwork);
  useEffect(() => {
    if (networkRef.current === walletNetwork) return;
    networkRef.current = walletNetwork;
    setStep((s) => (s === "review" ? "input" : s));
    setConfirmError(null);
  }, [walletNetwork]);

  // Keyboard shortcuts: Escape → close, Enter (outside interactive elements) → confirm
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only close when this modal is the topmost overlay.
        const el = focusTrapRef.current as HTMLElement | null;
        if (isTopOverlay(el)) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      // Enter shortcut to confirm — only on the review step and only when focus
      // is NOT on a button/link/input (those handle Enter natively). This
      // intentionally does NOT trigger from the input step so users must
      // explicitly reach the review step before confirming.
      // Also guarded by `disabled` and `submitting` to prevent double-fire.
      if (
        e.key === "Enter" &&
        step === "review" &&
        !disabled &&
        !submitting &&
        !quoteExpired
      ) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        const role = (e.target as HTMLElement)?.getAttribute("role");
        const isInteractive =
          tag === "button" ||
          tag === "a" ||
          tag === "input" ||
          tag === "select" ||
          tag === "textarea" ||
          role === "button" ||
          role === "switch";
        if (!isInteractive) {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, disabled, submitting, quoteExpired, onClose]);

  // Preset buttons: set amount to N% of wallet balance divided by current price
  const applyPreset = useCallback(
    (pct: number) => {
      if (!price) return;
      const xlm = (walletBalance * pct) / 100 / price;
      setAmount(xlm.toFixed(2));
      setCurrencyAmount((xlm * price).toFixed(2));
      setTouched((t) => ({ ...t, amount: true }));
    },
    [price, walletBalance]
  );

  // Switch entry mode. Preserve the value using the active quote/price; when no
  // price is available, request a fresh quote rather than guessing a value.
  const handleEntryModeChange = useCallback(
    async (nextMode: "asset" | "currency") => {
      if (nextMode === entryMode) return;
      if (!price) {
        setQuoteError(
          "A current price is needed to switch entry mode. Refresh the quote to continue."
        );
        if (onRefreshQuote) await handleRefreshQuote();
        return;
      }
      if (nextMode === "currency") {
        setCurrencyAmount((enteredAmount * price).toFixed(2));
      } else {
        setAmount((parseFloat(currencyAmount) / price || 0).toFixed(2));
      }
      setEntryMode(nextMode);
    },
    [entryMode, price, enteredAmount, currencyAmount, onRefreshQuote, handleRefreshQuote]
  );

  // Refresh the quote; on failure the draft (inputs and step) is left untouched
  const handleRefreshQuote = useCallback(async () => {
    if (!onRefreshQuote || quoteRefreshing || submitting) return;
    setQuoteRefreshing(true);
    setQuoteError(null);
    try {
      setRefreshedQuote(await onRefreshQuote());
    } catch (err) {
      setQuoteError(
        (err as Error).message ||
          "Could not refresh the quote. Your order details are unchanged."
      );
    } finally {
      setQuoteRefreshing(false);
    }
  }, [onRefreshQuote, quoteRefreshing, submitting]);

  const handleConfirm = useCallback(async () => {
    if (disabled || quoteExpired) return;
    const latestWalletState = useWalletStore.getState();
    const tradeWalletPublicKey = isTradeWalletEligible(
      selectedTradeWallet,
      latestWalletState.wallets,
      latestWalletState.isConnected,
    )
      ? selectedTradeWallet
      : null;
    if (!tradeWalletPublicKey) {
      setConfirmError(
        "The selected account is no longer connected. Go back and choose a connected account."
      );
      return;
    }
    // Guard: ignore if a confirmation is already in-flight
    if (confirmInFlightRef.current) return;
    confirmInFlightRef.current = true;
    setConfirmError(null);
    // Optimistic: immediately show success UI before on-chain confirmation
    setStep("optimistic");
    setSubmitting(true);
    try {
      // Server revalidates balance, network, amount and slippage before submission
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: tradeWalletPublicKey,
          network: walletNetwork,
          orderType: type,
          amount: String(submittedAmount),
          price,
          slippagePercent: estimatedSlippage,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Trade was rejected by the server.");
      }
      await mockBuildTx({
        type,
        price,
        amount,
        stopLoss,
        positionLimit,
        publicKey: tradeWalletPublicKey,
      });
    } catch (err) {
      // Rollback: revert to review step and surface a distinct failure message.
      // Only submission errors land here; once the order is placed, a failure
      // in the caller's onConfirm must not send the user back to resubmit it.
      setSubmitting(false);
      confirmInFlightRef.current = false;
      setStep("review");
      setConfirmError(
        (err as Error).message ||
          "Transaction confirmation failed. Your order was not placed."
      );
      return;
    }
    setSubmitting(false);
    confirmInFlightRef.current = false;
    clearTradeDraft(draftKey);
    onConfirm
      ? onConfirm({
          amount: String(submittedAmount),
          price,
          orderType: type,
          walletPublicKey: tradeWalletPublicKey,
        })
      : onClose();
  }, [
    type,
    price,
    amount,
    submittedAmount,
    stopLoss,
    positionLimit,
    onClose,
    onConfirm,
    disabled,
    draftKey,
    quoteExpired,
    selectedTradeWallet,
    walletNetwork,
    estimatedSlippage,
  ]);

  const discardDraft = useCallback(() => {
    clearTradeDraft(draftKey);
    setType(DEFAULT_DRAFT.type);
    setLimitPrice(DEFAULT_DRAFT.limitPrice);
    setAmount(DEFAULT_DRAFT.amount);
    setStopLoss(DEFAULT_DRAFT.stopLoss);
    setPositionLimit(DEFAULT_DRAFT.positionLimit);
    setTouched({ limitPrice: false, amount: false });
  }, [draftKey]);

  const hasDraftFields = !isDefaultDraft({
    type,
    limitPrice,
    amount,
    stopLoss,
    positionLimit,
  });

  // Announce order-type changes to screen readers via live region
  const handleOrderTypeChange = (newType: OrderType) => {
    setType(newType);
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `Order type changed to ${
        newType === "LIMIT" ? "Limit" : "Market"
      }`;
    }
  };

  const networkFee = "0.00001 XLM";
  const priceImpact = type === "MARKET" ? "~0.12%" : "~0.05%";
  const execMethod = type === "MARKET" ? "AMM Swap" : "Order Book";
  const tradeFeePercent = type === "MARKET" ? 0.0035 : 0.002;
  const tradeFee = total * tradeFeePercent;
  const parsedNetworkFeeXLM = parseFloat(networkFee.split(" ")[0]) || 0;
  const networkFeeUSDC = parsedNetworkFeeXLM * (marketPrice || price || 0);
  const netAmount = Math.max(0, total - tradeFee - networkFeeUSDC);
  // Estimates need a quote and an amount; without them show "—", not "$0.0000"
  const feeEstimateAvailable = total > 0;
  const formatEstimate = (value: number) =>
    feeEstimateAvailable ? `$${value.toFixed(4)}` : "—";

  // Spendable-balance preview (#1099). Only shown when the same wallet and a
  // usable quote back the numbers; otherwise an unavailable state is rendered.
  const quoteFees = activeQuote?.fees;
  const previewAvailable =
    walletReady &&
    !!walletKey &&
    quoteStatus === "valid" &&
    total > 0 &&
    Number.isFinite(walletBalance);
  const previewStale = quoteStatus === "stale" || quoteStatus === "expired";
  const spendableBefore = walletBalance;
  const spendableAfter = previewAvailable
    ? Math.max(0, walletBalance - total - (quoteFees ?? 0))
    : null;
  const formatSpendable = (value: number) => `$${value.toFixed(4)}`;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
          className="fixed inset-0 z-modal flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay — click to close */}
          <div
            className="absolute inset-0 bg-overlay/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Hidden live region for screen-reader announcements */}
          <span
            ref={liveRegionRef}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          />

          {/* Modal panel */}
          <motion.div
            ref={focusTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-modal-title"
            aria-describedby="trade-modal-description"
            className={`relative z-overlay mx-4 w-full max-w-md rounded-2xl border p-4 shadow-2xl sm:mx-0 sm:p-6
              ${
                type === "MARKET"
                  ? "bg-accent-market/10 border-accent-market/30"
                  : "bg-surface border-border"
              }`}
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2
                  id="trade-modal-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Place Order
                </h2>
                <p id="trade-modal-description" className="sr-only">
                  Use Tab to navigate fields. Press Escape to close. Press Enter
                  to confirm when the form is valid.
                </p>
                {isDemoMode && (
                  <span className="text-xs text-blue-400 font-medium">
                    Demo Mode
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close modal (Escape)"
                className="rounded-full p-1 text-foreground-muted hover:text-foreground hover:bg-foreground/10 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Order type toggle */}
            <div
              role="group"
              aria-label="Order type"
              className="flex rounded-lg bg-foreground/5 p-1 mb-5"
            >
              {(["LIMIT", "MARKET"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  data-order-type={t}
                  onClick={() => handleOrderTypeChange(t)}
                  aria-pressed={type === t}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface
                    ${
                      type === t
                        ? "bg-foreground/15 text-foreground shadow"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                >
                  {t === "LIMIT" ? "Limit" : "Market"}
                </button>
              ))}
            </div>

            {step === "optimistic" ? (
              <div
                className="flex flex-col items-center gap-4 py-6 text-center"
                role="status"
                aria-live="polite"
              >
                <Loader2
                  size={48}
                  className="animate-spin text-foreground-muted"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Submitting order…
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Not placed until the network confirms it.
                  </p>
                </div>
                {submitting && (
                  <div
                    className="h-1 w-32 overflow-hidden rounded-full bg-foreground/10"
                    role="progressbar"
                    aria-label="Confirming transaction"
                  >
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-accent-market" />
                  </div>
                )}
              </div>
            ) : step === "input" ? (
              <>
                <section
                  aria-label="Trade account selection"
                  className="mb-4 rounded-lg border border-border bg-input p-3"
                >
                  {!tradeWalletInitialized ? (
                    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                      Loading saved account preference…
                    </p>
                  ) : walletConnected && wallets.length > 0 ? (
                    <>
                      <label
                        htmlFor="trade-wallet-account"
                        className="mb-1.5 block text-xs font-medium text-foreground-muted"
                      >
                        Account for this trade
                      </label>
                      <select
                        id="trade-wallet-account"
                        data-testid="trade-wallet-select"
                        value={selectedTradeWallet}
                        onChange={(event) => {
                          setSelectedTradeWallet(event.target.value);
                          setConfirmError(null);
                        }}
                        disabled={submitting}
                        aria-required="true"
                        aria-describedby="trade-wallet-help"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                      >
                        <option value="">
                          {defaultTradeWalletPublicKey &&
                          !wallets.some(
                            (wallet) =>
                              wallet.publicKey === defaultTradeWalletPublicKey,
                          )
                            ? "Saved default unavailable — choose an account"
                            : "Choose a connected account"}
                        </option>
                        {wallets.map((wallet) => (
                          <option key={wallet.publicKey} value={wallet.publicKey}>
                            {wallet.nickname
                              ? `${wallet.nickname} · ${truncateKey(wallet.publicKey)}`
                              : truncateKey(wallet.publicKey)}
                          </option>
                        ))}
                      </select>
                      <p
                        id="trade-wallet-help"
                        className="mt-1.5 text-xs text-muted-foreground"
                      >
                        {walletReady &&
                        selectedTradeWallet === defaultTradeWalletPublicKey
                          ? "Saved default selected. You can change it for this trade only."
                          : "Choose an account for this trade. This does not change your saved default."}
                      </p>
                      {!walletReady && (
                        <p
                          role="alert"
                          className="mt-1 text-xs text-accent-warning"
                        >
                          Select a connected account before reviewing the order.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        No connected account is available for this trade.
                      </p>
                      <button
                        type="button"
                        onClick={() => setWalletModalOpen(true)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Connect wallet
                      </button>
                    </div>
                  )}
                </section>

                <div
                  className="space-y-4"
                  id={`${type.toLowerCase()}-panel`}
                  role="group"
                  aria-label={`${
                    type === "LIMIT" ? "Limit" : "Market"
                  } order fields`}
                >
                  {/* Price row */}
                  {type === "LIMIT" ? (
                    <div>
                      <label
                        htmlFor="limit-price"
                        className="text-xs text-foreground-muted mb-1 block"
                      >
                        Limit Price (USDC)
                      </label>
                      <input
                        id="limit-price"
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="0.00"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, limitPrice: true }))
                        }
                        aria-describedby={
                          limitPriceError ? "limit-price-error" : undefined
                        }
                        aria-invalid={!!limitPriceError}
                        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-foreground placeholder-foreground-subtle text-sm
                          focus:outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                      />
                      {limitPriceError && (
                        <p
                          id="limit-price-error"
                          role="alert"
                          className="mt-1 text-xs text-accent-danger"
                        >
                          {limitPriceError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs text-foreground-muted mb-1 block">
                        Current Market Price
                      </span>
                      <div
                        className="w-full rounded-lg bg-accent-market/40 border border-accent-market/30 px-3 py-2 text-accent-market text-sm font-mono"
                        aria-label={`Current market price: ${fmt(
                          marketPrice
                        )} USDC`}
                      >
                        {fmt(marketPrice)} USDC
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <div
                      role="group"
                      aria-label="Amount entry mode"
                      className="mb-1.5 flex rounded-lg bg-foreground/5 p-1"
                    >
                      {(["asset", "currency"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleEntryModeChange(mode)}
                          aria-pressed={entryMode === mode}
                          className={`flex-1 rounded-md py-1 text-xs font-medium transition-all
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface
                            ${
                              entryMode === mode
                                ? "bg-foreground/15 text-foreground shadow"
                                : "text-foreground-muted hover:text-foreground"
                            }`}
                        >
                          {mode === "asset" ? "XLM" : "USDC"}
                        </button>
                      ))}
                    </div>
                    <label
                      htmlFor="trade-amount"
                      className="text-xs text-foreground-muted mb-1 block"
                    >
                      {entryMode === "asset" ? "Amount (XLM)" : "Amount (USDC)"}
                    </label>
                    {entryMode === "asset" ? (
                      <input
                        id="trade-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, amount: true }))
                        }
                        aria-describedby={
                          amountError ? "trade-amount-error" : undefined
                        }
                        aria-invalid={!!amountError}
                        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-foreground placeholder-foreground-subtle text-sm
                          focus:outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                      />
                    ) : (
                      <input
                        id="trade-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={currencyAmount}
                        onChange={(e) => {
                          const next = e.target.value;
                          setCurrencyAmount(next);
                          setAmount(
                            price
                              ? ((parseFloat(next) || 0) / price).toFixed(2)
                              : ""
                          );
                        }}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, amount: true }))
                        }
                        aria-describedby={
                          amountError ? "trade-amount-error" : undefined
                        }
                        aria-invalid={!!amountError}
                        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-foreground placeholder-foreground-subtle text-sm
                          focus:outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                      />
                    )}
                    {amountError && (
                      <p
                        id="trade-amount-error"
                        role="alert"
                        className="mt-1 text-xs text-accent-danger"
                      >
                        {amountError}
                      </p>
                    )}

                    {/* Quick size presets */}
                    <div
                      className="mt-1.5 flex gap-1"
                      role="group"
                      aria-label="Quick size presets"
                    >
                      {sizePresets.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyPreset(pct)}
                          disabled={!price}
                          aria-label={`Set amount to ${
                            pct === 100 ? "maximum" : `${pct}%`
                          } of wallet balance`}
                          className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface
                            ${
                              !price
                                ? "cursor-not-allowed bg-foreground/5 text-foreground-subtle"
                                : "bg-foreground/10 text-foreground-muted hover:bg-foreground/20 hover:text-foreground"
                            }`}
                        >
                          {pct === 100 ? "Max" : `${pct}%`}
                        </button>
                      ))}
                    </div>
                    {editingPresets ? (
                      <TradePresetEditor onDone={() => setEditingPresets(false)} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingPresets(true)}
                        className="mt-1 text-xs text-foreground-muted hover:text-foreground underline-offset-2 hover:underline"
                      >
                        Edit presets
                      </button>
                    )}
                  </div>

                  {/* Total (read-only) */}
                  <div>
                    <span className="text-xs text-foreground-muted mb-1 block">
                      Total (USDC)
                    </span>
                    <div
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-mono
                        ${
                          insufficient
                            ? "border-accent-danger/50 bg-accent-danger/10 text-accent-danger"
                            : "border-border bg-input text-foreground"
                        }`}
                      aria-label={`Total: $${total.toFixed(4)} USDC${
                        insufficient ? " — insufficient balance" : ""
                      }`}
                    >
                      ${total.toFixed(4)}
                      {insufficient && (
                        <span className="ml-2 text-xs text-accent-danger">
                          Insufficient balance
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Spendable balance preview (#1099) */}
                  <div
                    role="region"
                    aria-label="Spendable balance preview"
                    aria-busy={quoteStatus === "loading"}
                    className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-subtle">
                        Spendable before
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {walletReady && Number.isFinite(walletBalance)
                          ? formatSpendable(spendableBefore)
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-foreground-subtle">
                        Spendable after
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {spendableAfter !== null
                          ? formatSpendable(spendableAfter)
                          : "—"}
                      </span>
                    </div>
                    {quoteFees !== undefined && previewAvailable && (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-foreground-subtle">
                          Quote fees
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {formatSpendable(quoteFees)}
                        </span>
                      </div>
                    )}
                    {!previewAvailable && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="mt-1 text-xs text-foreground-muted"
                      >
                        {quoteStatus === "loading"
                          ? "Loading balance preview…"
                          : "Balance preview unavailable until a wallet and current quote are available."}
                      </p>
                    )}
                    {previewStale && (
                      <p role="alert" className="mt-1 text-xs text-accent-warning">
                        This preview is based on a stale quote. Refresh the quote
                        to update it.
                      </p>
                    )}
                  </div>

                  {/* Estimated fees and net amount, recalculated as amount or quote changes */}
                  <div className="rounded-lg border border-border bg-input px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-subtle">
                        Est. trade fee ({(tradeFeePercent * 100).toFixed(2)}%)
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {formatEstimate(tradeFee)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-foreground-subtle">
                        Est. network fee
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {formatEstimate(networkFeeUSDC)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 border-t border-border pt-1">
                      <span className="text-foreground-subtle">
                        Est. net amount
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {formatEstimate(netAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Low balance alert */}
                  {insufficient && (
                    <div
                      role="alert"
                      className="mt-2 rounded-md border border-accent-danger/40 bg-accent-danger/10 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-accent-danger">
                            Low balance
                          </p>
                          <p className="text-foreground-muted text-xs mt-1">
                            You do not have enough funds to place this trade.
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <a
                            href="https://www.stellar.org/lumens/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-md bg-accent-market px-3 py-1 text-xs font-medium text-foreground hover:opacity-90
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                          >
                            Top up
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Position limit warning */}
                  {exceedsPositionLimit && positionLimitInUSD !== null && (
                    <div
                      role="alert"
                      className="mt-2 rounded-md border border-accent-warning/40 bg-accent-warning/10 p-3 text-sm"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-4 w-4 text-accent-warning flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-accent-warning">
                            Position limit exceeded
                          </p>
                          <p className="text-foreground-muted text-xs mt-1">
                            This trade (${total.toFixed(2)}) exceeds your{" "}
                            {positionLimitPercentage}% position limit ($
                            {positionLimitInUSD.toFixed(2)}). Reduce the amount
                            or disable position limits.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stop-loss slider */}
                  <div>
                    <div className="flex justify-between text-xs text-foreground-muted mb-1">
                      <label htmlFor="stop-loss-slider">
                        <GlossaryTerm term="stop-loss">Stop-Loss</GlossaryTerm>
                      </label>
                      <span
                        className="text-accent-warning font-medium"
                        aria-hidden="true"
                      >
                        -{stopLoss}%
                      </span>
                    </div>
                    <input
                      id="stop-loss-slider"
                      type="range"
                      min={1}
                      max={50}
                      value={stopLoss}
                      onChange={(e) => setStopLoss(Number(e.target.value))}
                      aria-valuemin={1}
                      aria-valuemax={50}
                      aria-valuenow={stopLoss}
                      aria-valuetext={`${stopLoss}% stop-loss`}
                      aria-describedby="stop-loss-help"
                      className="w-full accent-[hsl(var(--accent-warning))]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface rounded"
                    />
                    <span id="stop-loss-help" className="sr-only">
                      Set the percentage loss at which to automatically sell.
                      Currently set to {stopLoss} percent.
                    </span>
                  </div>

                  {/* Position limit toggle */}
                  <div className="flex items-center justify-between">
                    <span
                      id="position-limit-label"
                      className="text-sm text-foreground flex items-center gap-1"
                    >
                      Position Limit
                      <Info
                        size={13}
                        className="text-foreground-subtle"
                        aria-hidden="true"
                      />
                    </span>
                    <button
                      role="switch"
                      aria-checked={positionLimit}
                      aria-labelledby="position-limit-label"
                      aria-describedby="position-limit-help"
                      onClick={() => setPositionLimit((v) => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                        ${positionLimit ? "bg-primary" : "bg-foreground/15"}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-foreground shadow transition-transform ${
                          positionLimit ? "translate-x-5" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <span id="position-limit-help" className="sr-only">
                      Position limit helps manage risk by limiting the size of
                      your position
                    </span>
                  </div>
                </div>

                {/* Fee disclosure */}
                <FeeDisclosurePanel tradeTotal={total} className="mt-4" />

                {/* Slippage warning — non-blocking, shown inline before review */}
                <SlippageWarning
                  slippage={estimatedSlippage}
                  threshold={SLIPPAGE_THRESHOLD}
                  onConfirm={() => setSlippageAcknowledged(true)}
                  onCancel={onClose}
                />

                {/* Review button — advances to review step; does NOT submit */}
                <button
                  onClick={() => setStep("review")}
                  disabled={disabled}
                  aria-disabled={disabled}
                  className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                    ${
                      disabled
                        ? "bg-foreground/10 text-foreground-subtle cursor-not-allowed"
                        : type === "MARKET"
                        ? "bg-accent-market hover:opacity-90 text-foreground"
                        : "bg-primary hover:opacity-90 text-primary-foreground"
                    }`}
                >
                  Review Order
                </button>

                {/* Explicit discard — clears the saved draft for this context */}
                {hasDraftFields && (
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="mt-2 w-full rounded-md py-1 text-xs text-foreground-muted hover:text-foreground transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Discard draft
                  </button>
                )}

                {/* Keyboard shortcut hint */}
                <p
                  className="mt-2 text-center text-xs text-foreground-subtle"
                  aria-hidden="true"
                >
                  <kbd className="font-mono">Esc</kbd> to cancel
                </p>
              </>
            ) : (
              <>
                {/* Review step — shows exact order details before submission */}
                <div
                  role="region"
                  aria-label="Order review"
                  className="space-y-3"
                >
                  {/* Rollback error: shown when on-chain confirmation fails */}
                  {confirmError && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 rounded-lg border border-accent-danger/40 bg-accent-danger/10 p-3 text-sm"
                    >
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-danger"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium text-accent-danger">
                          Confirmation failed
                        </p>
                        <p className="mt-0.5 text-xs text-foreground-muted">
                          {confirmError}
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-foreground-muted mb-3">
                    Review your order before confirming. Use Back to edit.
                  </p>

                  {/* Quote validity — shown only when the quote carries an expiry */}
                  {quoteSecondsLeft !== null && (
                    <div
                      role={quoteExpired ? "alert" : undefined}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        quoteExpired
                          ? "border-accent-danger/40 bg-accent-danger/10"
                          : "border-border bg-input"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-foreground-muted">Quote</span>
                        <span
                          className={`font-mono font-medium ${
                            quoteExpired
                              ? "text-accent-danger"
                              : "text-foreground"
                          }`}
                        >
                          {quoteExpired
                            ? "Expired"
                            : `Expires in ${quoteSecondsLeft}s`}
                        </span>
                      </div>
                      {quoteExpired && (
                        <p className="mt-1 text-xs text-foreground-muted">
                          This quote has expired. Refresh it to confirm your
                          order.
                        </p>
                      )}
                    </div>
                  )}

                  {onRefreshQuote && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleRefreshQuote}
                        disabled={quoteRefreshing || submitting}
                        aria-busy={quoteRefreshing}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      >
                        <RefreshCw
                          size={14}
                          aria-hidden="true"
                          className={quoteRefreshing ? "animate-spin" : ""}
                        />
                        {quoteRefreshing ? "Refreshing quote…" : "Refresh quote"}
                      </button>
                      {quoteError && (
                        <p role="alert" className="text-xs text-accent-danger">
                          {quoteError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Signing wallet and network — the order is submitted from this account */}
                  <div className="rounded-lg border border-border bg-input divide-y divide-border text-sm">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">Wallet</span>
                      <span className="font-mono font-medium text-foreground">
                        {walletReady && walletKey
                          ? `${selectedWalletNickname ? `${selectedWalletNickname} · ` : ""}${truncateKey(walletKey)}`
                          : "Not connected"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">Network</span>
                      <span
                        className={`font-mono font-medium ${
                          networkMismatch
                            ? "text-accent-danger"
                            : "text-foreground"
                        }`}
                      >
                        {networkLabel}
                      </span>
                    </div>
                  </div>

                  {!walletReady && (
                    <p role="alert" className="text-xs text-accent-danger">
                      Connect a wallet to place this order.
                    </p>
                  )}
                  {networkMismatch && (
                    <p role="alert" className="text-xs text-accent-danger">
                      Switch your wallet to {appNetwork} to place this order.
                    </p>
                  )}

                  {/* Summary rows */}
                  <div className="rounded-lg border border-border bg-input divide-y divide-border text-sm">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">Order type</span>
                      <span className="font-medium text-foreground">
                        {type === "LIMIT" ? "Limit" : "Market"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">Amount</span>
                      <span className="font-mono font-medium text-foreground">
                        {submittedAmount} XLM
                      </span>
                    </div>
                    {amountRounded && (
                      <div className="px-3 py-2">
                        <p className="text-xs text-foreground-muted">
                          You entered {amount} XLM. Stellar precision rounds the
                          submitted amount to {submittedAmount} XLM, which is the
                          value sent for execution.
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">Price</span>
                      <span className="font-mono font-medium text-foreground">
                        {type === "MARKET"
                          ? `${fmt(marketPrice)} USDC (market)`
                          : `${limitPrice} USDC`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">Total</span>
                      <span className="font-mono font-medium text-foreground">
                        ${total.toFixed(4)} USDC
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground-muted">
                        <GlossaryTerm term="stop-loss">Stop-loss</GlossaryTerm>
                      </span>
                      <span className="font-mono font-medium text-accent-warning">
                        -{stopLoss}%
                      </span>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  <div className="rounded-lg bg-white/3 border border-white/6 px-3 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-subtle">
                        Trade fee ({(tradeFeePercent * 100).toFixed(2)}%)
                      </span>
                      <span className="font-mono font-medium">
                        {formatEstimate(tradeFee)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-foreground-subtle">
                        Network fee
                      </span>
                      <span className="font-mono font-medium">
                        {feeEstimateAvailable
                          ? `${networkFee} (~$${networkFeeUSDC.toFixed(6)})`
                          : networkFee}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 border-t pt-2">
                      <span className="text-foreground-subtle">Net amount</span>
                      <span className="font-mono font-medium">
                        {formatEstimate(netAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Review step action buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setStep("input")}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    aria-label="Back to edit inputs"
                  >
                    <ArrowLeft size={15} aria-hidden="true" className="rtl-flip" />
                    Back
                  </button>

                  <button
                    onClick={handleConfirm}
                    disabled={submitting || quoteExpired || disabled}
                    aria-disabled={submitting || quoteExpired || disabled}
                    aria-busy={submitting}
                    aria-describedby="confirm-button-help"
                    className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                      ${
                        disabled || submitting || quoteExpired
                          ? "bg-foreground/10 text-foreground-subtle cursor-not-allowed"
                          : type === "MARKET"
                          ? "bg-accent-market hover:opacity-90 text-foreground"
                          : "bg-primary hover:opacity-90 text-primary-foreground"
                      }`}
                  >
                    {submitting
                      ? "Submitting…"
                      : `Confirm ${
                          type === "LIMIT" ? "Limit" : "Market"
                        } Order`}
                  </button>
                </div>
                <span id="confirm-button-help" className="sr-only">
                  {`Place ${type.toLowerCase()} order for ${submittedAmount} XLM at ${
                    type === "MARKET" ? "market price" : `${limitPrice} USDC`
                  }.${
                    amountRounded
                      ? ` The entered amount of ${amount} XLM is rounded to ${submittedAmount} XLM.`
                      : ""
                  } Press Enter to confirm.`}
                </span>

                <p
                  className="mt-2 text-center text-xs text-foreground-subtle"
                  aria-hidden="true"
                >
                  <kbd className="font-mono">Esc</kbd> to cancel ·{" "}
                  <kbd className="font-mono">Enter</kbd> to confirm
                </p>
              </>
            )}
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {walletModalOpen && (
        <WalletSelectionModal
          open={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      )}
    </>
  );
}
