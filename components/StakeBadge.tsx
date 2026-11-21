import { useEffect, useRef, useState } from "react";
import { Shield, AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROTOCOL_MIN_STAKE_XLM,
  LOW_STAKE_WARNING_MARGIN,
} from "@/lib/stellar";
import { useProviderProfile } from "@/hooks/useProviderProfile";

interface StakeBadgeProps {
  stake?: number;
  reputation?: number;
  /** Provider's actual staked amount in XLM, used to detect low-stake proximity */
  providerStakeXlm?: number;
  /** Protocol minimum stake in XLM; defaults to PROTOCOL_MIN_STAKE_XLM */
  minStakeXlm?: number;
  /** Fraction above the minimum within which the warning badge is shown; defaults to LOW_STAKE_WARNING_MARGIN */
  warningMargin?: number;
  /** Provider ID — when supplied, sources breakdown data from useProviderProfile */
  providerId?: string;
  className?: string;
}

export function StakeBadge({
  stake = 0,
  reputation = 0,
  providerStakeXlm,
  minStakeXlm = PROTOCOL_MIN_STAKE_XLM,
  warningMargin = LOW_STAKE_WARNING_MARGIN,
  providerId,
  className,
}: StakeBadgeProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const { data: profileData } = useProviderProfile(providerId ?? "");

  // Merge profile data with direct props
  const resolvedStake = profileData?.staked ?? stake;
  const resolvedReputation = profileData?.reputation ?? reputation;
  const resolvedStakeXlm = providerStakeXlm;
  const resolvedTrustScore = profileData?.trustScore;
  const resolvedWinRate = profileData?.winRate;

  const isLowStake =
    resolvedStakeXlm !== undefined &&
    resolvedStakeXlm <= minStakeXlm * (1 + warningMargin);

  const getTierColor = (score: number) => {
    if (score >= 80)
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20 forced-colors:text-[Highlight] forced-colors:bg-[Canvas] forced-colors:border-[Highlight]";
    if (score >= 60)
      return "text-blue-500 bg-blue-500/10 border-blue-500/20 forced-colors:text-[LinkText] forced-colors:bg-[Canvas] forced-colors:border-[LinkText]";
    return "text-gray-400 bg-gray-500/10 border-gray-500/20 forced-colors:text-[GrayText] forced-colors:bg-[Canvas] forced-colors:border-[GrayText]";
  };

  const getTierLabel = (score: number) => {
    if (score >= 80) return "Gold";
    if (score >= 60) return "Silver";
    return "Bronze";
  };

  const displayScore = resolvedReputation || resolvedStake;
  const tierColor = getTierColor(displayScore);
  const tierLabel = getTierLabel(displayScore);

  const popoverId = `stake-breakdown-${providerId ?? "badge"}`;

  function togglePopover() {
    setPopoverOpen((v) => !v);
  }

  function closePopover() {
    setPopoverOpen(false);
    // #1071: return focus to the badge that opened the popover.
    triggerRef.current?.focus();
  }

  // Dismiss on Escape and outside click
  useEffect(() => {
    if (!popoverOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePopover();
    }
    function onPointerDown(e: PointerEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [popoverOpen]);

  if (!resolvedStake && !resolvedReputation) return null;

  if (isLowStake) {
    const warningDescription =
      `Low stake warning: ${resolvedStakeXlm?.toLocaleString()} XLM staked, ` +
      `within ${Math.round(
        warningMargin * 100
      )}% of the ${minStakeXlm.toLocaleString()} XLM minimum.`;

    return (
      <div className={cn("relative inline-flex items-center", className)}>
        <div
          ref={triggerRef as React.RefObject<HTMLDivElement>}
          role="button"
          tabIndex={0}
          aria-controls={popoverId}
          aria-expanded={popoverOpen}
          aria-label={`${warningDescription} Click for details.`}
          onClick={togglePopover}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && togglePopover()
          }
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 px-2 py-1 rounded text-xs font-medium border forced-color-adjust-none",
            "text-amber-500 bg-amber-500/10 border-amber-500/30 forced-colors:text-[Mark] forced-colors:bg-[Canvas] forced-colors:border-[Mark]"
          )}
        >
          <AlertTriangle size={12} aria-hidden="true" />
          <span>Low Stake</span>
        </div>

        {popoverOpen && (
          <BreakdownPopover
            id={popoverId}
            ref={popoverRef}
            onClose={closePopover}
            stake={resolvedStake}
            reputation={resolvedReputation}
            stakeXlm={resolvedStakeXlm}
            minStakeXlm={minStakeXlm}
            warningMargin={warningMargin}
            trustScore={resolvedTrustScore}
            winRate={resolvedWinRate}
            tierLabel={tierLabel}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <div
        ref={triggerRef as React.RefObject<HTMLDivElement>}
        role="button"
        tabIndex={0}
        aria-controls={popoverId}
        aria-expanded={popoverOpen}
        aria-label={`Stake tier: ${tierLabel}. Reputation ${resolvedReputation}%, staked $${resolvedStake?.toLocaleString()}. Click for breakdown.`}
        onClick={togglePopover}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && togglePopover()
        }
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 px-2 py-1 rounded text-xs font-medium border forced-color-adjust-none",
          tierColor
        )}
      >
        <Shield size={12} aria-hidden="true" />
        <span>{tierLabel}</span>
      </div>

      {popoverOpen && (
        <BreakdownPopover
          id={popoverId}
          ref={popoverRef}
          onClose={closePopover}
          stake={resolvedStake}
          reputation={resolvedReputation}
          stakeXlm={resolvedStakeXlm}
          minStakeXlm={minStakeXlm}
          warningMargin={warningMargin}
          trustScore={resolvedTrustScore}
          winRate={resolvedWinRate}
          tierLabel={tierLabel}
        />
      )}
    </div>
  );
}

interface BreakdownPopoverProps {
  id: string;
  onClose: () => void;
  stake: number;
  reputation: number;
  stakeXlm?: number;
  minStakeXlm: number;
  warningMargin: number;
  trustScore?: number;
  winRate?: number;
  tierLabel: string;
}

const BreakdownPopover = ({
  id,
  onClose,
  stake,
  reputation,
  stakeXlm,
  minStakeXlm,
  warningMargin,
  trustScore,
  winRate,
  tierLabel,
  ref,
}: BreakdownPopoverProps & { ref: React.Ref<HTMLDivElement> }) => (
  <div
    id={id}
    ref={ref}
    role="dialog"
    aria-label="Stake and trust breakdown"
    aria-modal="false"
    className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-900 p-3 text-xs shadow-xl shadow-black/40"
  >
    <p className="mb-2 font-semibold text-white">Stake &amp; Trust Breakdown</p>

    <div className="space-y-1.5 text-slate-400">
      <div className="flex justify-between">
        <span>
          Tier <span className="text-slate-600">(50%)</span>
        </span>
        <span className="font-medium text-white">{tierLabel}</span>
      </div>
      {reputation > 0 && (
        <div className="flex justify-between">
          <span>
            Reputation <span className="text-slate-600">(30%)</span>
          </span>
          <span className="font-medium text-blue-400">{reputation}%</span>
        </div>
      )}
      {trustScore !== undefined && (
        <div className="flex justify-between">
          <span>
            Trust score <span className="text-slate-600">(20%)</span>
          </span>
          <span className="font-medium text-purple-400">{trustScore}/100</span>
        </div>
      )}
      {winRate !== undefined && (
        <div className="flex justify-between">
          <span>Win rate</span>
          <span className="font-medium text-emerald-400">{winRate}%</span>
        </div>
      )}
      {stake > 0 && (
        <div className="flex justify-between">
          <span>Staked (USD)</span>
          <span className="font-medium text-white">
            ${stake.toLocaleString()}
          </span>
        </div>
      )}
      {stakeXlm !== undefined && (
        <div className="flex justify-between">
          <span>Staked (XLM)</span>
          <span className="font-medium text-white">
            {stakeXlm.toLocaleString()} XLM
          </span>
        </div>
      )}
      {stakeXlm !== undefined && (
        <div className="flex justify-between">
          <span>Protocol min</span>
          <span className="text-slate-500">
            {minStakeXlm.toLocaleString()} XLM
          </span>
        </div>
      )}
    </div>

    <button
      type="button"
      onClick={onClose}
      className="mt-3 w-full rounded border border-white/10 py-1 text-slate-400 transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      Close
    </button>

    <div
      className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"
      aria-hidden="true"
    />
  </div>
);
