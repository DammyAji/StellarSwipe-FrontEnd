import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type SignalType = "BUY" | "SELL" | "NEUTRAL";

interface SignalBadgeProps {
  signal: SignalType;
}

const styles: Record<SignalType, string> = {
  BUY: "bg-green-500 text-white forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] forced-colors:border forced-colors:border-[CanvasText]",
  SELL: "bg-red-500 text-white forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] forced-colors:border forced-colors:border-[CanvasText]",
  NEUTRAL:
    "bg-slate-500 text-white forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]",
};

const icons = {
  BUY: ArrowUpRight,
  SELL: ArrowDownRight,
  NEUTRAL: Minus,
} as const;

export function SignalBadge({ signal }: SignalBadgeProps) {
  const Icon = icons[signal];
  return (
    <span
      aria-label={`${signal} signal`}
      className={`inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-xs font-semibold tracking-wide forced-color-adjust-none ${styles[signal]}`}
    >
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      {signal}
    </span>
  );
}
