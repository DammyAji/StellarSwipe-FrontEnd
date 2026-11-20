"use client";

import { cn } from "@/lib/utils";
import { incompleteStatusMessage, type CompletenessRequirements } from "@/lib/journalIncomplete";

interface JournalIncompleteFilterProps {
  active: boolean;
  onToggle: () => void;
  /** Number of entries currently missing required details. */
  count: number;
  requirements: CompletenessRequirements;
  onRequirementsChange: (requirements: CompletenessRequirements) => void;
}

/** Toggle that narrows the journal to entries missing required tags or outcome, plus its requirements. */
export function JournalIncompleteFilter({
  active,
  onToggle,
  count,
  requirements,
  onRequirementsChange,
}: JournalIncompleteFilterProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3" role="group" aria-label="Incomplete entries filter" data-testid="journal-incomplete-filter">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          active
            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
            : "border-white/10 bg-background/80 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        {active ? "Showing incomplete entries" : "Needs attention"} ({count})
      </button>
      {active && (
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Clear
        </button>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Requirements</summary>
        <div className="mt-2 flex flex-col gap-1">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={requirements.requireTags}
              onChange={(e) => onRequirementsChange({ ...requirements, requireTags: e.target.checked })}
              className="h-4 w-4 accent-blue-500"
            />
            Every entry has at least one tag
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={requirements.requireOutcome}
              onChange={(e) => onRequirementsChange({ ...requirements, requireOutcome: e.target.checked })}
              className="h-4 w-4 accent-blue-500"
            />
            Completed entries have a win/loss outcome
          </label>
        </div>
      </details>
      <p className="w-full text-xs text-muted-foreground" role="status" aria-live="polite">
        {incompleteStatusMessage(requirements, count)}
      </p>
    </div>
  );
}
