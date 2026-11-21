"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotificationPreference } from "@/hooks/useNotificationPreference";
import { requestNotificationPermission } from "@/lib/notifications";

const PROMPT_DISMISSED_KEY = "stellarswipe:notification-prompt-dismissed";
const PROMPT_DELAY_MS = 1500;

/**
 * Records the user's decision so the prompt is never shown again on this
 * device, regardless of whether the browser prompt was accepted or declined.
 */
function persistDecision() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
  } catch {
    // Storage can be unavailable (private mode / quota) — the in-memory
    // `dismissed` state still hides the prompt for this session.
  }
}

/**
 * Contextual reasons shown to the user *before* the native browser
 * permission dialog appears. Giving people a "why" up front measurably
 * reduces opt-outs compared to firing `Notification.requestPermission()`
 * on page load with no explanation.
 */
const VALUE_PROPS = [
  {
    icon: Bell,
    title: "New signal alerts",
    description: "Get notified the moment a provider you follow posts a new trade signal.",
  },
  {
    icon: ShieldCheck,
    title: "Price movement alerts",
    description: "Know instantly when an asset you're watching crosses a threshold you care about.",
  },
  {
    icon: BellOff,
    title: "You stay in control",
    description: "Every category can be muted independently, and you can revoke access at any time.",
  },
];

interface NotificationPermissionPromptProps {
  /** Render inline instead of as a fixed corner card (used on the preferences page). */
  variant?: "floating" | "inline";
  className?: string;
}

/**
 * Polished, opt-in-first permission surface. This never calls the native
 * `Notification.requestPermission()` API until the user has explicitly
 * clicked "Enable notifications" here, so the browser's own prompt always
 * appears with context already established.
 */
export function NotificationPermissionPrompt({
  variant = "floating",
  className,
}: NotificationPermissionPromptProps) {
  const { toggleAlerts, permissionStatus, setPermissionStatus } =
    useNotificationPreference();
  const [shouldRender, setShouldRender] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyDismissed = localStorage.getItem(PROMPT_DISMISSED_KEY) === "true";
    setDismissed(alreadyDismissed);

    if (variant === "floating") {
      const timer = setTimeout(() => setShouldRender(true), PROMPT_DELAY_MS);
      return () => clearTimeout(timer);
    }
    setShouldRender(true);
  }, [variant]);

  const supportsNotifications =
    typeof window !== "undefined" && "Notification" in window;

  const handleDismiss = () => {
    setDismissed(true);
    persistDecision();
  };

  const handleEnable = async () => {
    if (!supportsNotifications) return;
    setRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermissionStatus(result);
      if (result === "granted") {
        toggleAlerts(true);
      }
      // Any decision — granted or denied — is final for this device.
      handleDismiss();
    } finally {
      setRequesting(false);
    }
  };

  if (!supportsNotifications) return null;
  if (!shouldRender) return null;
  if (permissionStatus !== "default") return null;
  if (dismissed) return null;

  const containerClasses =
    variant === "floating"
      ? "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 w-[min(92vw,380px)] animate-in fade-in slide-in-from-bottom-4"
      : "w-full";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-sky/15 text-accent-sky">
            <Bell size={18} aria-hidden="true" />
          </div>
          <h2 id="notification-prompt-title" className="text-sm font-semibold text-foreground">
            Stay on top of your signals
          </h2>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
          className="rounded-md p-1 text-foreground-muted hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <p
        id="notification-prompt-description"
        className="mt-2 text-xs leading-5 text-foreground-muted"
      >
        Turn on notifications and we&apos;ll tell you when a provider you follow
        posts a new signal or a price you&apos;re watching moves. Your browser
        will ask for permission next — you can say no and change your mind later.
      </p>

      <ul className="mt-3 space-y-2.5">
        {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex items-start gap-2.5">
            <Icon size={14} className="mt-0.5 shrink-0 text-foreground-muted" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-foreground">{title}</p>
              <p className="text-[11px] leading-4 text-foreground-muted">{description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleDismiss}
        >
          Not now
        </Button>
        <Button
          size="sm"
          className="w-full flex-1 gap-1.5"
          onClick={handleEnable}
          disabled={requesting}
        >
          <Bell size={13} aria-hidden="true" />
          {requesting ? "Requesting…" : "Enable notifications"}
        </Button>
      </div>

      <p className="mt-3 text-[10px] text-foreground-muted">
        Skip this and you just won&apos;t get alerts yet — you can turn
        notifications on anytime from Preferences → Notifications.
      </p>
    </>
  );

  // On small screens the floating card becomes a bottom sheet so the actions
  // stay reachable above the mobile browser chrome and safe-area insets.
  if (variant === "floating" && isMobile) {
    return (
      <BottomSheet
        open
        onClose={handleDismiss}
        ariaLabel="Enable notifications"
        initialFocus='button[aria-label="Dismiss notification prompt"]'
        className="px-5 pb-5"
      >
        {content}
      </BottomSheet>
    );
  }

  return (
    <div
      role="dialog"
      aria-labelledby="notification-prompt-title"
      aria-describedby="notification-prompt-description"
      className={`${containerClasses} ${className ?? ""} rounded-2xl border border-border bg-surface-high/95 p-5 shadow-elevation-3 backdrop-blur`}
    >
      {content}
    </div>
  );
}
