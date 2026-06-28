import { Lock, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumSignalBadgeProps {
  /** Whether the current user has access to this signal */
  hasAccess?: boolean;
  /** Minimum stake required (in XLM) to unlock */
  requiredStake?: number;
  className?: string;
}

/**
 * Displays a premium badge on signals that require a stake threshold.
 * Shows a locked state with the required stake when the user lacks access.
 */
export function PremiumSignalBadge({
  hasAccess = false,
  requiredStake = 1000,
  className,
}: PremiumSignalBadgeProps) {
  if (hasAccess) {
    return (
      <span
        aria-label="Premium signal — access granted"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-400 forced-color-adjust-none forced-colors:border forced-colors:border-[Highlight] forced-colors:bg-[Canvas] forced-colors:text-[Highlight]",
          className
        )}
      >
        <Star size={11} aria-hidden="true" className="fill-yellow-400 forced-colors:fill-[Highlight]" />
        Premium
      </span>
    );
  }

  return (
    <span
      aria-label={`Premium signal — requires ${requiredStake.toLocaleString()} XLM staked to unlock`}
      title={`Stake ${requiredStake.toLocaleString()} XLM to unlock this signal`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-600/60 bg-slate-800/60 px-2.5 py-0.5 text-xs font-semibold text-slate-400 forced-color-adjust-none forced-colors:border forced-colors:border-[GrayText] forced-colors:bg-[Canvas] forced-colors:text-[GrayText]",
        className
      )}
    >
      <Lock size={11} aria-hidden="true" />
      {requiredStake.toLocaleString()} XLM
    </span>
  );
}
