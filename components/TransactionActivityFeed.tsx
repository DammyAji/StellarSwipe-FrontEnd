"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowRight,
  Archive,
  ArchiveRestore,
  Clock3,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Download,
} from "lucide-react";
import { useTransactionStore } from "@/store/useTransactionStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TradeFilterPresets } from "@/components/TradeFilterPresets";
import { cn } from "@/lib/utils";
import { RelativeTimestamp } from "@/components/RelativeTimestamp";
import { EmptyState } from "@/components/ui/empty-state";
import { JournalEntryForm } from "@/components/JournalEntryForm";
import { JournalLinkedDetails } from "@/components/JournalLinkedDetails";
import { JournalIncompleteFilter } from "@/components/JournalIncompleteFilter";
import { describeMissing, incompleteEntryMap } from "@/lib/journalIncomplete";
import { useJournalCompletenessStore } from "@/store/useJournalCompletenessStore";
import { deleteJournalEntry, updateJournalEntry } from "@/lib/journalApi";
import { normalizeJournalTags } from "@/lib/journalSchema";
import { VirtualizedList } from "@/components/VirtualizedList";
import { useVirtualActivityList } from "@/hooks/useVirtualActivityList";
import { toast } from "@/lib/toast";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";
import { PrivateValue } from "@/components/PrivateValue";
import { JournalReminderChip } from "@/components/JournalReminderChip";
import { JournalReminderDialog } from "@/components/JournalReminderDialog";
import { JournalRevisionCompare } from "@/components/JournalRevisionCompare";
import { downloadJournalExport } from "@/lib/journalExport";

const TYPE_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Copy Trades", value: "COPY_TRADE" },
  { label: "Swaps", value: "SWAP" },
  { label: "Manual", value: "MANUAL" },
] as const;

const OUTCOME_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Succeeded", value: "SUCCEEDED" },
  { label: "Failed", value: "FAILED" },
] as const;

const SORT_OPTIONS = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Amount (high to low)", value: "amount" },
] as const;

type JournalSortOrder = (typeof SORT_OPTIONS)[number]["value"];

const JOURNAL_FILTER_STORAGE_KEY = "journal-activity-filters-v1";

interface PersistedJournalFilters {
  typeFilter: (typeof TYPE_OPTIONS)[number]["value"];
  statusFilter: (typeof OUTCOME_OPTIONS)[number]["value"];
  sortOrder: JournalSortOrder;
  tagFilters: string[];
}

const DEFAULT_JOURNAL_FILTERS: PersistedJournalFilters = {
  typeFilter: "ALL",
  statusFilter: "ALL",
  sortOrder: "newest",
  tagFilters: [],
};

function readPersistedJournalFilters(): PersistedJournalFilters {
  if (typeof window === "undefined") return DEFAULT_JOURNAL_FILTERS;
  try {
    const raw = window.localStorage.getItem(JOURNAL_FILTER_STORAGE_KEY);
    if (!raw) return DEFAULT_JOURNAL_FILTERS;
    const parsed = JSON.parse(raw) as Partial<PersistedJournalFilters>;
    return {
      typeFilter: parsed.typeFilter ?? DEFAULT_JOURNAL_FILTERS.typeFilter,
      statusFilter: parsed.statusFilter ?? DEFAULT_JOURNAL_FILTERS.statusFilter,
      sortOrder: parsed.sortOrder ?? DEFAULT_JOURNAL_FILTERS.sortOrder,
      tagFilters: Array.isArray(parsed.tagFilters)
        ? normalizeJournalTags(parsed.tagFilters)
        : DEFAULT_JOURNAL_FILTERS.tagFilters,
    };
  } catch {
    return DEFAULT_JOURNAL_FILTERS;
  }
}

function persistJournalFilters(filters: PersistedJournalFilters) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      JOURNAL_FILTER_STORAGE_KEY,
      JSON.stringify(filters)
    );
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

/** Local calendar day of a timestamp as YYYY-MM-DD, matching `<input type="date">` values. */
function toDateKey(timestamp: number) {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const statusStyles = {
  PENDING: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  SUCCEEDED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  FAILED: "bg-red-500/10 text-red-300 border-red-500/20",
};

const outcomeLabels = {
  WIN: "Win",
  LOSS: "Loss",
  PENDING: "Pending",
};

/**
 * Height of a single transaction row inside the virtualized list.
 * Rows are fixed-height cards. 148px comfortably fits a two-line header,
 * the stats row, and the action buttons at default font size.
 *
 * When a row is being edited, the JournalEntryForm is rendered in a
 * non-virtualized slot that sits above the list so the variable height of the
 * form does not disturb the virtualizer's layout.
 */
const ROW_HEIGHT = 148;

/**
 * Number of rows to keep rendered outside the visible viewport (overscan).
 * A value of 3 ensures smooth scrolling without flicker while limiting
 * total DOM nodes.
 */
const OVERSCAN = 3;

/**
 * Threshold (px from bottom) at which we trigger loading more records.
 * Wire this up to your pagination / infinite-query hook via `onLoadMore`.
 */
const LOAD_MORE_THRESHOLD = 300;

/**
 * Virtualized height of the list container.
 * The list takes up to this height and scrolls internally.
 * Large enough to show ~5 rows comfortably without requiring a full-page scroll.
 */
const LIST_CONTAINER_HEIGHT = "min(60vh, 800px)";

export function TransactionActivityFeed() {
  const history = useTransactionStore((state) => state.history);
  const pendingIds = useTransactionStore((state) => state.pendingIds);
  const failedIds = useTransactionStore((state) => state.failedIds);
  const updateTransactionStatus = useTransactionStore(
    (state) => state.updateTransactionStatus
  );
  const removeTransaction = useTransactionStore(
    (state) => state.removeTransaction
  );
  const markPending = useTransactionStore((state) => state.markPending);
  const clearPending = useTransactionStore((state) => state.clearPending);
  const markFailed = useTransactionStore((state) => state.markFailed);
  const clearFailed = useTransactionStore((state) => state.clearFailed);
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const updateTransaction = useTransactionStore(
    (state) => state.updateTransaction
  );

  const [typeFilter, setTypeFilter] =
    useState<(typeof TYPE_OPTIONS)[number]["value"]>("ALL");
  const [statusFilter, setStatusFilter] =
    useState<(typeof OUTCOME_OPTIONS)[number]["value"]>("ALL");
  const [sortOrder, setSortOrder] = useState<JournalSortOrder>("newest");
  // Entries must carry every selected tag (AND) so each tag narrows the list.
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [walletFilter, setWalletFilter] = useState("ALL");
  // Inclusive local calendar days (YYYY-MM-DD); empty means unbounded.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const requirements = useJournalCompletenessStore((state) => state.requirements);
  const setRequirements = useJournalCompletenessStore((state) => state.setRequirements);
  const incompleteMap = useMemo(() => incompleteEntryMap(history, requirements), [history, requirements]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Track the filtered list length so we can detect when new records are
  // appended without resetting scroll position.

  // Restore persisted filter/sort state on mount.
  useEffect(() => {
    const persisted = readPersistedJournalFilters();
    setTypeFilter(persisted.typeFilter);
    setStatusFilter(persisted.statusFilter);
    setSortOrder(persisted.sortOrder);
    setTagFilters(persisted.tagFilters);
  }, []);

  // Persist whenever the user changes a filter or sort control.
  useEffect(() => {
    persistJournalFilters({ typeFilter, statusFilter, sortOrder, tagFilters });
  }, [typeFilter, statusFilter, sortOrder, tagFilters]);

  // Simulate pending→success/failure transitions (existing behaviour preserved).
  useEffect(() => {
    const pending = history.filter((item) => item.status === "PENDING");
    if (pending.length === 0) return;

    const timer = window.setTimeout(() => {
      const item = pending[0];
      const nextStatus = Math.random() > 0.25 ? "SUCCEEDED" : "FAILED";
      const nextOutcome = nextStatus === "SUCCEEDED" ? "WIN" : "LOSS";
      updateTransactionStatus(item.id, nextStatus, nextOutcome);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [history, updateTransactionStatus]);

  // ── Delete handler with optimistic update + rollback ───────────────────

  const handleDelete = useCallback(
    async (entry: TransactionHistoryItem) => {
      setDeletingId(entry.id);
      removeTransaction(entry.id);
      setSelectedIds((prev) => prev.filter((id) => id !== entry.id));

      try {
        await deleteJournalEntry(entry.id);
        toast.success("Entry deleted", {
          description: `${entry.assetPair} removed from journal.`,
          duration: 2500,
        });
      } catch (err) {
        addTransaction(entry);
        const message =
          err instanceof Error ? err.message : "Failed to delete entry.";
        toast.error("Delete failed", {
          description: message,
          duration: 4000,
          action: {
            label: "Retry",
            onClick: () => {
              removeTransaction(entry.id);
              deleteJournalEntry(entry.id)
                .then(() => {
                  toast.success("Entry deleted");
                })
                .catch(() => {
                  addTransaction(entry);
                  toast.error("Still unable to delete");
                });
            },
          },
        });
      } finally {
        setDeletingId(null);
      }
    },
    [removeTransaction, addTransaction]
  );

  const allTags = useMemo(
    () => Array.from(new Set(history.flatMap((item) => item.tags ?? []))).sort(),
    [history]
  );

  const allAssets = useMemo(
    () => Array.from(new Set(history.map((item) => item.assetPair))).sort(),
    [history]
  );

  const allWallets = useMemo(
    () =>
      Array.from(
        new Set(
          history
            .map((item) => item.walletAddress)
            .filter((address): address is string => !!address)
        )
      ).sort(),
    [history]
  );

  const filtered = useMemo(() => {
    const matches = history
      .filter((item) => (item.archivedAt !== undefined) === showArchived)
      .filter((item) => typeFilter === "ALL" || item.type === typeFilter)
      .filter((item) => statusFilter === "ALL" || item.status === statusFilter)
      .filter((item) => assetFilter === "ALL" || item.assetPair === assetFilter)
      .filter(
        (item) => walletFilter === "ALL" || item.walletAddress === walletFilter
      )
      .filter((item) => {
        if (!dateFrom && !dateTo) return true;
        const day = toDateKey(item.timestamp);
        return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
      })
      .filter((item) =>
        tagFilters.every((tag) => (item.tags ?? []).includes(tag))
      )
      .filter((item) => !incompleteOnly || incompleteMap.has(item.id));
    return [...matches].sort((a, b) => {
      if (sortOrder === "oldest") return a.timestamp - b.timestamp;
      if (sortOrder === "amount")
        return parseFloat(b.amount) - parseFloat(a.amount);
      return b.timestamp - a.timestamp;
    });
  }, [
    history,
    showArchived,
    typeFilter,
    statusFilter,
    assetFilter,
    walletFilter,
    dateFrom,
    dateTo,
    sortOrder,
    tagFilters,
    incompleteOnly,
    incompleteMap,
  ]);

  // Drop selections that are no longer visible so bulk actions never touch
  // rows the user cannot see.
  useEffect(() => {
    const visibleIds = new Set(filtered.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filtered]);

  const hasActiveFilters =
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    assetFilter !== "ALL" ||
    walletFilter !== "ALL" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortOrder !== "newest" ||
    tagFilters.length > 0 ||
    incompleteOnly;

  const clearFilters = useCallback(() => {
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setAssetFilter("ALL");
    setWalletFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
    setTagFilters([]);
    setIncompleteOnly(false);
  }, []);

  // Changing any filter remounts the list so scroll position resets to the top
  // instead of pointing past the end of a narrowed result set.
  const listKey = JSON.stringify([
    showArchived,
    typeFilter,
    statusFilter,
    assetFilter,
    walletFilter,
    dateFrom,
    dateTo,
    sortOrder,
    tagFilters,
    incompleteOnly,
  ]);

  // ── Selection + bulk archive / restore ─────────────────────────────────

  const archivedCount = history.filter(
    (item) => item.archivedAt !== undefined
  ).length;

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((item) => selectedIds.includes(item.id));

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allVisibleSelected ? [] : filtered.map((item) => item.id));
  }, [allVisibleSelected, filtered]);

  const toggleArchivedView = useCallback(() => {
    setShowArchived((prev) => !prev);
    setSelectedIds([]);
  }, []);

  // Optimistically archives (or restores) the given entries, then confirms each
  // with the API. Entries whose request fails are rolled back to their previous
  // state so the user can retry them.
  const runBulkArchive = useCallback(
    async (ids: string[], archive: boolean) => {
      const archivedAt = archive ? Date.now() : undefined;
      const previous = new Map(
        history
          .filter((item) => ids.includes(item.id))
          .map((item): [string, number | undefined] => [
            item.id,
            item.archivedAt,
          ])
      );

      setIsBulkUpdating(true);
      ids.forEach((id) => updateTransaction(id, { archivedAt }));

      const results = await Promise.allSettled(
        ids.map((id) => updateJournalEntry(id, { archivedAt }))
      );
      const failed = ids.filter(
        (_, index) => results[index].status === "rejected"
      );
      failed.forEach((id) =>
        updateTransaction(id, { archivedAt: previous.get(id) })
      );

      setIsBulkUpdating(false);
      setIsArchiveConfirmOpen(false);
      setSelectedIds([]);

      const succeededCount = ids.length - failed.length;
      const noun = (count: number) => (count === 1 ? "entry" : "entries");

      if (succeededCount > 0) {
        toast.success(
          `${succeededCount} ${noun(succeededCount)} ${
            archive ? "archived" : "restored"
          }`,
          {
            description: archive
              ? "Archived entries are kept and can be restored any time."
              : undefined,
            duration: 4000,
            action: archive
              ? {
                  label: "View archived",
                  onClick: () => setShowArchived(true),
                }
              : undefined,
          }
        );
      }

      if (failed.length > 0) {
        toast.error(
          `${failed.length} ${noun(failed.length)} failed to ${
            archive ? "archive" : "restore"
          }`,
          {
            description: "Changes were rolled back. Select them to retry.",
            duration: 4000,
          }
        );
      }
    },
    [history, updateTransaction]
  );

  const toggleTagFilter = useCallback((tag: string) => {
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Exports exactly the selected entries; an empty selection, a generation
  // failure or a blocked download is reported with a next step instead of
  // success feedback.
  const handleExportSelected = useCallback(() => {
    const selected = history.filter((item) => selectedIds.includes(item.id));
    const result = downloadJournalExport(selected);
    if (!result.ok) {
      if (result.reason === "empty-selection") {
        toast.error("Nothing selected to export", {
          description: result.message,
          duration: 4000,
        });
        return;
      }
      if (result.reason === "download-blocked") {
        toast.error("Download blocked", {
          description: `${result.message} Allow downloads for this site, then select the entries and export again.`,
          duration: 6000,
        });
        return;
      }
      toast.error("Export failed", {
        description: `${result.message} Try exporting again, or select fewer entries.`,
        duration: 6000,
      });
      return;
    }
    toast.success(
      `Exported ${result.count} ${result.count === 1 ? "entry" : "entries"}`,
      {
        description: `${result.filename} was saved to your downloads.`,
        duration: 3000,
      }
    );
  }, [history, selectedIds]);

  // Clears only the tag selection so type, status and sort stay as they are.
  const clearTagFilters = useCallback(() => setTagFilters([]), []);

  // ── Virtual activity list (#777) ───────────────────────────────────────
  // The hook computes the visible slice of `filtered` based on scroll
  // position.  Loading more records appends to the total height without
  // disturbing already-rendered rows or resetting scroll position.
  const virtualList = useVirtualActivityList({
    items: filtered,
    itemHeight: ROW_HEIGHT,
    overscan: OVERSCAN,
    loadMoreThreshold: LOAD_MORE_THRESHOLD,
  });

  // ── Editing state ──────────────────────────────────────────────────────

  const editEntry = editingId
    ? history.find((item) => item.id === editingId) ?? null
    : null;

  // ── Row renderer (used by VirtualizedList) ─────────────────────────────

  const renderRow = useCallback(
    (item: TransactionHistoryItem, _index: number) => {
      const isPending = pendingIds.includes(item.id);
      const isFailed = failedIds.includes(item.id);
      const isDeleting = deletingId === item.id;

      return (
        <article
          className={cn(
            "w-full rounded-3xl border border-white/10 bg-background/80 p-4 shadow-sm transition-all",
            isFailed && "border-amber-500/30 bg-amber-500/5",
            isDeleting && "opacity-50"
          )}
          aria-label={`${item.assetPair} transaction, ${item.status}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleSelected(item.id)}
                disabled={isDeleting}
                aria-label={`Select ${item.assetPair} entry`}
                className="h-4 w-4 accent-blue-500"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {item.assetPair}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.type.replace("_", " ")}
                </p>
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[10px] text-blue-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {incompleteOnly && incompleteMap.has(item.id) && (
                  <p className="mt-1 text-[11px] font-medium text-amber-300">
                    {describeMissing(incompleteMap.get(item.id) ?? [])}
                  </p>
                )}
              </div>
              {isPending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
                  <Loader2 size={10} className="animate-spin" />
                  Syncing
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                  <AlertCircle size={10} />
                  Offline
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  statusStyles[item.status]
                )}
              >
                {item.status}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                {outcomeLabels[item.outcome]}
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Amount
                </p>
                <p className="text-sm font-medium text-foreground">
                  <PrivateValue text="••••">{`${item.amount} ${item.token}`}</PrivateValue>
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Price
                </p>
                <p className="text-sm font-medium text-foreground">
                  <PrivateValue text="••••">{`$${item.price}`}</PrivateValue>
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Time
                </p>
                <RelativeTimestamp timestamp={new Date(item.timestamp)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {editingId !== item.id && (
                <button
                  onClick={() => setEditingId(item.id)}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
                  aria-label={`Edit ${item.assetPair} entry`}
                >
                  <Pencil size={12} />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={() => setHistoryId(item.id)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20 hover:bg-white/10"
                aria-label={`Compare revisions of ${item.assetPair} entry`}
              >
                History
              </button>

              <JournalReminderChip entryId={item.id} assetPair={item.assetPair} onOpen={setReminderId} />

              <button
                onClick={() => handleDelete(item)}
                disabled={isDeleting || editingId === item.id}
                className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1 text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
                aria-label={`Delete ${item.assetPair} entry`}
              >
                {isDeleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>

              <button
                type="button"
                onClick={() => setDetailsId(item.id)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20 hover:bg-white/10"
                aria-label={`View linked details for ${item.assetPair} entry`}
              >
                Linked details
              </button>

              {item.hash ? (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${item.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20"
                >
                  Details <ArrowRight size={12} />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-muted-foreground">
                  <Clock3 size={12} /> Awaiting hash
                </span>
              )}
            </div>
          </div>
        </article>
      );
    },
    [
      pendingIds,
      failedIds,
      deletingId,
      editingId,
      selectedIds,
      handleDelete,
      toggleSelected,
      incompleteOnly,
      incompleteMap,
    ]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-sm sm:p-5">
      {/* ── Header / controls ───────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Transaction Activity
          </p>
          <p className="text-xs text-muted-foreground">
            Recent copy trades, status updates, and history in one place.
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter and sort journal activity"
        >
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Type
          </label>
          <select
            value={typeFilter}
            aria-label="Filter by transaction type"
            onChange={(e) =>
              setTypeFilter(
                e.target.value as (typeof TYPE_OPTIONS)[number]["value"]
              )
            }
            className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter by status"
          >
            {OUTCOME_OPTIONS.map((option) => {
              const selected = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    selected
                      ? "border-blue-400/40 bg-blue-400/10 text-blue-300"
                      : "border-white/10 bg-background/80 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Sort
          </label>
          <select
            value={sortOrder}
            aria-label="Sort journal activity"
            onChange={(e) => setSortOrder(e.target.value as JournalSortOrder)}
            className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <TradeFilterPresets
        current={{ typeFilter, statusFilter, sortOrder }}
        onApply={(filter) => {
          setTypeFilter(filter.typeFilter);
          setStatusFilter(filter.statusFilter);
          setSortOrder(filter.sortOrder);
        }}
      />

      <JournalIncompleteFilter
        active={incompleteOnly}
        onToggle={() => setIncompleteOnly((prev) => !prev)}
        count={incompleteMap.size}
        requirements={requirements}
        onRequirementsChange={setRequirements}
      />

      {/* ── Asset, wallet and date filters ─────────────────────────────── */}
      <div
        className="mb-4 flex flex-wrap items-end gap-3"
        role="group"
        aria-label="Filter by asset, wallet, and date"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="journal-filter-asset"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          >
            Asset
          </label>
          <select
            id="journal-filter-asset"
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}
            className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All assets</option>
            {allAssets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </div>
        {allWallets.length > 0 && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="journal-filter-wallet"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
            >
              Wallet
            </label>
            <select
              id="journal-filter-wallet"
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All wallets</option>
              {allWallets.map((wallet) => (
                <option key={wallet} value={wallet}>
                  {wallet}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="journal-filter-date-from"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          >
            From
          </label>
          <input
            id="journal-filter-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="journal-filter-date-to"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          >
            To
          </label>
          <input
            id="journal-filter-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-full border border-white/10 bg-background/80 px-3 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ── Tag filter (multi-select, entries must match every selected tag) ── */}
      {allTags.length > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter by tag"
        >
          <span className="mr-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Tags
          </span>
          {allTags.map((tag) => {
            const selected = tagFilters.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTagFilter(tag)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  selected
                    ? "border-blue-400/40 bg-blue-400/10 text-blue-300"
                    : "border-white/10 bg-background/80 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                #{tag}
              </button>
            );
          })}
          {tagFilters.length > 0 && (
            <button
              type="button"
              onClick={clearTagFilters}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Clear tags
            </button>
          )}
        </div>
      )}

      {/* ── Bulk actions: selection, archive / restore, archived view ───── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
        <label className="inline-flex items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            disabled={filtered.length === 0}
            aria-label="Select all visible entries"
            className="h-4 w-4 accent-blue-500"
          />
          {selectedIds.length} selected
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={toggleArchivedView}
            aria-pressed={showArchived}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20 hover:bg-white/10"
          >
            <Archive size={12} />
            {showArchived ? "Back to journal" : `View archived (${archivedCount})`}
          </button>
          <button
            type="button"
            onClick={() =>
              showArchived
                ? runBulkArchive(selectedIds, false)
                : setIsArchiveConfirmOpen(true)
            }
            disabled={selectedIds.length === 0 || isBulkUpdating}
            className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-blue-300 transition hover:border-blue-400/50 hover:bg-blue-400/20 disabled:opacity-50"
          >
            {isBulkUpdating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : showArchived ? (
              <ArchiveRestore size={12} />
            ) : (
              <Archive size={12} />
            )}
            {showArchived ? "Restore selected" : "Archive selected"}
          </button>
          <button
            type="button"
            onClick={handleExportSelected}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20 hover:bg-white/10"
          >
            <Download size={12} aria-hidden="true" />
            Export selected (JSON)
          </button>
        </div>
      </div>

      {/* ── Inline edit form (rendered outside the virtualizer so its variable
           height does not disturb the layout calculation) ──────────────── */}
      {editEntry && (
        <div className="mb-4">
          <JournalEntryForm
            editEntry={editEntry}
            onEditComplete={() => setEditingId(null)}
            onEditCancel={() => setEditingId(null)}
          />
        </div>
      )}

      <JournalLinkedDetails
        entry={detailsId ? history.find((item) => item.id === detailsId) ?? null : null}
        onClose={() => setDetailsId(null)}
      />

      {/* ── Failed sync banner ──────────────────────────────────────────── */}
      {failedIds.length > 0 && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400"
          role="alert"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">
            {failedIds.length} entr{failedIds.length === 1 ? "y" : "ies"} failed
            to sync. Changes are saved locally and will be retried automatically.
          </span>
          <button
            onClick={() => {
              failedIds.forEach((id) => clearFailed(id));
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium hover:bg-amber-500/20 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No activity for these filters"
          description="Try adjusting or clearing the filters to see matching transactions."
          className="rounded-2xl border-dashed bg-white/5 py-8"
        />
      ) : (
        <>
          {/* Screen-reader live region: announces newly-loaded record counts
              without disrupting focus or the reading position (#777).      */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {filtered.length} transaction
            {filtered.length === 1 ? "" : "s"} shown.
          </p>

          {/*
           * VirtualizedList renders only the rows visible inside the container
           * plus `overscan` rows above and below.  The useVirtualActivityList
           * hook (virtualList) provides the scroll-position tracking and the
           * visible-items slice; VirtualizedList handles the DOM projection.
           * Loading additional records via onEndReached does NOT reset the
           * scroll position — the total height grows without touching
           * already-rendered items.
           */}
          <VirtualizedList
            key={listKey}
            items={filtered}
            itemHeight={ROW_HEIGHT}
            overscan={OVERSCAN}
            renderItem={renderRow}
            className="rounded-2xl"
            style={{ height: LIST_CONTAINER_HEIGHT } as React.CSSProperties}
            endReachedThreshold={LOAD_MORE_THRESHOLD}
          />
        </>
      )}

      <JournalRevisionCompare
        entry={historyId ? history.find((item) => item.id === historyId) ?? null : null}
        onClose={() => setHistoryId(null)}
      />
      <JournalReminderDialog
        entry={reminderId ? history.find((item) => item.id === reminderId) ?? null : null}
        onClose={() => setReminderId(null)}
      />

      {/* ── Archive confirmation ────────────────────────────────────────── */}
      <Dialog
        open={isArchiveConfirmOpen}
        onOpenChange={(open) => {
          if (!isBulkUpdating) setIsArchiveConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>
              Archive {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "entry" : "entries"}?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Archived entries are hidden from your journal but kept intact.
              You can restore them any time from the archived view.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setIsArchiveConfirmOpen(false)}
              disabled={isBulkUpdating}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => runBulkArchive(selectedIds, true)}
              disabled={isBulkUpdating}
              className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm text-blue-300 transition hover:bg-blue-400/20 disabled:opacity-50"
            >
              {isBulkUpdating && <Loader2 size={12} className="animate-spin" />}
              Archive
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
