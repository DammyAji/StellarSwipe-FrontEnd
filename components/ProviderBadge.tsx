"use client";

export type VerificationLevel = "verified" | "professional" | "new";

interface ProviderBadgeProps {
  level: VerificationLevel;
}

const BADGE_CONFIG: Record<
  VerificationLevel,
  { icon: string; label: string; className: string; tooltip: string }
> = {
  verified: {
    icon: "✓",
    label: "Verified",
    className: "bg-blue-100 text-blue-700 border border-blue-300 forced-colors:bg-[Canvas] forced-colors:text-[LinkText] forced-colors:border-[LinkText]",
    tooltip: "Verified provider — identity confirmed",
  },
  professional: {
    icon: "★",
    label: "Professional",
    className: "bg-purple-100 text-purple-700 border border-purple-300 forced-colors:bg-[Canvas] forced-colors:text-[Highlight] forced-colors:border-[Highlight]",
    tooltip: "Professional provider — proven track record",
  },
  new: {
    icon: "🔥",
    label: "New",
    className: "bg-orange-100 text-orange-700 border border-orange-300 forced-colors:bg-[Canvas] forced-colors:text-[ButtonText] forced-colors:border-[ButtonText]",
    tooltip: "New provider — recently joined",
  },
};

export function ProviderBadge({ level }: ProviderBadgeProps) {
  const { icon, label, className, tooltip } = BADGE_CONFIG[level];

  return (
    <span
      role="img"
      aria-label={`${label} provider`}
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium select-none cursor-default forced-color-adjust-none ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
