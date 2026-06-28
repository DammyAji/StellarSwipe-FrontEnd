"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";
import {
  Bookmark,
  Check,
  ChevronDown,
  Minus,
  Share2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalBadge } from "@/components/SignalBadge";
import { SignalTimestamp } from "@/components/SignalTimestamp";
import { TradeSkeleton } from "@/components/TradeSkeleton";
import { TradeModal } from "@/components/TradeModal";
import { SignalConflictNotice, type SignalConflictReason } from "@/components/SignalConflictNotice";
import { cn } from "@/lib/utils";
import { MiniChart } from "./chart/MiniChart";
import { PremiumSignalBadge } from "@/components/PremiumSignalBadge";
import { ProviderRatingBadge } from "@/components/ProviderRatingBadge";
import { useDemoModeStore } from "@/store/useDemoModeStore";
import { useBookmarkActions } from "@/hooks/useBookmarkActions";
import { usePriceFormat } from "@/hooks/usePriceFormat";
import { useSignalPrice } from "@/hooks/useSignalPrice";
import { toast } from "@/lib/toast";
import type { Signal as ApiSignal } from "@/lib/api";

interface ROIPoint {
  value: number;
}

interface SignalCardProps {
  loading?: boolean;
  signalData?: ApiSignal;
  pair?: string;
  executionPrice?: number;
  confidence?: number;
  projectedTarget?: number;
  roiHistory?: ROIPoint[];
  analysis?: string;
  action?: "BUY" | "SELL" | "HOLD";
  timestamp?: Date;
  providerStake?: number;
  providerReputation?: number;
  providerName?: string;
  signalId?: string;
  isPremium?: boolean;
  hasAccess?: boolean;
  requiredStake?: number;
  conflictReason?: SignalConflictReason;
  portfolioBalance?: number;
  onTrade?: (pair: string, price: number) => void;
  onPass?: () => void;
  showPassAction?: boolean;
}

const DEFAULT_ROI: ROIPoint[] = [
  { value: 0 },
  { value: 1.2 },
  { value: 0.8 },
  { value: 2.1 },
  { value: 1.9 },
  { value: 3.4 },
  { value: 2.8 },
  { value: 4.2 },
];

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 780;

export function SignalCard({
  loading = false,
  signalData,
  pair,
  executionPrice = 0.4821,
  confidence = 87,
  projectedTarget = 0.5310,
  roiHistory = DEFAULT_ROI,
  analysis = "Momentum building after a strong volume breakout above the 50-day MA. RSI at 62 with room to run.",
  action = "BUY",
  timestamp = new Date(Date.now() - 5 * 60 * 1000),
  providerStake,
  providerReputation,
  providerName,
  signalId: signalIdProp,
  isPremium = false,
  hasAccess = true,
  requiredStake = 1000,
  conflictReason,
  portfolioBalance,
  onTrade,
  onPass,
  showPassAction = true,
}: SignalCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissPending, setDismissPending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [actionAnnouncement, setActionAnnouncement] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const { isDemoMode } = useDemoModeStore();
  const fmt = usePriceFormat();
  const executingRef = useRef(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const hasVibratedRef = useRef(false);
  const dismissTimerRef = useRef<number | null>(null);
  const { addBookmark, removeBookmark, hasBookmark } = useBookmarkActions();

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);

  const tradeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-20, -SWIPE_THRESHOLD], [0, 1]);

  const { price, flash, relativeTime } = useSignalPrice(3000);
  const signalId = signalIdProp ?? signalData?.id ?? pair ?? "signal-unknown";
  const signalPair = pair ?? `${signalData?.asset ?? "XLM"}/USDC`;
  const signalAction = signalData?.action ?? action;
  const signalConfidence = signalData?.confidence ?? confidence;
  const signalTimestamp = signalData?.timestamp
    ? new Date(signalData.timestamp)
    : timestamp;
  const signalProvider =
    providerName ?? signalData?.providerName ?? signalData?.providerId ?? signalData?.asset ?? "Provider";
  const badgeSignal =
    signalAction === "BUY" ? "BUY" : signalAction === "SELL" ? "SELL" : "NEUTRAL";

  const isBookmarked = hasBookmark(signalId);
  const bookmarkedLabel = isBookmarked ? "Remove bookmark" : "Bookmark signal";

  const currentPrice = executionPrice;
  const deltaValue = parseFloat((price.executionPrice - currentPrice).toFixed(4));
  const deltaPercent = currentPrice
    ? parseFloat(((deltaValue / currentPrice) * 100).toFixed(2))
    : 0;
  const deltaLabel = `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(2)}%`;
  const deltaAbsLabel = `${deltaValue >= 0 ? "+" : ""}${deltaValue.toFixed(4)}`;
  const deltaPositive = deltaValue >= 0;

  useEffect(() => {
    if (!copiedFeedback) return;
    const timer = window.setTimeout(() => setCopiedFeedback(false), 2000);
    return () => clearTimeout(timer);
  }, [copiedFeedback]);

  useEffect(() => {
    return x.on("change", (latest) => {
      const abs = Math.abs(latest);
      if (abs >= SWIPE_THRESHOLD && !hasVibratedRef.current) {
        hasVibratedRef.current = true;
        navigator.vibrate?.(8);
      } else if (abs < SWIPE_THRESHOLD * 0.6) {
        hasVibratedRef.current = false;
      }
    });
  }, [x]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    }

    if (showShareMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showShareMenu]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  if (loading) return <TradeSkeleton />;

  const roi = (((projectedTarget - executionPrice) / executionPrice) * 100).toFixed(2);
  const isPositive = parseFloat(roi) >= 0;

  function handlePass() {
    if (!showPassAction || dismissPending || dismissed) return;
    setActionAnnouncement(`Passed on ${signalAction} signal for ${signalPair}`);
    setDismissPending(true);
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = window.setTimeout(() => {
      setDismissPending(false);
      setDismissed(true);
      onPass?.();
      dismissTimerRef.current = null;
    }, 4500);
    toast.info("Signal dismissed", {
      description: `${signalPair} will disappear in a few seconds unless you undo it.`,
      duration: 4500,
      action: {
        label: "Undo",
        onClick: () => {
          if (dismissTimerRef.current !== null) {
            window.clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
          }
          setDismissPending(false);
          setActionAnnouncement(`Restored ${signalAction} signal for ${signalPair}`);
        },
      },
    });
  }

  function handleExecuteTrade() {
    if (executingRef.current || dismissPending || dismissed) return;
    executingRef.current = true;
    setActionAnnouncement(`Opening trade modal for ${signalAction} ${signalPair}`);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    executingRef.current = false;
  }

  function handleModalConfirm(details: { amount: string; price: number; orderType: string }) {
    setModalOpen(false);
    executingRef.current = false;
    const size = parseFloat(details.amount || "0");
    toast.success(`${signalAction} position opened`, {
      description: `Entry $${details.price.toFixed(4)} · Size ${size > 0 ? size.toFixed(2) : "—"} XLM`,
      duration: 5000,
    });
    onTrade?.(signalPair, executionPrice);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" && showPassAction) {
      e.preventDefault();
      handlePass();
    } else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleExecuteTrade();
    }
  }

  function handleCopyLink() {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}?signal=${signalPair}&price=${executionPrice}&target=${projectedTarget}&signal_type=${signalAction}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedFeedback(true);
    setShowShareMenu(false);
  }

  function handleShare() {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}?signal=${signalPair}&price=${executionPrice}&target=${projectedTarget}&signal_type=${signalAction}`;
    const shareText = `Check out this ${signalAction} signal for ${signalPair} on StellarSwipe: ${shareUrl}`;

    if (navigator.share) {
      navigator.share({
        title: "StellarSwipe Signal",
        text: shareText,
        url: shareUrl,
      }).catch((err) => {
        if (err.name !== "AbortError") console.error("Share failed:", err);
      });
    } else {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
      window.open(twitterUrl, "_blank", "width=550,height=420");
    }
    setShowShareMenu(false);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;
    const fastSwipe = Math.abs(velocityX) > VELOCITY_THRESHOLD && Math.abs(offsetX) > 40;

    if (
      offsetX > SWIPE_THRESHOLD ||
      (offsetX > SWIPE_THRESHOLD * 0.4 && velocityX > VELOCITY_THRESHOLD) ||
      (fastSwipe && velocityX > 0)
    ) {
      handleExecuteTrade();
    } else if (
      showPassAction &&
      (offsetX < -SWIPE_THRESHOLD ||
        (offsetX < -SWIPE_THRESHOLD * 0.4 && velocityX < -VELOCITY_THRESHOLD) ||
        (fastSwipe && velocityX < 0))
    ) {
      handlePass();
    }
    setIsDragging(false);
  }

  function handleDragStart() {
    setIsDragging(true);
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          className="relative w-full select-none"
          style={{ x, rotate, touchAction: "pan-y" }}
          drag="x"
          dragSnapToOrigin
          dragMomentum={false}
          dragDirectionLock
          dragConstraints={{ left: -180, right: 180 }}
          dragElastic={0.15}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 22 }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            exit={{ x: 0, opacity: 0, scale: 0.85, transition: { duration: 0.25 } }}
            whileTap={{ cursor: "grabbing" }}
            aria-disabled={dismissPending}
          >
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-start rounded-2xl border-2 border-green-500 bg-green-500/10 pl-6"
            style={{ opacity: tradeOpacity }}
            aria-hidden="true"
          >
            <span className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-bold text-white shadow">
              <Check size={15} /> TRADE
            </span>
          </motion.div>

          {showPassAction && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end rounded-2xl border-2 border-red-500 bg-red-500/10 pr-6"
              style={{ opacity: passOpacity }}
              aria-hidden="true"
            >
              <span className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-bold text-white shadow">
                <X size={15} /> PASS
              </span>
            </motion.div>
          )}

          {/* ARIA live region — announces pass/trade actions to screen readers */}
          <div
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            className="sr-only"
          >
            {actionAnnouncement}
          </div>

          <article
            className={cn(
              "w-full rounded-2xl border bg-card p-4 shadow-sm flex flex-col gap-3 sm:p-5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-background",
              isDragging ? "ring-2 ring-blue-500/20" : ""
            )}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            role="article"
            aria-label={`${signalAction} signal for ${signalPair} at ${executionPrice} with ${signalConfidence}% confidence. Press Enter or right arrow to trade${showPassAction ? ", left arrow to pass" : ""}.`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-base sm:text-lg">{signalPair}</span>
                  {isPremium && (
                    <PremiumSignalBadge hasAccess={hasAccess} requiredStake={requiredStake} />
                  )}
                  <span className="hidden sm:inline-flex">
                    <ProviderRatingBadge
                      trustScore={providerReputation}
                      winRate={providerReputation}
                      totalSignals={providerStake ? Math.round(providerStake / 100) : undefined}
                    />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                  <span>{signalProvider}</span>
                  <span aria-hidden="true">·</span>
                  <span>{signalAction}</span>
                  <span aria-hidden="true">·</span>
                  <span>{signalConfidence}% confidence</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isBookmarked) {
                      removeBookmark(signalId, signalPair);
                    } else {
                      addBookmark(signalId);
                    }
                  }}
                  aria-label={bookmarkedLabel}
                  disabled={dismissPending || dismissed}
                  className={cn(
                    "rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60",
                    isBookmarked ? "bg-sky-500/15 text-sky-300" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
                >
                  <Bookmark size={18} aria-hidden="true" />
                </button>
                <div className="relative" ref={shareMenuRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowShareMenu((value) => !value)}
                    aria-label={`Share ${signalPair} signal`}
                    aria-expanded={showShareMenu}
                    className="h-8 w-8 p-0"
                  >
                    <Share2 size={16} />
                  </Button>
                  {showShareMenu && (
                    <div className="share-menu absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg z-20 min-w-[150px] p-1">
                      <button
                        onClick={handleCopyLink}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded flex items-center gap-2"
                        aria-label="Copy link to clipboard"
                      >
                        {copiedFeedback ? <Check size={14} className="text-accent-success" /> : "🔗"}
                        {copiedFeedback ? "Copied!" : "Copy Link"}
                      </button>
                      <button
                        onClick={handleShare}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded flex items-center gap-2"
                        aria-label="Share via Web Share or Twitter"
                      >
                        📤 Share
                      </button>
                    </div>
                  )}
                </div>
                <SignalBadge signal={badgeSignal} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Execution Price</p>
                <p className="font-mono font-semibold">{fmt(executionPrice)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Confidence</p>
                <p className="font-semibold">{signalConfidence}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Target</p>
                <p className="font-mono font-semibold">{fmt(projectedTarget)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ROI</p>
                <p className={cn("font-semibold", isPositive ? "text-accent-success" : "text-accent-danger")}>
                  {isPositive ? "+" : ""}{roi}%
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Live delta</p>
                <motion.div
                  animate={{ scale: flash ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold",
                    deltaPositive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-red-500/15 text-red-300"
                  )}
                >
                  <span>{deltaLabel}</span>
                  <span className="text-foreground-muted">({deltaAbsLabel})</span>
                </motion.div>
              </div>
              <div className="text-right text-[11px] text-foreground-muted">
                {relativeTime}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {signalAction === "BUY" ? (
                <TrendingUp size={16} className="text-accent-success" />
              ) : signalAction === "SELL" ? (
                <TrendingDown size={16} className="text-accent-danger" />
              ) : (
                <Minus size={16} className="text-foreground-subtle" />
              )}
              <MiniChart data={roiHistory.map((p) => p.value)} className="flex-1" />
            </div>

            {/* ── Issue #102: Expandable detail section with smooth animation ── */}
            <button
              type="button"
              onClick={() => setDetailsExpanded((prev) => !prev)}
              aria-expanded={detailsExpanded}
              aria-controls={`signal-details-${signalId}`}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span>{detailsExpanded ? "Hide details" : "Show details"}</span>
              <motion.span
                animate={{ rotate: detailsExpanded ? 180 : 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: "easeInOut" }
                }
                aria-hidden="true"
              >
                <ChevronDown size={14} />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {detailsExpanded && (
                <motion.div
                  id={`signal-details-${signalId}`}
                  key="signal-details"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.28, ease: [0.4, 0, 0.2, 1] }
                  }
                  style={{ overflow: "hidden" }}
                >
                  <div className="flex flex-col gap-3 pt-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">{analysis}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {isPremium && !hasAccess && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-sm">
                <p className="font-medium text-accent-warning">Premium signal locked</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Stake at least {requiredStake.toLocaleString()} XLM to unlock full analysis and trade execution.
                </p>
              </div>
            )}

            {conflictReason && (
              <SignalConflictNotice reason={conflictReason} onRefresh={onPass} onChooseAnother={onPass} />
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <SignalTimestamp updatedAt={signalTimestamp} />
              <p className="text-xs text-muted-foreground" aria-hidden="true">← Pass &nbsp;|&nbsp; Enter / → Trade</p>
            </div>

            <div className="flex gap-2 pt-2">
              {showPassAction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePass}
                  className="flex-1"
                  disabled={dismissPending || dismissed}
                  aria-label={`Pass on ${signalAction} signal for ${signalPair}`}
                >
                  <X size={16} className="mr-1" />
                  Pass
                </Button>
              )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExecuteTrade}
                  disabled={modalOpen || (isPremium && !hasAccess) || !!conflictReason || dismissPending || dismissed}
                  className="flex-1 active:scale-95"
                  aria-label={`Execute trade: ${signalAction} signal for ${signalPair} at ${executionPrice}${isDemoMode ? " (demo)" : ""}${isPremium && !hasAccess ? " (locked — stake required)" : ""}${conflictReason ? " (unavailable — signal conflict)" : ""}`}
                >
                <Zap size={16} className="mr-1" />
                {isDemoMode ? "Demo Trade" : "Execute Trade"}
              </Button>
            </div>
          </article>

          <TradeModal
            open={modalOpen}
            onClose={handleModalClose}
            onConfirm={handleModalConfirm}
            marketPrice={executionPrice}
            portfolioBalance={portfolioBalance}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
