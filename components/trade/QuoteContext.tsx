import { cn } from "@/lib/utils";

export type QuoteContextStatus = "loading" | "ready" | "empty" | "error";

export interface QuoteContextData {
  status: QuoteContextStatus;
  source?: string | null;
  receivedAt?: string | number | Date | null;
}

interface QuoteContextProps {
  context?: QuoteContextData;
  className?: string;
}

const UNAVAILABLE = "Unavailable";

function formatReceivedAt(value: QuoteContextData["receivedAt"]): string {
  if (value === undefined || value === null || value === "") return UNAVAILABLE;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function QuoteContext({ context, className }: QuoteContextProps) {
  const status = context?.status ?? "empty";
  const metadataAvailable = status === "ready";
  const source = metadataAvailable && context?.source?.trim()
    ? context.source.trim()
    : UNAVAILABLE;
  const receivedAt = metadataAvailable
    ? formatReceivedAt(context?.receivedAt)
    : UNAVAILABLE;

  return (
    <section
      aria-labelledby="quote-context-heading"
      aria-busy={status === "loading"}
      className={cn("mt-4 rounded-xl border bg-muted/20 p-3 sm:p-4", className)}
    >
      <h2
        id="quote-context-heading"
        className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Quote context
      </h2>

      {status === "loading" && (
        <p role="status" className="mb-2 text-sm text-muted-foreground">
          Loading quote context…
        </p>
      )}
      {status === "empty" && (
        <p className="mb-2 text-sm text-muted-foreground">
          No quote metadata is available for this preview.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          Quote context could not be loaded. Quote metadata is unavailable.
        </p>
      )}

      {status !== "loading" && (
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Source</dt>
            <dd className="min-w-0 break-words text-right font-medium">{source}</dd>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Received</dt>
            <dd className="min-w-0 break-words text-right font-medium tabular-nums">
              {receivedAt}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
