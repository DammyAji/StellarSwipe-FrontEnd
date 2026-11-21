"use client";

import { AlignJustify, LayoutGrid, List } from "lucide-react";
import { useFeedDensityStore } from "@/store/useFeedDensityStore";
import { cn } from "@/lib/utils";

interface FeedDensityToggleProps {
  className?: string;
}

export function FeedDensityToggle({ className }: FeedDensityToggleProps) {
  const { density, setDensity } = useFeedDensityStore();
  const isCompact = density === "compact";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isCompact}
      aria-label={
        isCompact
          ? "Switch to comfortable density"
          : "Switch to compact density"
      }
      onClick={() => setDensity(isCompact ? "comfortable" : "compact")}
      title={isCompact ? "Comfortable view" : "Compact view"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isCompact
          ? "border-accent-sky/50 bg-accent-sky/10 text-accent-sky hover:bg-accent-sky/20"
          : "border-border bg-foreground/5 text-foreground-muted hover:border-border-strong hover:text-foreground",
        className
      )}
    >
      {isCompact ? (
        <List size={12} aria-hidden="true" />
      ) : (
        <AlignJustify size={12} aria-hidden="true" />
      )}
      <span>{isCompact ? "Compact" : "Comfortable"}</span>
    </button>
  );
}

/**
 * #1033: switches the signal feed between card and list presentations.
 * The choice is persisted (localStorage) so it survives navigation and reloads.
 */
export function FeedLayoutToggle({ className }: FeedDensityToggleProps) {
  const { layout, setLayout } = useFeedDensityStore();
  const isList = layout === "list";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isList}
      aria-label={isList ? "Switch to card view" : "Switch to list view"}
      title={isList ? "Card view" : "List view"}
      onClick={() => setLayout(isList ? "card" : "list")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isList
          ? "border-accent-sky/50 bg-accent-sky/10 text-accent-sky hover:bg-accent-sky/20"
          : "border-border bg-foreground/5 text-foreground-muted hover:border-border-strong hover:text-foreground",
        className
      )}
    >
      {isList ? (
        <List size={12} aria-hidden="true" />
      ) : (
        <LayoutGrid size={12} aria-hidden="true" />
      )}
      <span>{isList ? "List" : "Cards"}</span>
    </button>
  );
}
