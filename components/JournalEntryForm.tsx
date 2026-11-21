"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useTransactionStore, type TransactionHistoryItem } from "@/store/useTransactionStore";
import { journalEntrySchema, normalizeJournalTags, type JournalEntry } from "@/lib/journalSchema";
import { createJournalEntry, updateJournalEntry, JournalApiError } from "@/lib/journalApi";
import { Button } from "@/components/ui/button";
import { ValidationSummary } from "@/components/forms/ValidationSummary";
import { Plus, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useKeyboardInset, useKeepFocusedFieldVisible } from "@/hooks/useKeyboardInset";
import { JournalTagPicker } from "@/components/JournalTagPicker";
import { useJournalDraftStore } from "@/store/useJournalDraftStore";
import { findJournalEntryByHash } from "@/lib/journalFromTransaction";

type AutosaveStatus = "idle" | "saving" | "saved" | "offline" | "failed";

interface JournalDraft {
  data: Partial<JournalEntry>;
  savedAt: number;
  /** Server revision the draft was edited from. */
  baseRevision?: number;
}

const DRAFT_PREFIX = "journal-draft:";
const AUTOSAVE_DELAY_MS = 800;

function readDraft(key: string): JournalDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as JournalDraft;
    return draft && typeof draft === "object" && draft.data ? draft : null;
  } catch {
    return null;
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

const AUTOSAVE_MESSAGES: Record<AutosaveStatus, string> = {
  idle: "",
  saving: "Saving draft…",
  saved: "Draft saved on this device",
  offline: "Offline — edits are kept on this device",
  failed: "Save failed — your edits are still here",
};

interface JournalEntryFormProps {
  /** If provided, the form opens in edit mode for this entry. */
  editEntry?: TransactionHistoryItem | null;
  /** Called after a successful submit (edit mode closes). */
  onEditComplete?: () => void;
  /** Called to close edit mode without saving. */
  onEditCancel?: () => void;
}

// Maps schema field names to their input element ids so the validation
// summary's links can focus the exact field.
const FIELD_IDS: Record<string, string> = {
  date: "journal-entry-date",
  assetPair: "journal-entry-asset-pair",
  amount: "journal-entry-amount",
  price: "journal-entry-price",
  token: "journal-entry-token",
  fee: "journal-entry-fee",
};

export function JournalEntryForm({
  editEntry,
  onEditComplete,
  onEditCancel,
}: JournalEntryFormProps) {
  const store = useTransactionStore;
  const isEditing = !!editEntry;

  const [isOpen, setIsOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<JournalEntry>>({
    date: editEntry
      ? new Date(editEntry.timestamp).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    assetPair: editEntry?.assetPair || "",
    amount: editEntry?.amount || "",
    price: editEntry?.price || "",
    token: editEntry?.token || "",
    fee: editEntry?.fee || "",
    type: (editEntry?.type as JournalEntry["type"]) || "MANUAL",
    status: (editEntry?.status as JournalEntry["status"]) || "SUCCEEDED",
    outcome: (editEntry?.outcome as JournalEntry["outcome"]) || "PENDING",
    notes: editEntry?.notes ?? "",
    tags: editEntry?.tags ?? [],
  });
  const [tagInput, setTagInput] = useState("");

  // Transaction this draft was started from (#1118). Kept in a ref for the
  // submit callbacks and mirrored in state for the banner.
  const linkedRef = useRef<{ hash: string | null; network: TransactionHistoryItem["network"] | null } | null>(null);
  const [linkedInfo, setLinkedInfo] = useState<{ context: Array<{ label: string; value: string }>; missing: string[] } | null>(null);
  const pendingDraft = useJournalDraftStore((s) => s.pending);
  const consumeDraft = useJournalDraftStore((s) => s.consume);

  const [errors, setErrors] = useState<Record<string, string>>({});
  // Fields the user has left (blurred) at least once. Only those show inline
  // errors before the first submit attempt, so a fresh form stays quiet.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Set once a save succeeds so the user gets explicit success feedback.
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // ── Autosave & recovery ────────────────────────────────────────────
  const draftKey = `${DRAFT_PREFIX}${editEntry?.id ?? "new"}`;
  const { isOffline } = useNetworkStatus();
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [recoverableDraft, setRecoverableDraft] = useState<JournalDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const initialDataRef = useRef<string | null>(null);
  // Server revision the edits are based on. Saves are sent with it so the
  // server rejects them if a newer version exists; a restored draft brings
  // back the revision it was made against.
  const baseRevisionRef = useRef<number | undefined>(editEntry?.revision);
  const [hasConflict, setHasConflict] = useState(false);
  // True once the user has attempted to submit, so the validation summary
  // only appears after a failed submit — never on first render.
  const [submitted, setSubmitted] = useState(false);

  // Submit guard: prevents duplicate submissions on both click and Enter paths
  const { isSubmitting, guard, submitButtonProps } = useSubmitGuard();

  // Ref to capture the latest formData so async retry callbacks always
  // read the current state — avoids stale closures.
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // ── Mobile keyboard handling ───────────────────────────────────────
  // Lift the sticky action bar above the on-screen keyboard and keep the
  // focused field visible between the page top and that bar.
  const formRef = useRef<HTMLFormElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const [actionBarHeight, setActionBarHeight] = useState(72);
  const { inset: keyboardInset, isOpen: keyboardOpen } = useKeyboardInset();
  const keepFocusedFieldVisible = useKeepFocusedFieldVisible(formRef, {
    inset: keyboardInset,
    actionBarHeight,
  });

  useEffect(() => {
    const bar = actionBarRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setActionBarHeight(Math.round(entry.contentRect.height) + 24);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // ── Dirty tracking ─────────────────────────────────────────────────
  // The form is "dirty" once the user makes any meaningful edit. We track
  // this with a simple flag rather than deep-comparing the full form state,
  // which avoids edge cases around default values.
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => {
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  // ── Unsaved-changes protection ─────────────────────────────────────
  const { markSaved, confirmNavigation } = useUnsavedChanges({
    isDirty: isDirty && (isOpen || isEditing),
    message: "Your journal entry has unsaved changes. Leave anyway?",
  });

  // Offer recovery of an interrupted draft whenever the editor opens.
  const editorOpen = isOpen || isEditing;
  useEffect(() => {
    if (!editorOpen) {
      setDraftChecked(false);
      return;
    }
    initialDataRef.current = JSON.stringify(formDataRef.current);
    const draft = readDraft(draftKey);
    setRecoverableDraft(
      draft && JSON.stringify(draft.data) !== initialDataRef.current ? draft : null
    );
    setDraftChecked(true);
  }, [editorOpen, draftKey]);

  const persistDraft = useCallback(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          data: formDataRef.current,
          savedAt: Date.now(),
          baseRevision: baseRevisionRef.current,
        })
      );
      setAutosaveStatus(navigator.onLine ? "saved" : "offline");
    } catch {
      setAutosaveStatus("failed");
    }
  }, [draftKey]);

  // Debounced autosave of local edits. Paused until the user has answered
  // the recovery prompt so an old draft is never silently overwritten.
  useEffect(() => {
    if (!editorOpen || !draftChecked || recoverableDraft) return;
    if (JSON.stringify(formData) === initialDataRef.current) return;
    setAutosaveStatus("saving");
    const timer = setTimeout(persistDraft, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [formData, editorOpen, draftChecked, recoverableDraft, persistDraft]);

  useEffect(() => {
    if (isOffline && autosaveStatus === "saved") setAutosaveStatus("offline");
    if (!isOffline && autosaveStatus === "offline") setAutosaveStatus("saved");
  }, [isOffline, autosaveStatus]);

  const restoreDraft = useCallback(() => {
    if (!recoverableDraft) return;
    setFormData(recoverableDraft.data);
    baseRevisionRef.current = recoverableDraft.baseRevision ?? baseRevisionRef.current;
    setIsDirty(true);
    setRecoverableDraft(null);
    setAutosaveStatus("saved");
  }, [recoverableDraft]);

  const discardDraft = useCallback(() => {
    clearDraft(draftKey);
    setRecoverableDraft(null);
  }, [draftKey]);

  // Take over a draft started from a transaction. Only the page's own editor
  // does this, never the inline edit forms.
  useEffect(() => {
    if (isEditing || !pendingDraft) return;
    linkedRef.current = { hash: pendingDraft.linkedHash, network: pendingDraft.linkedNetwork };
    setLinkedInfo({ context: pendingDraft.context, missing: pendingDraft.missing });
    setFormData((prev) => ({ ...prev, ...pendingDraft.draft }));
    setIsOpen(true);
    setIsDirty(true);
    consumeDraft();
  }, [isEditing, pendingDraft, consumeDraft]);

  const resetForm = useCallback(() => {
    linkedRef.current = null;
    setLinkedInfo(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      type: "MANUAL",
      status: "SUCCEEDED",
      outcome: "PENDING",
      tags: [],
    });
    setTagInput("");
    setErrors({});
    setTouched({});
    setSubmitted(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    setHasConflict(false);
    setIsDirty(false);
    setAutosaveStatus("idle");
    setRecoverableDraft(null);
    clearDraft(draftKey);
  }, [draftKey]);

  // ------------------------------------------------------------------
  // Core submission logic (extracted so retry does not reuse events)
  // ------------------------------------------------------------------

  const validateCurrentForm = useCallback(() => {
    const current = formDataRef.current;
    const result = journalEntrySchema.safeParse({
      ...current,
      fee: current.fee || "0",
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return null;
    }

    setErrors({});
    return result.data;
  }, []);

  /**
   * Updates a single field and clears its inline error immediately, so a
   * message disappears the moment the user starts fixing it (rather than
   * lingering until the next submit attempt).
   */
  const updateField = useCallback((field: keyof JournalEntry, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitSuccess(null);
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Moves whatever is typed in the tag box into the tag list (comma/Enter/blur). */
  const commitTagInput = useCallback(() => {
    if (!tagInput.trim()) return;
    const incoming = tagInput.split(",");
    setTagInput("");
    setFormData((prev) => ({
      ...prev,
      tags: normalizeJournalTags([...(prev.tags ?? []), ...incoming]),
    }));
  }, [tagInput]);

  const removeTag = useCallback((tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: (prev.tags ?? []).filter((existing) => existing !== tag),
    }));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        // Enter would otherwise submit the whole entry form.
        e.preventDefault();
        commitTagInput();
      }
    },
    [commitTagInput]
  );

  /**
   * Validates a single field on blur so required fields surface their
   * errors inline — before the user ever attempts to submit.
   */
  const validateField = useCallback((field: keyof JournalEntry) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    const current = {
      ...formDataRef.current,
      fee: formDataRef.current.fee || "0",
    };
    const result = journalEntrySchema.safeParse(current);
    setErrors((prev) => {
      const next = { ...prev };
      const issue = result.success
        ? undefined
        : result.error.issues.find((i) => i.path[0] === field);
      if (issue) {
        next[field] = issue.message;
      } else {
        delete next[field];
      }
      return next;
    });
  }, []);

  /** Inline error for a field — hidden until it was blurred or submit failed. */
  const fieldError = useCallback(
    (field: keyof JournalEntry) =>
      submitted || touched[field] ? errors[field] : undefined,
    [errors, submitted, touched]
  );

  /** Summary entries (with element ids) for the ValidationSummary panel. */
  const summaryErrors = useMemo(() => {
    if (!submitted) return [];
    return Object.entries(errors).map(([field, message]) => ({
      field: FIELD_IDS[field] ?? field,
      message,
    }));
  }, [errors, submitted]);

  // Validation / submit messages render above the form; when the keyboard is
  // open that pushes the active control down behind it — pull it back.
  useEffect(() => {
    if (keyboardOpen) keepFocusedFieldVisible();
  }, [summaryErrors.length, submitError, keyboardOpen, keepFocusedFieldVisible]);

  /** Optimistic create: add entry locally → call API → replace id or rollback. */
  const submitCreateEntry = useCallback(
    async (data: JournalEntry) => {
      const tempId = `tx-optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const linked = linkedRef.current;
      if (linked?.hash && findJournalEntryByHash(store.getState().history, linked.hash)) {
        const message = "This transaction already has a journal entry.";
        setSubmitError(message);
        toast.info("Already in your journal", { description: message, duration: 3000 });
        return;
      }

      const optimisticEntry: TransactionHistoryItem = {
        id: tempId,
        hash: linked?.hash ?? `manual-${Date.now().toString(16)}`,
        network: linked?.network ?? undefined,
        notes: data.notes?.trim() || undefined,
        assetPair: data.assetPair,
        amount: data.amount,
        price: data.price,
        fee: data.fee,
        token: data.token,
        timestamp: new Date(data.date).getTime(),
        type: data.type as TransactionHistoryItem["type"],
        status: data.status as TransactionHistoryItem["status"],
        outcome: data.outcome as TransactionHistoryItem["outcome"],
        tags: data.tags ?? [],
      };

      // Optimistic: show entry immediately
      store.getState().addTransaction(optimisticEntry);
      store.getState().markPending(tempId);

      try {
        const serverEntry = await createJournalEntry(optimisticEntry);
        store.getState().removeTransaction(tempId);
        store.getState().addTransaction(serverEntry);
        store.getState().clearPending(tempId);
        clearDraft(draftKey);
        linkedRef.current = null;
        setLinkedInfo(null);
        setSubmitSuccess(`Saved ${data.assetPair} — ${data.amount} ${data.token} to your journal.`);
        toast.success("Transaction added to journal", {
          description: `${data.assetPair} — ${data.amount} ${data.token}`,
          duration: 2500,
        });
      } catch (err) {
        store.getState().removeTransaction(tempId);
        store.getState().markFailed(tempId);
        const message =
          err instanceof Error ? err.message : "Failed to save entry.";
        setSubmitError(message);
        setAutosaveStatus("failed");
        toast.error("Save failed", {
          description: message,
          duration: 4000,
          action: {
            label: "Retry",
            onClick: () => {
              store.getState().clearFailed(tempId);
              submitCreateEntry(data);
            },
          },
        });
        throw err; // re-throw so guard can record the failure
      }
    },
    [store, draftKey]
  );

  /**
   * Optimistic edit: update locally → call API → rollback on failure.
   * `overwrite` saves without a revision check, for when the user has chosen
   * to replace a newer server version with their edits.
   */
  const submitEditEntry = useCallback(
    async (data: JournalEntry, entry: TransactionHistoryItem, overwrite = false) => {
      const patch: Partial<TransactionHistoryItem> = {
        assetPair: data.assetPair,
        amount: data.amount,
        price: data.price,
        fee: data.fee,
        token: data.token,
        type: data.type as TransactionHistoryItem["type"],
        status: data.status as TransactionHistoryItem["status"],
        outcome: data.outcome as TransactionHistoryItem["outcome"],
        tags: data.tags ?? [],
        notes: data.notes?.trim() ?? "",
      };

      const snapshot = { ...entry };

      store.getState().updateTransaction(entry.id, patch);
      store.getState().markPending(entry.id);

      try {
        const updated = await updateJournalEntry(
          entry.id,
          patch,
          overwrite ? undefined : baseRevisionRef.current
        );
        store.getState().updateTransaction(entry.id, updated);
        store.getState().clearPending(entry.id);
        clearDraft(draftKey);
        setAutosaveStatus("idle");
        setSubmitSuccess(`Saved changes to ${data.assetPair}.`);
        toast.success("Journal entry updated", {
          description: `${data.assetPair} — changes saved.`,
          duration: 2500,
        });
        onEditComplete?.();
      } catch (err) {
        store.getState().updateTransaction(entry.id, snapshot);
        store.getState().markFailed(entry.id);
        const message =
          err instanceof Error ? err.message : "Failed to save changes.";
        setSubmitError(message);
        setAutosaveStatus("failed");
        if (err instanceof JournalApiError && err.code === "CONFLICT") {
          // Edits stay in the form and draft; the user decides whether to overwrite.
          setHasConflict(true);
          throw err;
        }
        toast.error("Update failed", {
          description: message,
          duration: 4000,
          action: {
            label: "Retry",
            onClick: () => {
              store.getState().clearFailed(entry.id);
              submitEditEntry(data, entry);
            },
          },
        });
        throw err; // re-throw so guard can record the failure
      }
    },
    [store, onEditComplete, draftKey]
  );

  // ── Event handler — guarded so Enter-key and button-click share the same lock
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setSubmitSuccess(null);
      setHasConflict(false);
      if (autosaveStatus === "failed") setAutosaveStatus("saving");
      setSubmitted(true);

      const data = validateCurrentForm();
      if (!data) return;

      await guard(async () => {
        if (isEditing && editEntry) {
          await submitEditEntry(data, editEntry);
        } else {
          await submitCreateEntry(data);
          setIsOpen(false);
          resetForm();
        }
      });
    },
    [validateCurrentForm, isEditing, editEntry, submitEditEntry, submitCreateEntry, resetForm, guard, autosaveStatus]
  );

  /** Saves the edits over a newer server version, after the user has chosen to. */
  const overwriteConflict = useCallback(async () => {
    if (!editEntry) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    setHasConflict(false);
    const data = validateCurrentForm();
    if (!data) return;

    await guard(() => submitEditEntry(data, editEntry, true));
  }, [editEntry, validateCurrentForm, submitEditEntry, guard]);

  // ── Render ──────────────────────────────────────────────────────────

  if (!isOpen && !isEditing) {
    return (
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <Plus size={16} /> Add Manual Entry
      </Button>
    );
  }

  const showForm = isOpen || isEditing;
  if (!showForm) return null;

  const handleCancel = isEditing
    ? () => { clearDraft(draftKey); onEditCancel?.(); }
    : () => { setIsOpen(false); resetForm(); };

  // Retry re-submits the current (unchanged) form state, so local edits
  // are never discarded by a failed save.
  const retrySave = () => {
    if (submitError) {
      (document.getElementById("journal-entry-form") as HTMLFormElement | null)?.requestSubmit();
    } else {
      persistDraft();
    }
  };

  // Inline error for a field, only once it was blurred or submit was attempted.
  const renderFieldError = (field: keyof JournalEntry, id: string) => {
    const message = fieldError(field);
    if (!message) return null;
    return (
      <p id={id} role="alert" className="text-xs text-red-400">
        {message}
      </p>
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 pb-24 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 sm:pb-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {isEditing ? "Edit Journal Entry" : "New Journal Entry"}
        </h3>
        <div className="flex items-center gap-2">
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={() => { setIsOpen(false); resetForm(); }} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex min-h-6 items-center gap-2 text-xs text-slate-400">
        <span role="status" aria-live="polite" data-testid="journal-autosave-status">
          {AUTOSAVE_MESSAGES[autosaveStatus]}
        </span>
        {autosaveStatus === "failed" && !hasConflict && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={retrySave}
            disabled={isSubmitting}
            data-testid="journal-autosave-retry"
          >
            Retry save
          </Button>
        )}
      </div>

      {recoverableDraft && (
        <div
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
          role="region"
          aria-label="Unsaved draft recovery"
          data-testid="journal-draft-recovery"
        >
          <span className="flex-1">
            You have unsaved edits from{" "}
            {new Date(recoverableDraft.savedAt).toLocaleString()}. Restore them?
          </span>
          <Button type="button" size="sm" onClick={restoreDraft}>
            Restore draft
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
            Discard
          </Button>
        </div>
      )}

      {linkedInfo && (
        <div
          className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200"
          role="region"
          aria-label="Draft from transaction"
          data-testid="journal-linked-draft"
        >
          <p className="font-medium">Started from an executed transaction</p>
          {linkedInfo.context.length > 0 && (
            <p className="mt-1 text-xs text-blue-300/80">
              {linkedInfo.context.map((c) => `${c.label}: ${c.value}`).join(" · ")}
            </p>
          )}
          {linkedInfo.missing.length > 0 && (
            <p className="mt-1 text-xs text-blue-300/80">
              Not provided by the transaction, please fill in: {linkedInfo.missing.join(", ")}.
            </p>
          )}
        </div>
      )}

      {submitSuccess && (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          role="status"
          aria-live="polite"
          data-testid="journal-submit-success"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {submitError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">
            {submitError} Your entry was not saved — check the details and try again.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={retrySave}
            disabled={isSubmitting}
            data-testid="journal-submit-retry"
          >
            Try again
          </Button>
        </div>
      )}

      {hasConflict && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300" data-testid="journal-conflict">
          <span className="flex-1">Keep your edits instead of the newer version?</span>
          <Button type="button" size="sm" onClick={overwriteConflict} disabled={isSubmitting} data-testid="journal-conflict-overwrite">
            Overwrite with my edits
          </Button>
        </div>
      )}

      {/* Field-level summary shown only after a failed submit attempt */}
      {submitted && (
        <div className="mb-4">
          <ValidationSummary errors={summaryErrors} />
        </div>
      )}

      {/*
        form onSubmit covers both the submit button click *and* the Enter key
        pressed from any field. useSubmitGuard ensures only one in-flight
        request is sent regardless of which path triggered submission.
      */}
      <form ref={formRef} id="journal-entry-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="journal-entry-date" className="text-xs font-medium text-slate-400">Date</label>
          <input
            id="journal-entry-date"
            type="date"
            value={formData.date}
            onChange={(e) => updateField("date", e.target.value)}
            onBlur={() => validateField("date")}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
            aria-invalid={!!fieldError("date")}
            aria-describedby={fieldError("date") ? "journal-entry-date-error" : undefined}
          />
          {renderFieldError("date", "journal-entry-date-error")}
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-asset-pair" className="text-xs font-medium text-slate-400">Asset Pair</label>
          <input
            id="journal-entry-asset-pair"
            type="text"
            placeholder="e.g. XLM/USDC"
            value={formData.assetPair || ""}
            onChange={(e) => updateField("assetPair", e.target.value)}
            onBlur={() => validateField("assetPair")}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
            aria-invalid={!!fieldError("assetPair")}
            aria-describedby={fieldError("assetPair") ? "journal-entry-asset-pair-error" : undefined}
          />
          {renderFieldError("assetPair", "journal-entry-asset-pair-error")}
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-amount" className="text-xs font-medium text-slate-400">Amount</label>
          <input
            id="journal-entry-amount"
            type="text"
            placeholder="0.00"
            value={formData.amount || ""}
            onChange={(e) => updateField("amount", e.target.value)}
            onBlur={() => validateField("amount")}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? "journal-entry-amount-error" : undefined}
          />
          {errors.amount && <p id="journal-entry-amount-error" className="text-[10px] text-red-400">{errors.amount}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-price" className="text-xs font-medium text-slate-400">Price</label>
          <input
            id="journal-entry-price"
            type="text"
            placeholder="0.00"
            value={formData.price || ""}
            onChange={(e) => updateField("price", e.target.value)}
            onBlur={() => validateField("price")}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
            aria-invalid={!!errors.price}
            aria-describedby={errors.price ? "journal-entry-price-error" : undefined}
          />
          {errors.price && <p id="journal-entry-price-error" className="text-[10px] text-red-400">{errors.price}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-token" className="text-xs font-medium text-slate-400">Token</label>
          <input
            id="journal-entry-token"
            type="text"
            placeholder="e.g. XLM"
            value={formData.token || ""}
            onChange={(e) => updateField("token", e.target.value)}
            onBlur={() => validateField("token")}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
            aria-invalid={!!errors.token}
            aria-describedby={errors.token ? "journal-entry-token-error" : undefined}
          />
          {errors.token && <p id="journal-entry-token-error" className="text-[10px] text-red-400">{errors.token}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-fee" className="text-xs font-medium text-slate-400">Fee</label>
          <input
            id="journal-entry-fee"
            type="text"
            placeholder="0.00"
            value={formData.fee || ""}
            onChange={(e) => updateField("fee", e.target.value)}
            onBlur={() => validateField("fee")}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
            aria-invalid={!!errors.fee}
            aria-describedby={errors.fee ? "journal-entry-fee-error" : undefined}
          />
          {errors.fee && <p id="journal-entry-fee-error" className="text-[10px] text-red-400">{errors.fee}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-status" className="text-xs font-medium text-slate-400">Status</label>
          <select
            id="journal-entry-status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <option value="PENDING">Pending</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="journal-entry-outcome" className="text-xs font-medium text-slate-400">Outcome</label>
          <select
            id="journal-entry-outcome"
            value={formData.outcome}
            onChange={(e) => setFormData({ ...formData, outcome: e.target.value as any })}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <option value="PENDING">Pending</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="journal-entry-tag-input" className="text-xs font-medium text-slate-400">Tags</label>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            {(formData.tags ?? []).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-xs text-blue-300">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={isSubmitting}
                  aria-label={`Remove tag ${tag}`}
                  className="rounded-full hover:text-white disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              id="journal-entry-tag-input"
              type="text"
              placeholder="e.g. breakout, dca — press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTagInput}
              className="min-w-24 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
              disabled={isSubmitting}
            />
          </div>
          <JournalTagPicker
            selected={formData.tags ?? []}
            disabled={isSubmitting}
            onToggle={(tag) => {
              markDirty();
              setFormData((prev) => {
                const current = prev.tags ?? [];
                return {
                  ...prev,
                  tags: current.includes(tag) ? current.filter((t) => t !== tag) : normalizeJournalTags([...current, tag]),
                };
              });
            }}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="journal-entry-notes" className="text-xs font-medium text-slate-400">Notes</label>
          <textarea
            id="journal-entry-notes"
            rows={3}
            value={formData.notes ?? ""}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Your own notes about this trade"
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isSubmitting}
          />
        </div>

        <div className="sm:col-span-2 hidden sm:block">
          <Button
            type="submit"
            className="w-full gap-2"
            {...submitButtonProps}
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isEditing ? "Save Changes" : "Save Entry"}
          </Button>
        </div>
      </form>

      {/*
        Mobile sticky action bar — on small screens the form can run long
        enough (many fields, on-screen keyboard open) that the inline submit
        button above scrolls out of view. Pin Save/Cancel to the bottom of
        the viewport instead so they're always reachable without covering
        the field the user is editing (the form's own bottom padding above
        reserves space for this bar). `submit`+`form` ties this button to
        the form above without duplicating the submit logic. Only rendered
        while an editable draft (new or edit) is actually open.
      */}
      <div
        ref={actionBarRef}
        data-keyboard-open={keyboardOpen || undefined}
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-white/10 bg-slate-900/95 px-4 pt-3 backdrop-blur transition-transform duration-150 ease-out motion-reduce:transition-none sm:hidden"
        style={{
          // Translate (rather than change `bottom`) so the bar tracks the
          // keyboard on the compositor without re-laying out the page.
          transform: keyboardInset ? `translate3d(0, -${keyboardInset}px, 0)` : undefined,
          // The home indicator is hidden behind the keyboard while it's open.
          paddingBottom: keyboardOpen ? "0.75rem" : "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="journal-entry-form"
          className="flex-1 gap-2"
          {...submitButtonProps}
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {isEditing ? "Save Changes" : "Save Entry"}
        </Button>
      </div>
    </div>
  );
}
