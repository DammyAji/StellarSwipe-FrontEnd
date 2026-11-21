"use client";

import { ExternalLink, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnChainConfirmationStatusProps {
  status?: "PENDING" | "SUCCEEDED" | "FAILED";
  transactionHash?: string;
}

const statusMap = {
  PENDING: {
    label: "Pending confirmation",
    icon: Clock3,
    description: "The transaction is waiting for on-chain confirmation.",
    style: "border-yellow-500/20 bg-yellow-500/10 text-yellow-200",
  },
  SUCCEEDED: {
    label: "On-chain confirmed",
    icon: CheckCircle2,
    description: "The transaction was confirmed on Stellar.",
    style: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  },
  FAILED: {
    label: "Confirmation failed",
    icon: XCircle,
    description: "The transaction failed and was not confirmed.",
    style: "border-red-500/20 bg-red-500/10 text-red-200",
  },
};

export function OnChainConfirmationStatus({
  status = "PENDING",
  transactionHash,
}: OnChainConfirmationStatusProps) {
  const metadata = statusMap[status];
  const explorerUrl = transactionHash
    ? `https://stellar.expert/explorer/testnet/tx/${transactionHash}`
    : undefined;

  return (
    <section
      className="rounded-3xl border border-white/10 bg-card p-4 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label={`Transaction status: ${metadata.label}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
              metadata.style,
              "forced-color-adjust-auto forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]",
            )}
            aria-hidden="true"
          >
            <metadata.icon size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-foreground">{metadata.label}</p>
            <p className="text-sm text-muted-foreground">
              {transactionHash ? metadata.description : "No active on-chain transaction yet."}
            </p>
          </div>
        </div>

        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground transition hover:border-white/20"
          >
            View on explorer
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
    </section>
  );
}
