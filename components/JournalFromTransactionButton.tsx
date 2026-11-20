"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { planJournalDraft } from "@/lib/journalFromTransaction";
import { useJournalDraftStore } from "@/store/useJournalDraftStore";
import { useTransactionStore, type TransactionDetails } from "@/store/useTransactionStore";

interface JournalFromTransactionButtonProps {
  transaction: TransactionDetails;
  className?: string;
  /** Called after the journal page was opened (for example to close a dialog). */
  onStarted?: () => void;
}

/**
 * Starts a journal draft from an executed transaction. Existing entries for the
 * same transaction are reused, so clicking again never creates a duplicate.
 */
export function JournalFromTransactionButton({
  transaction,
  className,
  onStarted,
}: JournalFromTransactionButtonProps) {
  const router = useRouter();
  const history = useTransactionStore((state) => state.history);
  const queued = useJournalDraftStore((state) => state.pending);
  const request = useJournalDraftStore((state) => state.request);
  const [opening, setOpening] = useState(false);

  const plan = planJournalDraft(transaction, history, queued?.key ?? null);
  const label =
    plan.status === "exists"
      ? "View journal entry"
      : plan.status === "already-queued"
        ? "Draft open in journal"
        : "Add to journal";

  function handleClick() {
    if (opening) return;
    setOpening(true);
    if (plan.status === "new") {
      request(plan.draft);
    } else if (plan.status === "exists") {
      toast.info("Already in your journal", {
        description: "This transaction already has a journal entry.",
      });
    }
    router.push("/journal");
    onStarted?.();
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={opening}
      aria-busy={opening}
      className={className}
    >
      {opening ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <BookMarked className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
