type SignalType = "BUY" | "SELL" | "NEUTRAL";

interface SignalBadgeProps {
  signal: SignalType;
}

const styles: Record<SignalType, string> = {
  BUY: "bg-green-500 text-white forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:border forced-colors:border-[HighlightText]",
  SELL: "bg-red-500 text-white forced-colors:bg-[Mark] forced-colors:text-[MarkText] forced-colors:border forced-colors:border-[MarkText]",
  NEUTRAL: "bg-slate-500 text-white forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]",
};

export function SignalBadge({ signal }: SignalBadgeProps) {
  return (
    <span
      aria-label={`${signal} signal`}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide forced-color-adjust-none ${styles[signal]}`}
    >
      {signal}
    </span>
  );
}
