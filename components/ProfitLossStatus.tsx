import { EyeOff, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfitLossStatusProps {
  value: number;
  masked?: boolean;
  className?: string;
}

/** A textual and shape-based result label; color is supplementary only. */
export function ProfitLossStatus({ value, masked = false, className }: ProfitLossStatusProps) {
  if (masked) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground",
          className,
        )}
        aria-label="Profit or loss hidden"
      >
        <EyeOff size={12} aria-hidden="true" />
        Hidden
      </span>
    );
  }

  const outcome = value > 0 ? "Profit" : value < 0 ? "Loss" : "Break-even";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const tone = value > 0
    ? "border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-300 forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]"
    : value < 0
      ? "border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300 forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]"
      : "border-border bg-muted/30 text-foreground forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium forced-color-adjust-auto",
        tone,
        className,
      )}
      aria-label={outcome}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {outcome}
    </span>
  );
}
