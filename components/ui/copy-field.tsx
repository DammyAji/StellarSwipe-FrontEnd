"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export interface CopyFieldProps {
  /** The full value (wallet address, tx hash, etc.) */
  value: string;
  /** Optional label shown above the field */
  label?: string;
  /** Truncate the displayed value. Default: true */
  truncate?: boolean;
  /** Number of chars to show at start/end when truncated. Default: 8 */
  truncateChars?: number;
  className?: string;
}

/**
 * CopyField — displays a read-only address or hash with an inline
 * {@link CopyButton}. Long values are truncated in the UI while the full
 * string is always copied to the clipboard.
 *
 * Suitable for wallet addresses, transaction hashes, and any opaque token
 * that users need to copy but rarely read character-by-character.
 *
 * @example
 * // Wallet address with label, default truncation (8 chars each side)
 * <CopyField
 *   label="Wallet address"
 *   value="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
 * />
 *
 * @example
 * // Transaction hash, show more characters
 * <CopyField
 *   label="Tx hash"
 *   value="a1b2c3d4e5f6..."
 *   truncateChars={12}
 * />
 *
 * @example
 * // Disable truncation to always show the full value
 * <CopyField value={apiKey} truncate={false} />
 *
 * @see {@link https://storybook.stellarswipe.dev/?path=/docs/ui-copyfield--docs Storybook — CopyField}
 */
export function CopyField({
  value,
  label,
  truncate = true,
  truncateChars = 8,
  className,
}: CopyFieldProps) {
  const display =
    truncate && value.length > truncateChars * 2 + 3
      ? `${value.slice(0, truncateChars)}...${value.slice(-truncateChars)}`
      : value;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2"
        )}
      >
        <span
          className="flex-1 truncate font-mono text-sm text-foreground"
          title={value}
          aria-label={value}
          tabIndex={0}
          onFocus={(e) => {
            const selection = window.getSelection();
            if (!selection) return;
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            selection.removeAllRanges();
            selection.addRange(range);
          }}
        >
          {display}
        </span>
        <CopyButton value={value} label={`Copy ${label ?? "value"}`} />
      </div>
    </div>
  );
}
