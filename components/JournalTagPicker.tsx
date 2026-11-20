"use client";

import { useMemo } from "react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { countTags, orderTagsForPicker, type PickerTag } from "@/lib/journalPinnedTags";
import { useJournalPinnedTagsStore } from "@/store/useJournalPinnedTagsStore";
import { useTransactionStore } from "@/store/useTransactionStore";

interface JournalTagPickerProps {
  selected: readonly string[];
  onToggle: (tag: string) => void;
  disabled?: boolean;
}

function TagChip({
  item,
  disabled,
  onToggle,
  onTogglePin,
}: {
  item: PickerTag;
  disabled?: boolean;
  onToggle: (tag: string) => void;
  onTogglePin: (tag: string) => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center overflow-hidden rounded-full border text-xs",
        item.selected ? "border-blue-400/50 bg-blue-400/20 text-blue-200" : "border-white/10 bg-white/5 text-slate-300"
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(item.tag)}
        disabled={disabled}
        aria-pressed={item.selected}
        className="px-2.5 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
      >
        {item.tag}
        <span className="ml-1 text-[10px] text-slate-500">{item.count}</span>
      </button>
      <button
        type="button"
        onClick={() => onTogglePin(item.tag)}
        disabled={disabled}
        aria-pressed={item.pinned}
        aria-label={item.pinned ? `Unpin tag ${item.tag}` : `Pin tag ${item.tag}`}
        className="border-l border-white/10 px-1.5 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
      >
        {item.pinned ? <PinOff size={12} aria-hidden="true" /> : <Pin size={12} aria-hidden="true" />}
      </button>
    </span>
  );
}

/**
 * Tag shortcuts for the journal editor: pinned tags stay at the top, the rest follow
 * by usage. Pinning only changes this list's order; no entry is modified.
 */
export function JournalTagPicker({ selected, onToggle, disabled }: JournalTagPickerProps) {
  const history = useTransactionStore((state) => state.history);
  const pinned = useJournalPinnedTagsStore((state) => state.pinned);
  const togglePin = useJournalPinnedTagsStore((state) => state.toggle);

  const groups = useMemo(
    () => orderTagsForPicker(countTags(history), pinned, selected),
    [history, pinned, selected]
  );

  if (groups.pinned.length === 0 && groups.others.length === 0) {
    return (
      <p className="text-xs text-slate-500" data-testid="journal-tag-picker-empty">
        No tags yet. Tags you add to entries will appear here so you can pin the ones you use most.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="journal-tag-picker">
      {groups.pinned.length > 0 && (
        <div role="group" aria-label="Pinned tags" className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Pinned</span>
          {groups.pinned.map((item) => (
            <TagChip key={item.tag} item={item} disabled={disabled} onToggle={onToggle} onTogglePin={togglePin} />
          ))}
        </div>
      )}
      {groups.others.length > 0 && (
        <div role="group" aria-label="Other tags" className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Tags</span>
          {groups.others.slice(0, 12).map((item) => (
            <TagChip key={item.tag} item={item} disabled={disabled} onToggle={onToggle} onTogglePin={togglePin} />
          ))}
        </div>
      )}
    </div>
  );
}
