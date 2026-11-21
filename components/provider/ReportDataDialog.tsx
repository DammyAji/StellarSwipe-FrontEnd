"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;
const CONTEXT_MAX = 200;

export interface ReportDataPayload {
  providerId: string;
  description: string;
  pageContext?: string;
}

export interface ReportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  /** Optional page context pre-filled from the current view (e.g. the URL). */
  defaultPageContext?: string;
  /** Submits the report. Rejecting keeps the dialog open with the text intact. */
  onSubmit?: (payload: ReportDataPayload) => Promise<void>;
}

type Status = "idle" | "submitting" | "success" | "error";

interface FieldErrors {
  description?: string;
  pageContext?: string;
}

function validate(description: string, pageContext: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = description.trim();

  if (trimmed.length === 0) {
    errors.description = "Please describe the data issue.";
  } else if (trimmed.length < DESCRIPTION_MIN) {
    errors.description = `Please add at least ${DESCRIPTION_MIN} characters so we can investigate.`;
  } else if (trimmed.length > DESCRIPTION_MAX) {
    errors.description = `Please keep the description under ${DESCRIPTION_MAX} characters.`;
  }

  if (pageContext.trim().length > CONTEXT_MAX) {
    errors.pageContext = `Please keep the page context under ${CONTEXT_MAX} characters.`;
  }

  return errors;
}

/**
 * Report-data form for provider profiles. Reporting flags the data for review;
 * it never changes provider data immediately, which the copy makes explicit.
 */
export function ReportDataDialog({
  open,
  onOpenChange,
  providerId,
  defaultPageContext = "",
  onSubmit,
}: ReportDataDialogProps) {
  const fieldId = useId();
  const [description, setDescription] = useState("");
  const [pageContext, setPageContext] = useState(defaultPageContext);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDescription("");
    setPageContext(defaultPageContext);
    setErrors({});
    setStatus("idle");
    setSubmitError(null);
  }, [defaultPageContext]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && status === "submitting") return;
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset, status]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (status === "submitting") return;

      const nextErrors = validate(description, pageContext);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setStatus("idle");
        return;
      }

      setStatus("submitting");
      setSubmitError(null);

      try {
        await onSubmit?.({
          providerId,
          description: description.trim(),
          pageContext: pageContext.trim() || undefined,
        });
        setStatus("success");
      } catch (error) {
        // Keep the entered text so the user can retry without retyping.
        setStatus("error");
        setSubmitError(
          error instanceof Error && error.message
            ? error.message
            : "We couldn't submit your report. Your text is saved — please try again."
        );
      }
    },
    [description, onSubmit, pageContext, providerId, status]
  );

  const descriptionError = errors.description;
  const contextError = errors.pageContext;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Report a data issue
          </DialogTitle>
          <DialogDescription>
            Tell us what looks wrong on this provider profile. Reporting flags the
            data for review — it does not change the provider&apos;s data
            immediately.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-green-800 bg-green-950/40 p-3 text-sm text-green-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Thanks — your report was submitted for review. The data will not
              change until our team verifies it.
            </span>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor={`${fieldId}-description`}
                className="text-sm font-medium text-foreground"
              >
                Description
                <span className="ml-1 text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id={`${fieldId}-description`}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (errors.description) {
                    setErrors((prev) => ({ ...prev, description: undefined }));
                  }
                }}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                required
                aria-required="true"
                aria-invalid={Boolean(descriptionError)}
                aria-describedby={
                  descriptionError
                    ? `${fieldId}-description-error`
                    : `${fieldId}-description-hint`
                }
                placeholder="What data looks incorrect, and what did you expect?"
                className={`w-full rounded-md border bg-gray-900 p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                  descriptionError ? "border-red-500" : "border-gray-700"
                }`}
              />
              {descriptionError ? (
                <p
                  id={`${fieldId}-description-error`}
                  role="alert"
                  className="flex items-center gap-1 text-xs text-red-400"
                >
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  {descriptionError}
                </p>
              ) : (
                <p
                  id={`${fieldId}-description-hint`}
                  className="text-xs text-muted-foreground"
                >
                  {description.trim().length}/{DESCRIPTION_MAX} characters
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${fieldId}-context`}
                className="text-sm font-medium text-foreground"
              >
                Page context{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <input
                id={`${fieldId}-context`}
                type="text"
                value={pageContext}
                onChange={(event) => {
                  setPageContext(event.target.value);
                  if (errors.pageContext) {
                    setErrors((prev) => ({ ...prev, pageContext: undefined }));
                  }
                }}
                maxLength={CONTEXT_MAX}
                aria-invalid={Boolean(contextError)}
                aria-describedby={
                  contextError
                    ? `${fieldId}-context-error`
                    : `${fieldId}-context-hint`
                }
                placeholder="e.g. Performance history, 30d range"
                className={`w-full rounded-md border bg-gray-900 p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                  contextError ? "border-red-500" : "border-gray-700"
                }`}
              />
              {contextError ? (
                <p
                  id={`${fieldId}-context-error`}
                  role="alert"
                  className="flex items-center gap-1 text-xs text-red-400"
                >
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  {contextError}
                </p>
              ) : (
                <p
                  id={`${fieldId}-context-hint`}
                  className="text-xs text-muted-foreground"
                >
                  Where on the profile did you see the issue?
                </p>
              )}
            </div>

            {status === "error" && submitError ? (
              <p
                role="alert"
                className="flex items-start gap-1 rounded-md border border-red-800 bg-red-950/40 p-2 text-xs text-red-300"
              >
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                {submitError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={status === "submitting"}>
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  "Submit report"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {status === "success" ? (
          <DialogFooter>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
