import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import {
  assessMarketContextChange,
  type MarketContextSnapshot,
} from "@/lib/marketContextChange";
import { cn } from "@/lib/utils";
import { Timestamp } from "@/components/Timestamp";

interface MarketContextChangeIndicatorProps {
  context?: MarketContextSnapshot | null;
  className?: string;
}

export function MarketContextChangeIndicator({
  context,
  className,
}: MarketContextChangeIndicatorProps) {
  const status = context?.status ?? "empty";
  const baseClassName = cn("rounded-lg border px-2.5 py-2 text-xs", className);

  if (status === "loading") {
    return (
      <div className={cn(baseClassName, "border-border bg-muted/30 text-muted-foreground")} role="status" aria-live="polite">
        Checking market context…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={cn(baseClassName, "border-destructive/30 bg-destructive/5 text-muted-foreground")} role="alert">
        Market context could not be checked. Change is unavailable.
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className={cn(baseClassName, "border-border bg-muted/20 text-muted-foreground")}>
        Market context change unavailable — quote data is missing.
      </div>
    );
  }

  const assessment = assessMarketContextChange(
    context?.reference,
    context?.current,
    context?.referenceLabel,
  );

  if (!assessment.comparable) {
    return (
      <div className={cn(baseClassName, "border-border bg-muted/20 text-muted-foreground")}>
        Market context change unavailable — {assessment.reason}
      </div>
    );
  }

  const change = assessment.changePercent;
  const formattedChange = `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  const referenceLabel = context?.referenceLabel?.trim() ?? "Reference quote";
  const referenceSource = context?.reference?.source?.trim();
  const currentSource = context?.current?.source?.trim();
  const Icon = assessment.materiallyChanged
    ? change >= 0
      ? ArrowUpRight
      : ArrowDownRight
    : Info;

  return (
    <div
      className={cn(
        baseClassName,
        "flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3",
        assessment.materiallyChanged
          ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-200"
          : "border-border bg-muted/20 text-muted-foreground",
      )}
          role="group"
      aria-label={`Market context comparison: ${assessment.materiallyChanged ? "material move" : "within threshold"}, ${formattedChange}`}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium">
            {assessment.materiallyChanged
              ? "Market moved materially since reference"
              : "Market context remains within threshold"}
          </p>
          <p className="mt-0.5 break-words leading-relaxed">
            Compared with {referenceLabel}
            {referenceSource ? ` (${referenceSource})` : " (source unavailable)"}
            {" · "}
            <Timestamp value={assessment.referenceTime} mode="absolute" />
          </p>
          <p className="break-words leading-relaxed">
            Current quote{currentSource ? ` from ${currentSource}` : " source unavailable"}
            {" · "}
            <Timestamp value={assessment.currentTime} mode="absolute" />
          </p>
        </div>
      </div>
      <span className="shrink-0 pl-5 font-semibold tabular-nums sm:pl-0">
        {formattedChange}
      </span>
      <span className="sr-only">This indicator does not change recommendation status.</span>
    </div>
  );
}
