"use client";

import * as React from "react";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/useClipboard";

export interface CopyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The text value to copy to the clipboard */
  value: string;
  /** Label shown in the tooltip / aria-label before copying */
  label?: string;
  /** How long (ms) the "Copied!" state persists. Default: 2000 */
  resetDelay?: number;
  /**
   * When true, the manual-copy fallback renders the value in a read-only,
   * selectable input so the user can copy it by hand after a clipboard
   * failure. Default: false (hint text only).
   */
  showValueOnError?: boolean;
}

/**
 * CopyButton — copies `value` to the clipboard on click and shows a brief
 * "Copied!" confirmation that disappears automatically.
 *
 * When the clipboard API is unavailable or permission is denied, the button
 * enters an error state and an inline recovery hint appears so the user
 * can copy manually. Sensitive values are never stored in notifications or
 * persistent state — only success/failure is tracked.
 *
 * @example
 * // Standalone copy button with a custom label
 * <CopyButton value={walletAddress} label="Copy address" />
 *
 * @example
 * // Keep the "Copied!" state for 5 seconds
 * <CopyButton value={txHash} label="Copy tx hash" resetDelay={5000} />
 *
 * @example
 * // Inside a toolbar, icon-only appearance via className
 * <CopyButton
 *   value={apiKey}
 *   label="Copy API key"
 *   className="border-0 bg-transparent p-1"
 * />
 *
 * @see {@link https://storybook.stellarswipe.dev/?path=/docs/ui-copybutton--docs Storybook — CopyButton}
 */
const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, label = "Copy", resetDelay = 2000, showValueOnError = false, className, ...props }, ref) => {
    const { copied, status, errorMessage, copy, reset } = useClipboard({ resetDelay });

    const isCopied = status === "copied";
    const isError = status === "error";

    return (
      <div className="inline-flex flex-col gap-1">
        <button
          ref={ref}
          type="button"
          aria-label={
            isCopied
              ? "Copied!"
              : isError
              ? `${label} — failed, see recovery hint`
              : label
          }
          title={isCopied ? "Copied!" : isError ? "Copy failed" : label}
          onClick={isError ? reset : () => copy(value)}
          className={cn(
            // Base styles
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
            "transition-all duration-200 select-none",
            // Default appearance
            "border border-input bg-background text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
            // Copied state
            isCopied &&
              "border-accent-success/40 bg-accent-success/10 text-accent-success",
            // Error state
            isError &&
              "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
            className
          )}
          {...props}
        >
          <span
            className={cn(
              "transition-transform duration-200",
              isCopied ? "scale-110" : "scale-100"
            )}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : isError ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <span>
            {isCopied ? "Copied!" : isError ? "Retry" : label}
          </span>
        </button>

        {/*
          Manual-copy fallback — shown only when the clipboard API fails.
          The hint tells the user *how* to copy without exposing the value
          in a persistent notification or log.
        */}
        {isError && errorMessage && (
          <p
            role="alert"
            className="max-w-xs rounded border border-yellow-500/20 bg-yellow-500/5 px-2 py-1.5 text-[11px] leading-snug text-yellow-700 dark:text-yellow-300"
          >
            {errorMessage}
          </p>
        )}

        {isError && showValueOnError && (
          <input
            type="text"
            readOnly
            value={value}
            aria-label="Copy manually"
            onFocus={(event) => event.currentTarget.select()}
            className="w-full max-w-xs rounded border border-input bg-background px-2 py-1 text-[11px] text-foreground"
          />
        )}
      </div>
    );
  }
);
CopyButton.displayName = "CopyButton";

export { CopyButton };
