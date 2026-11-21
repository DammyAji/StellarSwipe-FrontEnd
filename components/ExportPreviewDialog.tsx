"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ExportPreviewItem {
  label: string;
  value: string;
}

export interface ExportPreviewIssue {
  message: string;
  /** Identifiers of affected records, shown so users can find and fix them. */
  recordIds?: string[];
}

interface ExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  items: ExportPreviewItem[];
  confirmLabel: string;
  successMessage?: string;
  /** Non-blocking validation warnings shown before download. */
  warnings?: ExportPreviewIssue[];
  /** Blocking errors — when present, the confirm action is disabled. */
  blockingErrors?: ExportPreviewIssue[];
  /** Label for the dismiss action, e.g. "Back to review". */
  cancelLabel?: string;
  /**
   * Optional handler for adjusting export settings (e.g. re-showing hidden
   * columns or clearing filters). When provided, the review offers an
   * "Adjust settings" action next to the dismiss button.
   */
  onAdjustSettings?: () => void;
  adjustSettingsLabel?: string;
  /** Optional action that closes the dialog so the user can change options. */
  editLabel?: string;
  onEdit?: () => void;
  onConfirm: () => Promise<void> | void;
}

const MAX_RECORD_IDS = 5;

function IssueList({
  tone,
  heading,
  issues,
}: {
  tone: "error" | "warning";
  heading: string;
  issues: ExportPreviewIssue[];
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : undefined}
      data-testid={isError ? "export-blocking-errors" : "export-warnings"}
      className={
        isError
          ? "rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300"
          : "rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-300"
      }
    >
      <p className="mb-1 flex items-center gap-2 font-medium">
        {isError ? (
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        {heading}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs">
        {issues.map((issue) => (
          <li key={issue.message}>
            {issue.message}
            {issue.recordIds && issue.recordIds.length > 0 && (
              <span className="block font-mono opacity-80">
                Affected: {issue.recordIds.slice(0, MAX_RECORD_IDS).join(", ")}
                {issue.recordIds.length > MAX_RECORD_IDS &&
                  ` and ${issue.recordIds.length - MAX_RECORD_IDS} more`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type ExportPreviewState = "idle" | "working" | "success" | "error";

/**
 * Shared preview/confirmation dialog for export & share flows (portfolio
 * snapshots, reports, comparison outputs). Shows exactly what will be
 * exported before anything downloads, then surfaces a clear success or
 * failure state so the action feels reliable instead of a silent download.
 */
export function ExportPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  confirmLabel,
  successMessage = "Export ready — check your downloads.",
  warnings = [],
  blockingErrors = [],
  cancelLabel = "Cancel",
  editLabel,
  onEdit,
  onAdjustSettings,
  adjustSettingsLabel = "Adjust settings",
  onConfirm,
}: ExportPreviewDialogProps) {
  const [state, setState] = useState<ExportPreviewState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    // Don't let the dialog be dismissed mid-export — avoids orphaned downloads.
    if (state === "working") return;
    onOpenChange(next);
    if (!next) {
      setState("idle");
      setErrorMessage(null);
    }
  };

  const isBlocked = blockingErrors.length > 0;

  const handleConfirm = async () => {
    if (isBlocked) return;
    setState("working");
    setErrorMessage(null);
    try {
      await onConfirm();
      setState("success");
      window.setTimeout(() => {
        onOpenChange(false);
        setState("idle");
      }, 1100);
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong preparing this export. Please try again."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4"
            >
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="text-right font-medium text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {isBlocked && (
          <IssueList
            tone="error"
            heading="Resolve these issues before downloading"
            issues={blockingErrors}
          />
        )}

        {warnings.length > 0 && (
          <IssueList tone="warning" heading="Review before exporting" issues={warnings} />
        )}

        {state === "success" && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {successMessage}
          </div>
        )}

        {state === "error" && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {errorMessage}
          </div>
        )}

        <DialogFooter>
          {editLabel && onEdit && (
            <Button
              variant="ghost"
              onClick={() => {
                if (state === "working") return;
                onEdit();
                handleOpenChange(false);
              }}
              disabled={state === "working"}
            >
              {editLabel}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={state === "working"}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={state === "working" || state === "success" || isBlocked}
            aria-disabled={isBlocked || undefined}
            className="gap-2"
          >
            {state === "working" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Preparing…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
