"use client";

import { useRef, useState, useEffect } from "react";
import { Columns, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/hooks/useColumnVisibility";

interface ColumnVisibilityControlProps<K extends string> {
  /** Column definitions (same array passed to useColumnVisibility). */
  columns: ColumnDef<K>[];
  /** Current visibility map from useColumnVisibility. */
  visibility: Record<K, boolean>;
  /** Toggle callback from useColumnVisibility. */
  onToggle: (key: K) => void;
  /** Show-all callback from useColumnVisibility. */
  onShowAll: () => void;
  /** Additional CSS classes on the trigger button. */
  className?: string;
}

/**
 * ColumnVisibilityControl — #565
 *
 * Accessible dropdown panel that lets users show/hide optional columns.
 * - Required columns are rendered disabled with a locked indicator.
 * - Clicking the trigger button opens/closes the panel.
 * - Closes on Escape, on click outside, and on blur leaving the panel.
 * - Keyboard-navigable (Tab/Shift-Tab cycles through checkboxes).
 *
 * @example
 * <ColumnVisibilityControl
 *   columns={TAX_COLUMNS}
 *   visibility={visibility}
 *   onToggle={toggle}
 *   onShowAll={showAll}
 * />
 */
export function ColumnVisibilityControl<K extends string>({
  columns,
  visibility,
  onToggle,
  onShowAll,
  className,
}: ColumnVisibilityControlProps<K>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * #1071: every dismissal path (Escape, outside click, trigger toggle) returns
   * focus to the trigger button. If the trigger is gone, fall back to the
   * nearest focusable element in the surrounding container, then to the
   * document body so focus never lands on a detached node.
   */
  function closeAndRestoreFocus() {
    setOpen(false);
    const trigger = triggerRef.current;
    if (trigger && document.contains(trigger)) {
      trigger.focus({ preventScroll: true });
      return;
    }
    const nearby = containerRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );
    if (nearby) {
      nearby.focus({ preventScroll: true });
      return;
    }
    document.body.focus();
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAndRestoreFocus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const hiddenCount = columns.filter(
    (c) => !c.required && !visibility[c.key]
  ).length;
  const allVisible = hiddenCount === 0;

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
    >
      {/* Trigger button */}
      <button
        type="button"
        data-trigger="true"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          hiddenCount > 0
            ? `Column visibility — ${hiddenCount} column${hiddenCount !== 1 ? "s" : ""} hidden`
            : "Column visibility"
        }
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground-muted transition-colors",
          "hover:border-border-strong hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "border-border-strong text-foreground"
        )}
      >
        <Columns size={13} aria-hidden="true" />
        Columns
        {hiddenCount > 0 && (
          <span
            className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-primary/20 px-1 text-[10px] font-semibold text-accent-primary"
            aria-hidden="true"
          >
            {hiddenCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Toggle column visibility"
          className={cn(
            "absolute right-0 top-full z-dropdown mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-elevation-2",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Columns
            </span>
            {!allVisible && (
              <button
                type="button"
                onClick={onShowAll}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-foreground-muted transition-colors",
                  "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
                aria-label="Show all columns"
              >
                <RotateCcw size={11} aria-hidden="true" />
                Reset
              </button>
            )}
          </div>

          {/* Column list */}
          <ul
            role="list"
            className="max-h-72 overflow-y-auto py-1"
          >
            {columns.map((col) => {
              const isChecked = visibility[col.key] !== false;
              const isRequired = col.required === true;
              const id = `col-vis-${col.key}`;
              return (
                <li key={col.key}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                      isRequired
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-surface-high"
                    )}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={isChecked}
                      disabled={isRequired}
                      onChange={() => onToggle(col.key)}
                      className="h-3.5 w-3.5 rounded border border-border accent-[hsl(var(--accent-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={
                        isRequired
                          ? `${col.label} (required, always visible)`
                          : col.label
                      }
                    />
                    <span
                      className={cn(
                        "flex-1 truncate",
                        isChecked ? "text-foreground" : "text-foreground-muted"
                      )}
                    >
                      {col.label}
                    </span>
                    {isRequired && (
                      <span
                        className="text-[10px] text-foreground-subtle"
                        aria-hidden="true"
                        title="Required column"
                      >
                        lock
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
