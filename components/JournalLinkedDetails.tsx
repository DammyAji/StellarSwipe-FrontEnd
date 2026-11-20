"use client";

import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeLinkedExecution } from "@/lib/journalLinkedDetails";
import { cn } from "@/lib/utils";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

interface JournalLinkedDetailsProps {
  entry: TransactionHistoryItem | null;
  onClose: () => void;
}

/**
 * Shows the transaction an entry is linked to next to the user's own notes.
 * Rendered in a dialog so the virtualized list rows keep a fixed height.
 */
export function JournalLinkedDetails({ entry, onClose }: JournalLinkedDetailsProps) {
  const details = entry
    ? describeLinkedExecution(entry, process.env.NEXT_PUBLIC_STELLAR_NETWORK)
    : null;

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{entry ? `${entry.assetPair} entry` : "Journal entry"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {details?.linked
              ? "Transaction details come from the linked execution record."
              : "This entry is not linked to an on-chain transaction."}
          </DialogDescription>
        </DialogHeader>

        {details?.linked && (
          <section aria-label="Linked execution details" className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {details.rows.map((r) => (
                <div key={r.label} className="contents">
                  <dt className="text-slate-400">{r.label}</dt>
                  <dd className={cn("text-right", r.available ? "text-white" : "text-slate-500")}>{r.value}</dd>
                </div>
              ))}
            </dl>
            {details.statusNote && (
              <p role="status" className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {details.statusNote}
              </p>
            )}
            {details.networkNote && <p className="text-xs text-slate-400">{details.networkNote}</p>}
            {details.receiptUrl ? (
              <a
                href={details.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                View receipt <ArrowRight size={12} aria-hidden="true" />
              </a>
            ) : (
              <p className="text-xs text-slate-500">Receipt link unavailable.</p>
            )}
          </section>
        )}

        <section aria-label="Your notes" className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Your notes</h3>
          {details?.notes ? (
            <p className="whitespace-pre-wrap text-sm text-slate-200">{details.notes}</p>
          ) : (
            <p className="text-sm text-slate-500">No notes on this entry.</p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
